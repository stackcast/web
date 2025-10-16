/**
 * API Module - Clean TanStack Query architecture
 *
 * Structure:
 *   client.ts          - Base HTTP client
 *   queries/
 *     markets.ts       - Market queries & mutations
 *     orderbook.ts     - Orderbook & trades queries
 *     orders.ts        - Order mutations
 */

export * from './queries/markets'
export * from './queries/orderbook'
export * from './queries/orders'
