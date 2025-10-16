import { apiRequest } from "@/api/client";
import { useMarket, useMarketStats } from "@/api/queries/markets";
import { useOrderbook, useTrades } from "@/api/queries/orderbook";
import { usePlaceSmartOrder } from "@/api/queries/orders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@/contexts/WalletContext";
import { CONTRACT_ADDRESSES, stacksNetwork } from "@/lib/config";
import type {
  CombinedOrderbook,
  ExecutionPlan,
  OrderSide,
  OrderType,
  OrderbookLevel,
  SmartOrderPreviewRequest,
  Trade,
} from "@/types/api";
import {
  calculateExpiration,
  computeOrderHash,
  generateSalt,
} from "@/utils/orderSigning";
import {
  checkIfNeedsSplit,
  checkPositionBalance,
  waitForTransactionConfirmation,
} from "@/utils/stacksHelpers";
import { hexToBytes } from "@stacks/common";
import { openContractCall } from "@stacks/connect";
import {
  AnchorMode,
  PostConditionMode,
  bufferCV,
  principalCV,
  uintCV,
} from "@stacks/transactions";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

type Outcome = "yes" | "no";

const formatCents = (value?: number) =>
  typeof value === "number" ? `${value.toFixed(2)}¢` : "—";

const formatSats = (value?: number) =>
  typeof value === "number" ? `${value.toFixed(4)} sBTC` : "—";

const formatTimestamp = (timestamp?: number) =>
  timestamp ? new Date(timestamp).toLocaleString() : "—";

const withCumulativeTotals = (levels: OrderbookLevel[] = []) => {
  let cumulative = 0;
  return levels.map((level) => {
    cumulative += level.size;
    return { ...level, total: cumulative };
  });
};

const outcomeLabels: Record<Outcome, string> = {
  yes: "YES",
  no: "NO",
};

