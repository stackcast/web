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
  makerPositionId?: string // Optional - server derives from market if not provided
  takerPositionId?: string // Optional - server derives from market if not provided
  side: OrderSide
  price: number
  size: number
  salt?: string
  expiration?: number
  signature?: string
  publicKey?: string // Required for signature verification
}

export interface OrderResponse {
  success: boolean
  order: {
    orderId: string
    maker: string
    marketId: string
    conditionId: string
    makerPositionId: string
    takerPositionId: string
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
    publicKey?: string
  }
}

export interface Trade {
  tradeId: string
  marketId: string
  conditionId: string
  makerPositionId: string
  takerPositionId: string
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

export type OrderType = 'LIMIT' | 'MARKET'

export interface ExecutionLevel {
  price: number
  size: number
  cumulativeSize: number
  cost: number
}

export interface ExecutionPlan {
  orderType: OrderType
  totalSize: number
  levels: ExecutionLevel[]
  averagePrice: number
  totalCost: number
  slippage: number
  worstPrice: number
  bestPrice: number
  feasible: boolean
  reason?: string
}

export interface SmartOrderRequest {
  maker: string
  marketId: string
  outcome: 'yes' | 'no'
  side: OrderSide
  orderType: OrderType
  size: number
  price?: number
  maxSlippage?: number
  salt?: string
  expiration?: number
  signature?: string
  publicKey?: string
}

export interface SmartOrderPreviewRequest {
  marketId: string
  outcome: 'yes' | 'no'
  side: OrderSide
  orderType: OrderType
  size: number
  price?: number
  maxSlippage?: number
}

export interface SmartOrderPreviewResponse {
  success: boolean
  plan: ExecutionPlan
}

export interface SmartOrderResponse {
  success: boolean
  orderType: OrderType
  order?: {
    orderId: string
    marketId: string
    side: OrderSide
    outcome: string
    price: number
    size: number
    status: OrderStatus
  }
  orders?: Array<{
    orderId: string
    price: number
    size: number
  }>
  executionPlan?: {
    averagePrice: number
    totalCost: number
    slippage: number
    levels: number
  }
  message: string
  requiresSignature?: boolean
  plan?: ExecutionPlan
}
