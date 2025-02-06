package storage

import (
	"context"
	"sync"

	"github.com/shopspring/decimal"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type MemoryStorage struct {
	mu        sync.RWMutex
	positions map[string]*types.Position
	trades    map[string][]*types.Trade
	orders    map[string]*types.Order
}

func (s *MemoryStorage) GetOrder(orderID string) (*types.Order, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.orders[orderID], nil
}

func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{
		positions: make(map[string]*types.Position),
		trades:    make(map[string][]*types.Trade),
		orders:    make(map[string]*types.Order),
	}
}

func (s *MemoryStorage) SavePosition(position *types.Position) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.positions[position.Symbol] = position
	return nil
}

func (s *MemoryStorage) GetPosition(symbol string) (*types.Position, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.positions[symbol], nil
}

func (s *MemoryStorage) SaveTrade(trade *types.Trade) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.trades[trade.Symbol] = append(s.trades[trade.Symbol], trade)
	return nil
}

func (s *MemoryStorage) GetTrades(symbol string) ([]*types.Trade, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.trades[symbol], nil
}

func (s *MemoryStorage) GetPositions(userID string) ([]*types.Position, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	var positions []*types.Position
	for _, pos := range s.positions {
		if pos.UserID == userID {
			positions = append(positions, pos)
		}
	}
	return positions, nil
}

func (s *MemoryStorage) UpdatePosition(ctx context.Context, symbol string, size, price decimal.Decimal) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	position, exists := s.positions[symbol]
	if !exists {
		position = types.NewPosition(symbol, size, price)
		s.positions[symbol] = position
		return nil
	}
	
	position.Size = size
	position.EntryPrice = price
	return nil
}

func (s *MemoryStorage) GetOrders(userID string) ([]*types.Order, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	var orders []*types.Order
	for _, order := range s.orders {
		if order.UserID == userID {
			orders = append(orders, order)
		}
	}
	return orders, nil
}

func (s *MemoryStorage) SaveOrder(order *types.Order) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.orders[order.ID] = order
	return nil
}
