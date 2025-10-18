import { openSignatureRequestPopup } from "@stacks/connect";
import {
  serializeCVBytes,
  standardPrincipalCV,
  uintCV,
} from "@stacks/transactions";

/**
 * Compute order hash matching backend/contract implementation
 *
 * Contract implementation (ctf-exchange.clar:46-74):
 * (sha256 (concat
 *   maker + maker-position-id + taker-position-id +
 *   maker-amount + taker-amount + salt + expiration))
 */
export async function computeOrderHash(
  maker: string,
  makerPositionId: string,
  takerPositionId: string,
  makerAmount: number,
  takerAmount: number,
  salt: string,
  expiration: number
): Promise<Uint8Array> {
  // Validate salt is numeric
  if (!/^\d+$/.test(salt)) {
    throw new Error("Salt must be a numeric string");
  }

  // Serialize each field to Clarity consensus buffers (as Uint8Array)
  // Using serializeCVBytes which returns Uint8Array directly
  const makerBuff = serializeCVBytes(standardPrincipalCV(maker));

  // Position IDs should be 32-byte hex strings (64 hex chars)
  const makerPositionIdBuff = hexToBytes(makerPositionId);
  const takerPositionIdBuff = hexToBytes(takerPositionId);

  if (makerPositionIdBuff.length !== 32) {
    throw new Error(
      `Maker position ID must be 32 bytes (64 hex chars), got ${makerPositionIdBuff.length} bytes`
    );
  }
  if (takerPositionIdBuff.length !== 32) {
    throw new Error(
      `Taker position ID must be 32 bytes (64 hex chars), got ${takerPositionIdBuff.length} bytes`
    );
  }

  // uintCV() accepts number/string/bigint and handles conversion internally
  // Using serializeCVBytes which returns Uint8Array directly
  const makerAmountBuff = serializeCVBytes(uintCV(makerAmount));
  const takerAmountBuff = serializeCVBytes(uintCV(takerAmount));
  const saltBuff = serializeCVBytes(uintCV(salt));
  const expirationBuff = serializeCVBytes(uintCV(expiration));

  // Concatenate all buffers in the exact order as the contract
  const concatenated = new Uint8Array(
    makerBuff.length +
      makerPositionIdBuff.length +
      takerPositionIdBuff.length +
      makerAmountBuff.length +
      takerAmountBuff.length +
      saltBuff.length +
      expirationBuff.length
  );

  let offset = 0;
  concatenated.set(makerBuff, offset);
  offset += makerBuff.length;
  concatenated.set(makerPositionIdBuff, offset);
  offset += makerPositionIdBuff.length;
  concatenated.set(takerPositionIdBuff, offset);
  offset += takerPositionIdBuff.length;
  concatenated.set(makerAmountBuff, offset);
  offset += makerAmountBuff.length;
  concatenated.set(takerAmountBuff, offset);
  offset += takerAmountBuff.length;
  concatenated.set(saltBuff, offset);
  offset += saltBuff.length;
  concatenated.set(expirationBuff, offset);

  // Hash with SHA-256 using Web Crypto API
  const hash = await crypto.subtle.digest("SHA-256", concatenated);
  return new Uint8Array(hash);
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/^0x/, "");
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Sign an order using the connected Stacks wallet
 * This uses the Stacks Connect library to request a signature from the user's wallet
 * Returns the signature in RSV format (65 bytes = 130 hex chars)
 */
export async function signOrder(
  maker: string,
  makerPositionId: string,
  takerPositionId: string,
  makerAmount: number,
  takerAmount: number,
  salt: string,
  expiration: number
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    // Compute order hash
  const orderHash = await computeOrderHash(
    maker,
    makerPositionId,
    takerPositionId,
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
      network: import.meta.env.VITE_STACKS_NETWORK || "devnet",
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
  makerPositionId: string;
  takerPositionId: string;
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
