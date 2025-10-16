import { hexToBytes } from "@stacks/common";
import {
  bufferCV,
  cvToValue,
  fetchCallReadOnlyFunction,
  principalCV,
  type ClarityValue,
} from "@stacks/transactions";
import { CONTRACT_ADDRESSES, stacksNetwork } from "../lib/config";

/**
 * Wait for Stacks transaction confirmation
 * Polls Stacks API until transaction is confirmed or fails
 *
 * @param txId - Transaction ID from contract call
 * @param maxWaitMs - Maximum time to wait (default: 2 minutes)
 * @returns Promise that resolves when tx is confirmed, rejects on failure/timeout
 */
export async function waitForTransactionConfirmation(
  txId: string,
  maxWaitMs: number = 120000
): Promise<{ success: boolean; status: string }> {
  const apiUrl = stacksNetwork.client.baseUrl;
  const startTime = Date.now();
  const pollInterval = 2000; // Poll every 2 seconds

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(`${apiUrl}/extended/v1/tx/${txId}`);

      if (!response.ok) {
        if (response.status === 404) {
          // Transaction not yet in mempool/chain, wait and retry
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          continue;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const tx = await response.json();

      // Check transaction status
      if (tx.tx_status === "success") {
        return { success: true, status: "success" };
      }

      if (
        tx.tx_status === "abort_by_response" ||
        tx.tx_status === "abort_by_post_condition"
      ) {
        return { success: false, status: tx.tx_status };
      }

      // Still pending, wait and retry
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error("Transaction polling error:", error);
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error("Transaction confirmation timeout");
}

/**
 * Check user's position token balance
 *
 * @param userAddress - User's Stacks principal address
 * @param positionId - Position ID (32-byte hex string)
 * @returns Balance in position tokens (in atomic units)
 */
export async function checkPositionBalance(
  userAddress: string,
  positionId: string
): Promise<bigint> {
  try {
    const [contractAddress, contractName] =
      CONTRACT_ADDRESSES.CONDITIONAL_TOKENS.split(".");

    // Convert position ID to Uint8Array (remove 0x prefix if present)
    const cleanPositionId = positionId.replace(/^0x/, "");
    const positionBuffer = hexToBytes(cleanPositionId);

    const result = await fetchCallReadOnlyFunction({
      contractAddress,
      contractName,
      functionName: "balance-of",
      functionArgs: [principalCV(userAddress), bufferCV(positionBuffer)],
      network: stacksNetwork,
      senderAddress: userAddress,
    });

    // Convert Clarity uint to bigint
    const balance = cvToValue(result as ClarityValue);
    return BigInt(balance as string | number | bigint);
  } catch (error) {
    console.error("Error checking position balance:", error);
    return 0n;
  }
}

/**
 * Determine if user needs to split position before placing order
 *
 * @param params.userAddress - User's Stacks principal address
 * @param params.side - Order side ("BUY" or "SELL")
 * @param params.outcome - Outcome being traded ("yes" or "no")
 * @param params.size - Order size in tokens (NOT micro-satoshis)
 * @param params.yesPositionId - YES position ID for this market
 * @param params.noPositionId - NO position ID for this market
 * @returns Object with needsSplit boolean and required position ID
 */
export async function checkIfNeedsSplit(params: {
  userAddress: string;
  side: "BUY" | "SELL";
  outcome: "yes" | "no";
  size: number;
  yesPositionId: string;
  noPositionId: string;
}): Promise<{
  needsSplit: boolean;
  requiredPositionId: string;
  currentBalance: bigint;
  requiredBalance: bigint;
}> {
  const { userAddress, side, outcome, size, yesPositionId, noPositionId } =
    params;

  // Determine which position ID user needs tokens for
  let requiredPositionId: string;

  if (side === "BUY") {
    // To BUY YES, user needs NO tokens (and vice versa)
    requiredPositionId = outcome === "yes" ? noPositionId : yesPositionId;
  } else {
    // To SELL YES, user needs YES tokens (and vice versa)
    requiredPositionId = outcome === "yes" ? yesPositionId : noPositionId;
  }

  // Check user's current balance
  const currentBalance = await checkPositionBalance(
    userAddress,
    requiredPositionId
  );

  // Convert size to atomic units (1 token = 1_000_000 micro-satoshis)
  const requiredBalance = BigInt(Math.floor(size * 1_000_000));

  // User needs to split if balance < required
  const needsSplit = currentBalance < requiredBalance;

  return {
    needsSplit,
    requiredPositionId,
    currentBalance,
    requiredBalance,
  };
}

/**
 * Check how many YES+NO pairs user can merge back to sBTC
 *
 * @param params.userAddress - User's Stacks principal address
 * @param params.yesPositionId - YES position ID for this market
 * @param params.noPositionId - NO position ID for this market
 * @returns Object with mergeable amount and balances
 */
export async function checkMergeablePairs(params: {
  userAddress: string;
  yesPositionId: string;
  noPositionId: string;
}): Promise<{
  mergeableAmount: bigint;
  yesBalance: bigint;
  noBalance: bigint;
}> {
  const { userAddress, yesPositionId, noPositionId } = params;

  // Check both token balances
  const [yesBalance, noBalance] = await Promise.all([
    checkPositionBalance(userAddress, yesPositionId),
    checkPositionBalance(userAddress, noPositionId),
  ]);

  // Mergeable pairs = minimum of both balances
  const mergeableAmount = yesBalance < noBalance ? yesBalance : noBalance;

  return {
    mergeableAmount,
    yesBalance,
    noBalance,
  };
}
