import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../client'
import { orderbookKeys } from './orderbook'
import { marketKeys } from './markets'
import type {
  OrderSide,
  OrderbookLevel,
  OrderbookResponse,
  SmartOrderRequest,
  SmartOrderResponse,
  SmartOrderPreviewRequest,
  SmartOrderPreviewResponse,
} from '@/types/api'

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
    onSuccess: (data, variables) => {
      if (data.order) {
        const order = data.order
        // Optimistically reflect the new limit order in the cached orderbook
        queryClient.setQueryData(
          orderbookKeys.market(variables.marketId),
          (previous: OrderbookResponse | undefined) => {
            if (!previous?.orderbooks) return previous

            const outcome = order.outcome === 'yes' ? 'yes' : 'no'
            const bookKey = determineOrderbookKey(order.side, outcome)
            const currentBook = previous.orderbooks[bookKey]
            if (!currentBook) return previous

            const updatedLevels = upsertOrderbookLevel(
              order.side === 'BUY' ? currentBook.bids : currentBook.asks,
              order.price,
              order.size,
              order.side,
            )

            return {
              ...previous,
              orderbooks: {
                ...previous.orderbooks,
                [bookKey]: {
                  ...currentBook,
                  bids: order.side === 'BUY' ? updatedLevels : currentBook.bids,
                  asks: order.side === 'SELL' ? updatedLevels : currentBook.asks,
                },
              },
              timestamp: Date.now(),
            }
          },
        )
      }

      // Invalidate orderbook and stats for this market
      queryClient.invalidateQueries({
        queryKey: orderbookKeys.market(variables.marketId)
      })
      queryClient.invalidateQueries({
        queryKey: marketKeys.stats(variables.marketId)
      })
      queryClient.invalidateQueries({
        queryKey: orderbookKeys.trades(variables.marketId)
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

type OrderbookKey = 'yes' | 'no'

function determineOrderbookKey(side: OrderSide, outcome: 'yes' | 'no'): OrderbookKey {
  const routesToNoBook =
    (side === 'BUY' && outcome === 'yes') ||
    (side === 'SELL' && outcome === 'no')

  return routesToNoBook ? 'no' : 'yes'
}

function upsertOrderbookLevel(
  levels: OrderbookLevel[] = [],
  price: number,
  sizeDelta: number,
  side: OrderSide
): OrderbookLevel[] {
  const next = levels.map((level) => ({
    price: level.price,
    size: level.size,
    orderCount: level.orderCount,
  }))

  const index = next.findIndex((level) => level.price === price)
  if (index >= 0) {
    const level = next[index]
    next[index] = {
      price,
      size: level.size + sizeDelta,
      orderCount: (level.orderCount ?? 0) + 1,
    }
  } else {
    next.push({
      price,
      size: sizeDelta,
      orderCount: 1,
    })
  }

  next.sort((a, b) => (side === 'BUY' ? b.price - a.price : a.price - b.price))
  return next
}
