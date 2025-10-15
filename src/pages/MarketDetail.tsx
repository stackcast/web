import type { FormEvent } from 'react'
import { useMemo, useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApiQuery } from '@/hooks/use-api'
import { api } from '@/lib/api-client'
import { useWallet } from '@/contexts/WalletContext'
import { computeOrderHash, generateSalt, calculateExpiration } from '@/utils/orderSigning'
import type { CombinedOrderbook, OrderSide, OrderbookLevel, Trade } from '@/types/api'

type Outcome = 'yes' | 'no'

const formatCents = (value?: number) =>
  typeof value === 'number' ? `${value.toFixed(2)}¢` : '—'

const formatSats = (value?: number) =>
  typeof value === 'number' ? `${value.toFixed(4)} sBTC` : '—'

const formatTimestamp = (timestamp?: number) =>
  timestamp ? new Date(timestamp).toLocaleString() : '—'

const withCumulativeTotals = (levels: OrderbookLevel[] = []) => {
  let cumulative = 0
  return levels.map((level) => {
    cumulative += level.size
    return { ...level, total: cumulative }
  })
}

const outcomeLabels: Record<Outcome, string> = {
  yes: 'YES',
  no: 'NO'
}

export function MarketDetail() {
  const { marketId = '' } = useParams()
  const { isConnected, userData, signMessage } = useWallet()
  const [maker, setMaker] = useState('')
  const [side, setSide] = useState<OrderSide>('BUY')
  const [outcome, setOutcome] = useState<Outcome>('yes')
  const [price, setPrice] = useState('')
  const [size, setSize] = useState('')
  const [errorMessage, setErrorMessage] = useState<string>()
  const [successMessage, setSuccessMessage] = useState<string>()

  // Auto-fill maker address from connected wallet
  useEffect(() => {
    if (isConnected && userData?.addresses?.stx?.[0]?.address) {
      setMaker(userData.addresses.stx[0].address)
    } else {
      setMaker('')
    }
  }, [isConnected, userData])

  const marketQuery = useApiQuery(
    `market-${marketId}`,
    (signal) => api.getMarket(marketId, signal),
    { enabled: Boolean(marketId) }
  )

  const market = marketQuery.data?.market

  const statsQuery = useApiQuery(
    `market-stats-${marketId}`,
    (signal) => api.getMarketStats(marketId, signal),
    { enabled: Boolean(marketId), refreshIntervalMs: 5000 }
  )

  const orderbookQuery = useApiQuery(
    `market-orderbook-${marketId}`,
    (signal) => api.getOrderbook(marketId, undefined, signal),
    { enabled: Boolean(marketId), refreshIntervalMs: 4000 }
  )

  const tradesQuery = useApiQuery(
    `market-trades-${marketId}`,
    (signal) => api.getTrades(marketId, 12, signal),
    { enabled: Boolean(marketId), refreshIntervalMs: 6000 }
  )

  const combinedOrderbook: CombinedOrderbook | undefined = orderbookQuery.data?.orderbooks

  const yesOrderbook = useMemo(
    () =>
      combinedOrderbook
        ? {
            bids: withCumulativeTotals(combinedOrderbook.yes.bids),
            asks: withCumulativeTotals(combinedOrderbook.yes.asks)
          }
        : undefined,
    [combinedOrderbook]
  )

  const noOrderbook = useMemo(
    () =>
      combinedOrderbook
        ? {
            bids: withCumulativeTotals(combinedOrderbook.no.bids),
            asks: withCumulativeTotals(combinedOrderbook.no.asks)
          }
        : undefined,
    [combinedOrderbook]
  )

  const positionIdForOutcome = outcome === 'yes' ? market?.yesPositionId : market?.noPositionId

  const onSubmitOrder = async (event: FormEvent) => {
    event.preventDefault()
    if (!market) return

    // Check wallet connection
    if (!isConnected) {
      setErrorMessage('Please connect your wallet to place orders.')
      setSuccessMessage(undefined)
      return
    }

    const numericPrice = Number(price)
    const numericSize = Number(size)

    if (!maker || Number.isNaN(numericPrice) || Number.isNaN(numericSize)) {
      setErrorMessage('Please provide maker address, price, and size.')
      setSuccessMessage(undefined)
      return
    }

    if (!positionIdForOutcome) {
      setErrorMessage('Unable to resolve position id for outcome.')
      setSuccessMessage(undefined)
      return
    }

    try {
      setErrorMessage(undefined)

      // Generate order parameters
      const salt = generateSalt()
      const expiration = calculateExpiration(1) // 1 hour from now
      const takerAmount = numericSize * numericPrice // Calculate taker amount

      // Compute order hash for signing
      const orderHash = computeOrderHash(
        maker,
        maker, // Use maker as taker for limit orders
        positionIdForOutcome,
        numericSize,
        takerAmount,
        salt,
        expiration
      )

      // Convert Uint8Array to hex string
      const orderHashHex = Array.from(orderHash)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      // Sign the order hash with wallet (returns signature + publicKey)
      const signResult = await signMessage(orderHashHex)

      // Submit order with signature and publicKey for verification
      await api.placeOrder({
        maker,
        marketId: market.marketId,
        conditionId: market.conditionId,
        positionId: positionIdForOutcome,
        side,
        price: numericPrice,
        size: numericSize,
        salt,
        expiration,
        signature: signResult.signature,
        publicKey: signResult.publicKey
      })

      setSuccessMessage(`Order submitted for ${outcomeLabels[outcome]} ${side}`)
      setPrice('')
      setSize('')
      await Promise.all([orderbookQuery.refetch(), statsQuery.refetch(), tradesQuery.refetch()])
    } catch (err) {
      setSuccessMessage(undefined)
      setErrorMessage((err as Error).message || 'Failed to submit order')
    }
  }

  if (marketQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (marketQuery.error || !market) {
    return (
      <div className="space-y-4">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to markets
        </Link>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Market not found</CardTitle>
            <CardDescription>{marketQuery.error?.message ?? 'Unknown error'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
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
          <div>
            <div className="flex items-center gap-3">
              <Badge variant={market.resolved ? 'secondary' : 'default'}>
                {market.resolved ? 'Resolved' : 'Active'}
              </Badge>
              <span className="text-xs text-muted-foreground">Created {formatTimestamp(market.createdAt)}</span>
            </div>
            <CardTitle className="text-2xl lg:text-3xl mt-2">{market.question}</CardTitle>
            <CardDescription className="mt-1">Condition ID: {market.conditionId}</CardDescription>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <div className="text-muted-foreground uppercase tracking-wide">YES</div>
              <div className="text-2xl font-semibold">{formatCents(market.yesPrice)}</div>
            </div>
            <div>
              <div className="text-muted-foreground uppercase tracking-wide">NO</div>
              <div className="text-2xl font-semibold">{formatCents(market.noPrice)}</div>
            </div>
            <div>
              <div className="text-muted-foreground uppercase tracking-wide">Volume 24h</div>
              <div className="text-2xl font-semibold">{formatSats(market.volume24h)}</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Order book</CardTitle>
              <CardDescription>Live levels refreshed automatically.</CardDescription>
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
              <CardDescription>Executed matches from the matching engine.</CardDescription>
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
                  {tradesQuery.data?.trades?.length ? (
                    tradesQuery.data.trades.map((trade: Trade) => (
                      <TableRow key={trade.tradeId}>
                        <TableCell className="font-medium">{trade.side}</TableCell>
                        <TableCell>{formatCents(trade.price)}</TableCell>
                        <TableCell>{trade.size}</TableCell>
                        <TableCell>{formatTimestamp(trade.timestamp)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
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
              <CardDescription>Submit to the matching engine using live pricing.</CardDescription>
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
                        variant={outcome === value ? 'default' : 'outline'}
                        onClick={() => setOutcome(value)}
                      >
                        {outcomeLabels[value]}
                      </Button>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Position id: {outcome === 'yes' ? market.yesPositionId : market.noPositionId}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Side</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['BUY', 'SELL'] as OrderSide[]).map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant={side === value ? 'default' : 'outline'}
                        onClick={() => setSide(value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>
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
                {successMessage && <p className="text-sm text-green-500">{successMessage}</p>}
                {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
                <Button className="w-full" type="submit" disabled={orderbookQuery.isLoading}>
                  Submit order
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Oracle feed</CardTitle>
              <CardDescription>Pending stats tracked by the backend oracle adapter.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total orders</span>
                <span className="font-semibold">{statsQuery.data?.stats.totalOrders ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Open orders</span>
                <span className="font-semibold">{statsQuery.data?.stats.openOrders ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trades</span>
                <span className="font-semibold">{statsQuery.data?.stats.totalTrades ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Last price</span>
                <span className="font-semibold">{formatCents(statsQuery.data?.stats.lastPrice)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

interface OrderbookTableProps {
  bids?: OrderbookLevel[]
  asks?: OrderbookLevel[]
  emptyLabel: string
}

function OrderbookTable({ bids, asks, emptyLabel }: OrderbookTableProps) {
  const hasRows = (bids?.length ?? 0) + (asks?.length ?? 0) > 0

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">Asks</div>
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
                <TableCell className="text-red-500">{formatCents(level.price)}</TableCell>
                <TableCell>{level.size}</TableCell>
                <TableCell>{level.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-muted-foreground">Bids</div>
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
                <TableCell className="text-green-500">{formatCents(level.price)}</TableCell>
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
  )
}
