export type OrderSide = 'BUY' | 'SELL'

export type OrderStatus =
  | 'PENDING'
  | 'OPEN'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'EXPIRED'

export interface Market {
  marketId: string
  conditionId: string
  question: string
  creator: string
  yesPositionId: string
  noPositionId: string
  yesPrice: number
  noPrice: number
  volume24h: number
  createdAt: number
  resolved: boolean
  outcome?: number
}

export type MarketDetail = Market

export interface MarketStatsResponse {
  totalOrders: number
  openOrders: number
  totalTrades: number
  volume24h: number
  lastPrice: number
}

export interface OrderbookLevel {
  price: number
  size: number
  orderCount?: number
  total?: number
}

export interface OrderbookSide {
  bids: OrderbookLevel[]
  asks: OrderbookLevel[]
  positionId?: string
}

export interface CombinedOrderbook {
  yes: OrderbookSide & { positionId: string }
  no: OrderbookSide & { positionId: string }
}

export interface OrderbookResponse {
  success: boolean
  market: {
    marketId: string
    question: string
  }
  orderbooks: CombinedOrderbook
  timestamp: number
}

export interface OrderRequest {
  maker: string
  marketId: string
  conditionId?: string
  positionId: string
  side: OrderSide
  price: number
  size: number
  salt?: string
  expiration?: number
  signature?: string
}

export interface OrderResponse {
  success: boolean
  order: {
    orderId: string
    maker: string
    marketId: string
    conditionId: string
    positionId: string
    side: OrderSide
    price: number
    size: number
    filledSize: number
    remainingSize: number
    status: OrderStatus
    salt: string
    expiration: number
    createdAt: number
    updatedAt: number
    signature?: string
  }
}

export interface Trade {
  tradeId: string
  marketId: string
  conditionId: string
  positionId: string
  maker: string
  taker: string
  price: number
  size: number
  side: OrderSide
  makerOrderId: string
  takerOrderId: string
  timestamp: number
  txHash?: string
}

export interface TradeResponse {
  success: boolean
  trades: Trade[]
  count: number
}
