/**
 * ID Generation Utilities for StackCast Prediction Markets (Browser version)
 *
 * Generalized deterministic ID generation using SHA-256 hashing.
 * All IDs are cryptographically derived from their input data.
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@stacks/common';

/**
 * Generate a deterministic ID from a type prefix and input components
 *
 * @param type - The type/namespace of the ID (e.g., 'question', 'market', 'order')
 * @param components - Array of string components to include in the hash
 * @returns 32-byte hex string with 0x prefix
 *
 * @example
 * // Question ID
 * generateId('question', [questionText, creator])
 *
 * // Market ID
 * generateId('market', [questionText, oracle])
 *
 * // Order ID
 * generateId('order', [maker, taker, positionId, amount.toString(), timestamp.toString()])
 */
export function generateId(type: string, components: string[]): string {
  const data = `${type}:${components.join(':')}`;
  const encoder = new TextEncoder();
  const hash = sha256(encoder.encode(data));
  return '0x' + bytesToHex(hash);
}

/**
 * Generate a composite ID by hashing multiple parts together
 * Used for more complex ID generation like condition IDs
 *
 * @param parts - Array of Uint8Arrays or strings to concatenate and hash
 * @returns 32-byte hex string with 0x prefix
 *
 * @example
 * // Condition ID: hash(oracle + questionId + outcomeCount)
 * generateCompositeId([
 *   oracleAddress,
 *   hexToBytes(questionIdHex),
 *   outcomeCount.toString()
 * ])
 */
export function generateCompositeId(parts: (Uint8Array | string | number)[]): string {
  const encoder = new TextEncoder();

  // Convert all parts to Uint8Array
  const converted = parts.map(part => {
    if (part instanceof Uint8Array) {
      return part;
    } else if (typeof part === 'string') {
      return encoder.encode(part);
    } else if (typeof part === 'number') {
      return encoder.encode(part.toString());
    } else {
      throw new Error('Invalid part type, must be Uint8Array, string, or number');
    }
  });

  // Calculate total length
  const totalLength = converted.reduce((sum, bytes) => sum + bytes.length, 0);

  // Concatenate all parts
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const bytes of converted) {
    combined.set(bytes, offset);
    offset += bytes.length;
  }

  const hash = sha256(combined);
  return '0x' + bytesToHex(hash);
}

/**
 * Helper to convert hex string to bytes (handles 0x prefix)
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Helper to convert bytes to hex string
 */
export function toHex(bytes: Uint8Array): string {
  return '0x' + bytesToHex(bytes);
}
