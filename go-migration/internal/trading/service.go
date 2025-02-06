package trading

import (
	"context"

	"github.com/shopspring/decimal"
	"github.com/kwanRoshi/B/go-migration/internal/types"
	"go.uber.org/zap"
)

// Service implements the TradingEngine interface for WebSocket server
type Service struct {
	engine *Engine
	logger *zap.Logger
}

// NewService creates a new trading service
func NewService(engine *Engine, logger *zap.Logger) *Service {
	return &Service{
		engine: engine,
		logger: logger,
	}
}

// PlaceOrder implements TradingEngine interface
func (s *Service) PlaceOrder(ctx context.Context, order *types.Order) error {
	return s.engine.PlaceOrder(ctx, order)
}

// CancelOrder implements TradingEngine interface
func (s *Service) CancelOrder(ctx context.Context, orderID string) error {
	return s.engine.CancelOrder(ctx, orderID)
}

// GetOrder implements TradingEngine interface
func (s *Service) GetOrder(ctx context.Context, orderID string) (*types.Order, error) {
	return s.engine.GetOrder(ctx, orderID)
}

// GetOrders implements TradingEngine interface
func (s *Service) GetOrders(ctx context.Context, userID string) ([]*types.Order, error) {
	return s.engine.GetOrders(ctx)
}

// ExecuteTrade implements TradingEngine interface
func (s *Service) ExecuteTrade(ctx context.Context, trade *types.Trade) error {
	return s.engine.ProcessSignal(ctx, &types.Signal{
		Provider:   trade.Provider,
		Symbol:     trade.Symbol,
		Type:       types.SignalType(trade.Side),
		Size:       trade.Size,
		Price:      trade.Price,
		Timestamp:  trade.Timestamp,
	})
}

// GetTrades implements TradingEngine interface
func (s *Service) GetTrades(ctx context.Context, userID string) ([]*types.Trade, error) {
	return nil, nil // TODO: Implement get trades
}

// GetPosition implements TradingEngine interface
func (s *Service) GetPosition(ctx context.Context, userID, symbol string) (*types.Position, error) {
	return s.engine.GetPosition(ctx, symbol)
}

// GetPositions implements TradingEngine interface
func (s *Service) GetPositions(ctx context.Context, userID string) ([]*types.Position, error) {
	return s.engine.GetPositions(ctx)
}

// GetOrderBook implements TradingEngine interface
func (s *Service) GetOrderBook(ctx context.Context, symbol string) (*OrderBook, error) {
	return nil, nil // TODO: Implement get order book
}

// SubscribeOrderBook implements TradingEngine interface
func (s *Service) SubscribeOrderBook(ctx context.Context, symbol string) (<-chan *OrderBook, error) {
	updates := make(chan *OrderBook)
	// TODO: Implement order book subscription
	return updates, nil
}
