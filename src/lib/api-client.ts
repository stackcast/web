import { apiBaseUrl } from '@/lib/config'
import type {
  CombinedOrderbook,
  Market,
  MarketDetail,
  MarketStatsResponse,
  OrderRequest,
  OrderResponse,
  OrderbookResponse,
  TradeResponse
} from '@/types/api'

interface RequestOptions extends RequestInit {
  skipJson?: boolean
}

async function request<T>(path: string, { skipJson, ...init }: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {})
    },
    ...init
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed with status ${response.status}`)
  }

  if (skipJson) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const api = {
  getMarkets: (signal?: AbortSignal) =>
    request<{ success: boolean; markets: Market[] }>('/api/markets', { signal }),
  getMarket: (marketId: string, signal?: AbortSignal) =>
    request<{ success: boolean; market: MarketDetail }>(`/api/markets/${marketId}`, { signal }),
  getMarketStats: (marketId: string, signal?: AbortSignal) =>
    request<{ success: boolean; stats: MarketStatsResponse }>(`/api/markets/${marketId}/stats`, { signal }),
  createMarket: (payload: { question: string; creator: string; conditionId?: string }, signal?: AbortSignal) =>
    request<{ success: boolean; market: MarketDetail }>('/api/markets', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
    }),
  getOrderbook: (marketId: string, positionId?: string, signal?: AbortSignal) => {
    const suffix = positionId ? `?positionId=${encodeURIComponent(positionId)}` : ''
    return request<OrderbookResponse>(`/api/orderbook/${marketId}${suffix}`, { signal })
  },
  placeOrder: (payload: OrderRequest, signal?: AbortSignal) =>
    request<OrderResponse>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
    }),
  cancelOrder: (orderId: string, maker?: string, signal?: AbortSignal) =>
    request(`/api/orders/${orderId}`, {
      method: 'DELETE',
      body: JSON.stringify({ maker }),
      signal,
      skipJson: true
    }),
  getTrades: (marketId: string, limit = 20, signal?: AbortSignal) =>
    request<TradeResponse>(`/api/orderbook/${marketId}/trades?limit=${limit}`, { signal }),
  getOrderbookSnapshot: async (marketId: string, signal?: AbortSignal) => {
    const response = await api.getOrderbook(marketId, undefined, signal)
    return response.orderbooks as CombinedOrderbook
  }
}
