import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../client'
import { orderbookKeys } from './orderbook'
import { marketKeys } from './markets'
import type { SmartOrderRequest, SmartOrderResponse, SmartOrderPreviewRequest, SmartOrderPreviewResponse } from '@/types/api'

/**
 * Order Mutations - TanStack Query hooks for order operations
 */

/**
 * Preview smart order execution (no state change)
 */
export function usePreviewSmartOrder() {
  return useMutation({
    mutationFn: async (payload: SmartOrderPreviewRequest) => {
      return apiRequest<SmartOrderPreviewResponse>('/api/smart-orders/preview', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  })
}

/**
 * Place smart order (LIMIT or MARKET)
 */
export function usePlaceSmartOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SmartOrderRequest) => {
      return apiRequest<SmartOrderResponse>('/api/smart-orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    },
    onSuccess: (_data, variables) => {
      // Invalidate orderbook and stats for this market
      queryClient.invalidateQueries({
        queryKey: orderbookKeys.market(variables.marketId)
      })
      queryClient.invalidateQueries({
        queryKey: marketKeys.stats(variables.marketId)
      })
    }
  })
}

/**
 * Cancel order
 */
export function useCancelOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orderId, maker }: { orderId: string; maker?: string }) => {
      return apiRequest(`/api/orders/${orderId}`, {
        method: 'DELETE',
        body: JSON.stringify({ maker }),
        skipJson: true
      })
    },
    onSuccess: () => {
      // Invalidate all orderbook queries
      queryClient.invalidateQueries({ queryKey: orderbookKeys.all })
    }
  })
}
