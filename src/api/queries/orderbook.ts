import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../client'
import type { OrderbookResponse, TradeResponse } from '@/types/api'

/**
 * Orderbook Queries - TanStack Query hooks for orderbook and trades
 */

// Query keys
export const orderbookKeys = {
  all: ['orderbook'] as const,
  market: (marketId: string) => [...orderbookKeys.all, marketId] as const,
  trades: (marketId: string) => [...orderbookKeys.market(marketId), 'trades'] as const,
}

/**
 * Fetch orderbook for market (refreshes every 4s)
 */
export function useOrderbook(marketId: string, positionId?: string) {
  return useQuery({
    queryKey: positionId
      ? [...orderbookKeys.market(marketId), positionId]
      : orderbookKeys.market(marketId),
    queryFn: async () => {
      const suffix = positionId ? `?positionId=${encodeURIComponent(positionId)}` : ''
      return apiRequest<OrderbookResponse>(`/api/orderbook/${marketId}${suffix}`)
    },
    enabled: Boolean(marketId),
    refetchInterval: 4000 // Auto-refresh every 4s
  })
}

/**
 * Fetch recent trades for market (refreshes every 6s)
 */
export function useTrades(marketId: string, limit = 20) {
  return useQuery({
    queryKey: [...orderbookKeys.trades(marketId), limit],
    queryFn: async () => {
      const data = await apiRequest<TradeResponse>(
        `/api/orderbook/${marketId}/trades?limit=${limit}`
      )
      return data.trades
    },
    enabled: Boolean(marketId),
    refetchInterval: 6000 // Auto-refresh every 6s
  })
}
