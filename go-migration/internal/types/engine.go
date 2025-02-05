package types

import (
	"context"
	"time"

	"github.com/shopspring/decimal"
)

type OrderSide string

const (
	OrderSideBuy  OrderSide = "buy"
	OrderSideSell OrderSide = "sell"
)

type OrderType string

const (
	OrderTypeMarket     OrderType = "market"
	OrderTypeLimit      OrderType = "limit"
	OrderTypeTakeProfit OrderType = "take_profit"
	OrderTypeStopLoss   OrderType = "stop_loss"
)

type OrderStatus string

const (
	OrderStatusNew      OrderStatus = "new"
	OrderStatusPartial  OrderStatus = "partial"
	OrderStatusFilled   OrderStatus = "filled"
	OrderStatusCanceled OrderStatus = "canceled"
	OrderStatusRejected OrderStatus = "rejected"
)

type TradeParams struct {
	Symbol    string          `json:"symbol"`
	Side      OrderSide       `json:"side"`
	Size      decimal.Decimal `json:"size"`
	Price     decimal.Decimal `json:"price"`
	APIKey    string          `json:"api_key"`
	Timestamp time.Time       `json:"timestamp"`
}

type TradingEngine interface {
	ExecuteTrade(ctx context.Context, params *TradeParams) error
	GetPosition(ctx context.Context, symbol string) (*Position, error)
	GetPositions(ctx context.Context) ([]*Position, error)
	GetTrade(ctx context.Context, tradeID string) (*Trade, error)
	GetTrades(ctx context.Context, symbol string) ([]*Trade, error)
	CancelTrade(ctx context.Context, tradeID string) error
	UpdatePosition(ctx context.Context, position *Position) error
}
