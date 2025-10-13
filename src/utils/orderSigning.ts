import { hashMessage } from "@stacks/encryption";
import { openSignatureRequestPopup } from "@stacks/connect";

/**
 * Compute order hash matching backend/contract implementation
 */
export function computeOrderHash(
  maker: string,
  taker: string,
  positionId: string,
  makerAmount: number,
  takerAmount: number,
  salt: string,
  expiration: number
): Uint8Array {
  // Create a deterministic order message
  // This should match the backend's computeOrderHash function
  const orderMessage = JSON.stringify({
    maker,
    taker,
    positionId,
    makerAmount,
    takerAmount,
    salt,
    expiration,
  });

  // Hash the message using Stacks' hashMessage function
  return hashMessage(orderMessage);
}

/**
 * Sign an order using the connected Stacks wallet
 * This uses the Stacks Connect library to request a signature from the user's wallet
 * Returns the signature in RSV format (65 bytes = 130 hex chars)
 */
export function signOrder(
  maker: string,
  taker: string,
  positionId: string,
  makerAmount: number,
  takerAmount: number,
  salt: string,
  expiration: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Compute order hash
    const orderHash = computeOrderHash(
      maker,
      taker,
      positionId,
      makerAmount,
      takerAmount,
      salt,
      expiration
    );

    // Convert Uint8Array to hex string for signing
    const hashHex = Array.from(orderHash)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Request signature from user's wallet using Stacks Connect
    const signatureRequest = {
      message: hashHex,
      network: import.meta.env.VITE_STACKS_NETWORK || "testnet",
      onFinish: (data: any) => {
        resolve(data.signature);
      },
      onCancel: () => {
        reject(new Error("User cancelled signature request"));
      },
    };

    try {
      openSignatureRequestPopup(signatureRequest);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Format order parameters for signing
 */
export interface OrderSigningParams {
  maker: string;
  positionId: string;
  size: number;
  price: number;
  salt?: string;
  expiration?: number;
}

/**
 * Generate a salt for order uniqueness
 */
export function generateSalt(): string {
  return Date.now().toString();
}

/**
 * Calculate expiration block height (hoursFromNow * 6 blocks per hour)
 * Stacks blocks are ~10 minutes, so ~6 blocks per hour
 */
export function calculateExpiration(_hoursFromNow: number = 1): number {
  // In production, this should fetch current block height and add (hoursFromNow * 6) blocks
  // For now, use a high number as a placeholder
  return 999999999;
}