export function MarketDetail() {
  const { marketId = "" } = useParams();
  const { isConnected, userData, signMessage } = useWallet();
  const [maker, setMaker] = useState("");
  const [side, setSide] = useState<OrderSide>("BUY");
  const [outcome, setOutcome] = useState<Outcome>("yes");
  const [orderType, setOrderType] = useState<OrderType>("LIMIT");
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("");
  const [maxSlippage, setMaxSlippage] = useState("5");
  const [executionPreview, setExecutionPreview] =
    useState<ExecutionPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-fill maker address from connected wallet
  useEffect(() => {
    if (isConnected && userData?.addresses?.stx?.[0]?.address) {
      setMaker(userData.addresses.stx[0].address);
    } else {
      setMaker("");
    }
  }, [isConnected, userData]);

  // Fetch market data with TanStack Query
  const {
    data: market,
    isLoading: isMarketLoading,
    error: marketError,
  } = useMarket(marketId);
  const { data: stats } = useMarketStats(marketId);
  const { data: orderbookData } = useOrderbook(marketId);
  const { data: trades = [] } = useTrades(marketId, 12);

  const placeOrderMutation = usePlaceSmartOrder();

  const combinedOrderbook: CombinedOrderbook | undefined =
    orderbookData?.orderbooks;

  const yesOrderbook = useMemo(
    () =>
      combinedOrderbook
        ? {
            bids: withCumulativeTotals(combinedOrderbook.yes.bids),
            asks: withCumulativeTotals(combinedOrderbook.yes.asks),
          }
        : undefined,
    [combinedOrderbook]
  );

  const noOrderbook = useMemo(
    () =>
      combinedOrderbook
        ? {
            bids: withCumulativeTotals(combinedOrderbook.no.bids),
            asks: withCumulativeTotals(combinedOrderbook.no.asks),
          }
        : undefined,
    [combinedOrderbook]
  );

  // Split position: convert sBTC into YES+NO outcome tokens
  const splitPosition = async (
    amount: number
  ): Promise<{ success: boolean; txId?: string }> => {
    if (!market) return { success: false };

    const [contractAddress, contractName] =
      CONTRACT_ADDRESSES.CONDITIONAL_TOKENS.split(".");
    const amountMicroSats = Math.floor(amount * 1_000_000); // Convert to micro-satoshis

    return new Promise((resolve) => {
      openContractCall({
        network: stacksNetwork,
        anchorMode: AnchorMode.Any,
        contractAddress,
        contractName,
        functionName: "split-position",
        functionArgs: [
          uintCV(amountMicroSats),
          bufferCV(hexToBytes(market.conditionId.replace("0x", ""))),
        ],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          setSuccessMessage(
            `✅ Deposited ${amount} sBTC into market (txid: ${data.txId.slice(
              0,
              8
            )}...)`
          );
          resolve({ success: true, txId: data.txId });
        },
        onCancel: () => {
          resolve({ success: false });
        },
      });
    });
  };

  // Merge positions: convert YES+NO pairs back into sBTC
  const mergePositions = async (
    amount: number
  ): Promise<{ success: boolean; txId?: string }> => {
    if (!market || !maker) return { success: false };

    const [contractAddress, contractName] =
      CONTRACT_ADDRESSES.CONDITIONAL_TOKENS.split(".");
    const amountMicroSats = Math.floor(amount * 1_000_000); // Convert to micro-satoshis

    return new Promise((resolve) => {
      openContractCall({
        network: stacksNetwork,
        anchorMode: AnchorMode.Any,
        contractAddress,
        contractName,
        functionName: "merge-positions",
        functionArgs: [
          uintCV(amountMicroSats),
          bufferCV(hexToBytes(market.conditionId.replace("0x", ""))),
          principalCV(maker), // recipient address
        ],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          setSuccessMessage(
            `✅ Merged ${amount} YES+NO pairs → ${amount} sBTC returned (txid: ${data.txId.slice(
              0,
              8
            )}...)`
          );
          resolve({ success: true, txId: data.txId });
        },
        onCancel: () => {
          resolve({ success: false });
        },
      });
    });
  };

  // Clear error messages when user changes inputs
  useEffect(() => {
    if (errorMessage) {
      setErrorMessage(undefined);
    }
  }, [side, outcome, orderType, size, price, maxSlippage]);

  // Preview execution plan when size/price/orderType changes
  useEffect(() => {
    const previewOrder = async () => {
      if (!market || !size || Number(size) <= 0) {
        setExecutionPreview(null);
        return;
      }

      const numericSize = Number(size);
      const numericPrice = orderType === "LIMIT" ? Number(price) : undefined;

      if (orderType === "LIMIT" && (!price || Number.isNaN(numericPrice))) {
        setExecutionPreview(null);
        return;
      }

      try {
        const response = await apiRequest<{
          success: boolean;
          plan: ExecutionPlan;
        }>("/api/smart-orders/preview", {
          method: "POST",
          body: JSON.stringify({
            marketId,
            outcome,
            side,
            orderType,
            size: numericSize,
            price: numericPrice,
            maxSlippage: Number(maxSlippage) || 5,
          } as SmartOrderPreviewRequest),
        });

        setExecutionPreview(response.plan);
      } catch (error) {
        console.error("Preview error:", error);
        setExecutionPreview(null);
      }
    };

    const debounce = setTimeout(previewOrder, 500);
    return () => clearTimeout(debounce);
  }, [market, marketId, outcome, side, orderType, size, price, maxSlippage]);

  const onSubmitOrder = async (event: FormEvent) => {
    event.preventDefault();
    if (!market) return;

    // Check wallet connection
    if (!isConnected) {
      setErrorMessage("Please connect your wallet to place orders.");
      setSuccessMessage(undefined);
      return;
    }

    const numericSize = Number(size);
    const numericPrice = orderType === "LIMIT" ? Number(price) : undefined;

    if (!maker || Number.isNaN(numericSize)) {
      setErrorMessage("Please provide maker address and size.");
      setSuccessMessage(undefined);
      return;
    }

    if (
      orderType === "LIMIT" &&
      (!numericPrice || Number.isNaN(numericPrice))
    ) {
      setErrorMessage("Please provide a price for limit orders.");
      setSuccessMessage(undefined);
      return;
    }

    try {
      setErrorMessage(undefined);
      setIsProcessing(true);

      // Check if user needs to split position (both BUY and SELL)
      const balanceCheck = await checkIfNeedsSplit({
        userAddress: maker,
        side,
        outcome,
        size: numericSize,
        yesPositionId: market.yesPositionId,
        noPositionId: market.noPositionId,
      });

      if (balanceCheck.needsSplit) {
        const shortfall = (
          Number(balanceCheck.requiredBalance - balanceCheck.currentBalance) /
          1_000_000
        ).toFixed(2);
        const action =
          side === "BUY"
            ? `buy ${outcome.toUpperCase()}`
            : `sell ${outcome.toUpperCase()}`;

        const shouldSplit = window.confirm(
          `💳 Deposit Required\n\n` +
            `To ${action}, you need to deposit ${shortfall} sBTC.\n\n` +
            `This will be converted to outcome tokens (YES+NO pairs).\n` +
            `You can merge them back to sBTC anytime.\n\n` +
            `Proceed with deposit?`
        );

        if (!shouldSplit) {
          setErrorMessage("Order cancelled - deposit required");
          setIsProcessing(false);
          return;
        }

        const splitAmount = Number(shortfall);
        const splitResult = await splitPosition(splitAmount);

        if (!splitResult.success) {
          setErrorMessage("Deposit cancelled");
          setIsProcessing(false);
          return;
        }

        if (splitResult.txId) {
          setSuccessMessage(
            `⏳ Waiting for deposit confirmation (${splitResult.txId.slice(
              0,
              8
            )}...)...`
          );

          try {
            const confirmation = await waitForTransactionConfirmation(
              splitResult.txId
            );

            if (confirmation.success) {
              setSuccessMessage(
                `✅ Deposit confirmed! Now placing your order...`
              );
            } else {
              setErrorMessage(`❌ Deposit failed: ${confirmation.status}`);
              setIsProcessing(false);
              return;
            }
          } catch (error) {
            setErrorMessage(
              `⏱️ Deposit timeout - please check blockchain and try again`
            );
            setIsProcessing(false);
            return;
          }
        }
      }

      // Generate order parameters
      const salt = generateSalt();
      const expiration = calculateExpiration(1); // 1 hour from now

      // Determine which position ID for signing
      let signPositionId: string;
      if (side === "BUY") {
        signPositionId =
          outcome === "yes" ? market.noPositionId : market.yesPositionId;
      } else {
        signPositionId =
          outcome === "yes" ? market.yesPositionId : market.noPositionId;
      }

      // For signing, we use a single representative hash
      // (For market orders with multiple levels, backend will verify each sub-order)
      const oppositePositionId =
        side === "BUY"
          ? outcome === "yes"
            ? market.noPositionId
            : market.yesPositionId
          : outcome === "yes"
          ? market.yesPositionId
          : market.noPositionId;

      const signHash = await computeOrderHash(
        maker,
        maker,
        signPositionId,
        oppositePositionId,
        numericSize,
        orderType === "LIMIT" ? numericSize * numericPrice! : numericSize * 50, // Use 50¢ as placeholder for market orders
        salt,
        expiration
      );

      const orderHashHex = Array.from(signHash)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const signResult = await signMessage(orderHashHex);

      // Submit smart order using mutation
      const response = await placeOrderMutation.mutateAsync({
        maker,
        marketId: market.marketId,
        outcome,
        side,
        orderType,
        size: numericSize,
        price: numericPrice,
        maxSlippage: Number(maxSlippage) || 5,
        salt,
        expiration,
        signature: signResult.signature,
        publicKey: signResult.publicKey,
      });

      if (response.success) {
        if (orderType === "MARKET" && response.orders) {
          setSuccessMessage(
            `✅ Market order executed: ${
              response.orders.length
            } fills @ avg ${response.executionPlan?.averagePrice.toFixed(
              2
            )}¢ (${response.executionPlan?.slippage.toFixed(2)}% slippage)`
          );
        } else if (response.order) {
          setSuccessMessage(
            `✅ Limit order placed: ${side} ${numericSize} ${outcomeLabels[outcome]} @ ${response.order.price}¢`
          );
        }

        // Auto-merge after SELL orders
        if (side === "SELL") {
          try {
            // Check user's YES and NO balances
            const yesBalance = await checkPositionBalance(
              maker,
              market.yesPositionId
            );
            const noBalance = await checkPositionBalance(
              maker,
              market.noPositionId
            );

            // Calculate mergeable pairs (minimum of both balances)
            const mergeablePairs =
              yesBalance < noBalance ? yesBalance : noBalance;

            if (mergeablePairs > 0) {
              const mergeAmount = Number(mergeablePairs) / 1_000_000; // Convert to sBTC

              const shouldMerge = window.confirm(
                `💰 Auto-Merge Available\n\n` +
                  `You have ${mergeAmount.toFixed(
                    4
                  )} matching YES+NO pairs.\n` +
                  `Merge them back to ${mergeAmount.toFixed(4)} sBTC?\n\n` +
                  `Current balances:\n` +
                  `YES: ${(Number(yesBalance) / 1_000_000).toFixed(4)}\n` +
                  `NO: ${(Number(noBalance) / 1_000_000).toFixed(4)}`
              );

              if (shouldMerge) {
                setSuccessMessage(
                  `⏳ Merging ${mergeAmount.toFixed(4)} pairs to sBTC...`
                );
                const mergeResult = await mergePositions(mergeAmount);

                if (mergeResult.success && mergeResult.txId) {
                  setSuccessMessage(
                    `⏳ Waiting for merge confirmation (${mergeResult.txId.slice(
                      0,
                      8
                    )}...)...`
                  );

                  const confirmation = await waitForTransactionConfirmation(
                    mergeResult.txId
                  );

                  if (confirmation.success) {
                    setSuccessMessage(
                      `✅ Order complete! Sold ${numericSize} ${
                        outcomeLabels[outcome]
                      } and merged ${mergeAmount.toFixed(
                        4
                      )} sBTC back to wallet`
                    );
                  } else {
                    setErrorMessage(
                      `⚠️ Merge transaction failed: ${confirmation.status}. You can manually merge later.`
                    );
                  }
                }
              }
            }
          } catch (error) {
            console.error("Auto-merge check failed:", error);
            // Don't fail the entire order if merge check fails
          }
        }

        setPrice("");
        setSize("");
        setExecutionPreview(null);
        // TanStack Query auto-invalidates and refetches
      }
    } catch (err) {
      setSuccessMessage(undefined);
      setErrorMessage((err as Error).message || "Failed to submit order");
      placeOrderMutation.reset(); // Reset mutation state on error
    } finally {
      setIsProcessing(false);
    }
  };

  if (isMarketLoading) {
    return (
      <div className="space-y-4">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to markets
        </Link>
        <div className="text-muted-foreground">Loading market...</div>
        <div className="h-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (marketError || !market) {
    return (
      <div className="space-y-4">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to markets
        </Link>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Market not found</CardTitle>
            <CardDescription>
              {marketError?.message ?? "Unknown error"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Markets
        </Link>
        <span>/</span>
        <span>{market.marketId}</span>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge
                variant={market.resolved ? "secondary" : "default"}
                className="shrink-0"
              >
                {market.resolved ? "Resolved" : "Active"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Created {formatTimestamp(market.createdAt)}
              </span>
            </div>
            <CardTitle className="text-2xl lg:text-3xl mt-2 break-words">
              {market.question}
            </CardTitle>
            <CardDescription className="mt-1 break-all">
              Condition ID: {market.conditionId}
            </CardDescription>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <div className="text-muted-foreground uppercase tracking-wide">
                YES
              </div>
              <div className="text-2xl font-semibold">
                {formatCents(market.yesPrice)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground uppercase tracking-wide">
                NO
              </div>
              <div className="text-2xl font-semibold">
                {formatCents(market.noPrice)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground uppercase tracking-wide">
                Volume 24h
              </div>
              <div className="text-2xl font-semibold">
                {formatSats(market.volume24h)}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Order book</CardTitle>
              <CardDescription>
                Live levels refreshed automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="yes">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="yes">YES</TabsTrigger>
                  <TabsTrigger value="no">NO</TabsTrigger>
                </TabsList>
                <TabsContent value="yes" className="space-y-4 pt-4">
                  <OrderbookTable
                    bids={yesOrderbook?.bids}
                    asks={yesOrderbook?.asks}
                    emptyLabel="No orders for YES yet."
                  />
                </TabsContent>
                <TabsContent value="no" className="space-y-4 pt-4">
                  <OrderbookTable
                    bids={noOrderbook?.bids}
                    asks={noOrderbook?.asks}
                    emptyLabel="No orders for NO yet."
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent trades</CardTitle>
              <CardDescription>
                Executed matches from the matching engine.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Side</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.length ? (
                    trades.map((trade: Trade) => (
                      <TableRow key={trade.tradeId}>
                        <TableCell className="font-medium">
                          {trade.side}
                        </TableCell>
                        <TableCell>{formatCents(trade.price)}</TableCell>
                        <TableCell>{trade.size}</TableCell>
                        <TableCell>
                          {formatTimestamp(trade.timestamp)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground"
                      >
                        No trades yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Place order</CardTitle>
              <CardDescription>
                Submit to the matching engine using live pricing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmitOrder}>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Maker address</label>
                  <Input
                    placeholder="Connect wallet to auto-fill"
                    value={maker}
                    onChange={(event) => setMaker(event.target.value)}
                    disabled={isConnected}
                    required
                  />
                  {!isConnected && (
                    <p className="text-xs text-muted-foreground">
                      Connect your wallet to place signed orders
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Outcome</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(outcomeLabels) as Outcome[]).map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant={outcome === value ? "default" : "outline"}
                        onClick={() => setOutcome(value)}
                      >
                        {outcomeLabels[value]}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Side</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["BUY", "SELL"] as OrderSide[]).map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant={side === value ? "default" : "outline"}
                        onClick={() => setSide(value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Order Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["LIMIT", "MARKET"] as OrderType[]).map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant={orderType === value ? "default" : "outline"}
                        onClick={() => setOrderType(value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {orderType === "LIMIT"
                      ? "Place order at specific price"
                      : "Execute immediately at best available prices"}
                  </p>
                </div>
                {orderType === "LIMIT" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Price (¢)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      required
                    />
                  </div>
                )}
                {orderType === "MARKET" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Max Slippage (%)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={maxSlippage}
                      onChange={(event) => setMaxSlippage(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum acceptable price slippage (default: 5%)
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Size (tokens)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={size}
                    onChange={(event) => setSize(event.target.value)}
                    required
                  />
                </div>

                {executionPreview && executionPreview.feasible && (
                  <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
                    <div className="font-medium">Execution Preview</div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Price:</span>
                      <span>{formatCents(executionPreview.averagePrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Cost:</span>
                      <span>{formatCents(executionPreview.totalCost)}</span>
                    </div>
                    {orderType === "MARKET" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Slippage:
                          </span>
                          <span
                            className={
                              executionPreview.slippage > 2
                                ? "text-orange-500"
                                : ""
                            }
                          >
                            {executionPreview.slippage.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Levels:</span>
                          <span>{executionPreview.levels.length}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {executionPreview && !executionPreview.feasible && orderType === "MARKET" && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                    {executionPreview.reason || "Cannot execute market order"}
                  </div>
                )}

                {executionPreview && !executionPreview.feasible && orderType === "LIMIT" && (
                  <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-3 text-sm">
                    <div className="text-blue-400">💡 No {side === "BUY" ? "sellers" : "buyers"}? Your LIMIT order will provide liquidity until someone matches.</div>
                  </div>
                )}

                {successMessage && (
                  <p className="text-sm text-green-500">{successMessage}</p>
                )}
                {errorMessage && (
                  <p className="text-sm text-destructive">{errorMessage}</p>
                )}
                <Button
                  className="w-full"
                  type="submit"
                  disabled={
                    isProcessing ||
                    placeOrderMutation.isPending ||
                    (orderType === "MARKET" && executionPreview !== null && !executionPreview.feasible)
                  }
                >
                  {isProcessing
                    ? "Processing..."
                    : orderType === "MARKET"
                    ? "Execute Market Order"
                    : "Place Limit Order"}
                </Button>
                {isProcessing && (
                  <p className="text-xs text-muted-foreground text-center">
                    Checking balances and preparing order...
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Oracle feed</CardTitle>
              <CardDescription>
                Pending stats tracked by the backend oracle adapter.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total orders</span>
                <span className="font-semibold">
                  {stats?.totalOrders ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Open orders</span>
                <span className="font-semibold">
                  {stats?.openOrders ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trades</span>
                <span className="font-semibold">
                  {stats?.totalTrades ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last price</span>
                <span className="font-semibold">
                  {formatCents(stats?.lastPrice)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface OrderbookTableProps {
  bids?: OrderbookLevel[];
  asks?: OrderbookLevel[];
  emptyLabel: string;
}

function OrderbookTable({ bids, asks, emptyLabel }: OrderbookTableProps) {
  const hasRows = (bids?.length ?? 0) + (asks?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Asks
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Price</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {asks?.map((level) => (
              <TableRow key={`ask-${level.price}-${level.size}`}>
                <TableCell className="text-red-500">
                  {formatCents(level.price)}
                </TableCell>
                <TableCell>{level.size}</TableCell>
                <TableCell>{level.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Bids
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Price</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bids?.map((level) => (
              <TableRow key={`bid-${level.price}-${level.size}`}>
                <TableCell className="text-green-500">
                  {formatCents(level.price)}
                </TableCell>
                <TableCell>{level.size}</TableCell>
                <TableCell>{level.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!hasRows && (
        <div className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}
