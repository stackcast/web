import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../client'
import type { Market, MarketDetail, MarketStatsResponse } from '@/types/api'

/**
 * Market Queries - TanStack Query hooks for market data
 */

// Query keys for consistent cache management
export const marketKeys = {
  all: ['markets'] as const,
  lists: () => [...marketKeys.all, 'list'] as const,
  list: () => [...marketKeys.lists()] as const,
  details: () => [...marketKeys.all, 'detail'] as const,
  detail: (id: string) => [...marketKeys.details(), id] as const,
  stats: (id: string) => [...marketKeys.detail(id), 'stats'] as const,
  priceHistory: (id: string, interval: string) => [...marketKeys.detail(id), 'price-history', interval] as const,
}

/**
 * Fetch all markets (auto-refreshes every 5s)
 */
export function useMarkets() {
  return useQuery({
    queryKey: marketKeys.list(),
    queryFn: async () => {
      const data = await apiRequest<{ success: boolean; markets: Market[] }>('/api/markets')
      return data.markets
    },
    refetchInterval: 5000
  })
}

/**
 * Fetch single market detail
 */
export function useMarket(marketId: string) {
  return useQuery({
    queryKey: marketKeys.detail(marketId),
    queryFn: async () => {
      const data = await apiRequest<{ success: boolean; market: MarketDetail }>(
        `/api/markets/${marketId}`
      )
      return data.market
    },
    enabled: Boolean(marketId)
  })
}

/**
 * Fetch market statistics (refreshes every 6s)
 */
export function useMarketStats(marketId: string) {
  return useQuery({
    queryKey: marketKeys.stats(marketId),
    queryFn: async () => {
      const data = await apiRequest<{ success: boolean; stats: MarketStatsResponse }>(
        `/api/markets/${marketId}/stats`
      )
      return data.stats
    },
    enabled: Boolean(marketId),
    refetchInterval: 6000
  })
}

/**
 * Fetch price history for chart (refreshes every 30s)
 */
export function usePriceHistory(marketId: string, interval: '5m' | '15m' | '1h' | '4h' | '1d' = '1h') {
  return useQuery({
    queryKey: marketKeys.priceHistory(marketId, interval),
    queryFn: async () => {
      const data = await apiRequest<{
        success: boolean
        priceHistory: Array<{
          timestamp: number
          yes: {
            open: number
            high: number
            low: number
            close: number
            volume: number
          }
          no: {
            open: number
            high: number
            low: number
            close: number
            volume: number
          }
        }>
        currentPrice: {
          yes: number
          no: number
        }
        interval: string
        dataPoints: number
      }>(
        `/api/markets/${marketId}/price-history?interval=${interval}&limit=100`
      )
      return data
    },
    enabled: Boolean(marketId),
    refetchInterval: 30000 // Refresh every 30 seconds
  })
}

/**
 * Create new market
 */
export function useCreateMarket() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: {
      question: string
      creator: string
      conditionId?: string
    }) => {
      const data = await apiRequest<{ success: boolean; market: MarketDetail }>(
        '/api/markets',
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      )
      return data.market
    },
    onSuccess: () => {
      // Invalidate markets list to refetch
      queryClient.invalidateQueries({ queryKey: marketKeys.list() })
    }
  })
}
