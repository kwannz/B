package interfaces

import (
	"context"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

// TradingEngine defines the interface for trading operations
type TradingEngine interface {
	// Order Management
	PlaceOrder(ctx context.Context, order *types.Order) error
	CancelOrder(ctx context.Context, orderID string) error
	GetOrder(ctx context.Context, orderID string) (*types.Order, error)
	GetOrders(ctx context.Context) ([]*types.Order, error)

	// Trade Management
	ExecuteTrade(ctx context.Context, trade *types.Trade) error
	GetTrades(ctx context.Context, userID string) ([]*types.Trade, error)

	// Position Management
	GetPosition(ctx context.Context, symbol string) (*types.Position, error)
	GetPositions(ctx context.Context) ([]*types.Position, error)

	// Market Data
	GetOrderBook(ctx context.Context, symbol string) (*types.OrderBook, error)
	SubscribeOrderBook(ctx context.Context, symbol string) (<-chan *types.OrderBook, error)
}
