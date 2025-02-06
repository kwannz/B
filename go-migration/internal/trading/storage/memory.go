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

func (s *MemoryStorage) GetOrder(ctx context.Context, orderID string) (*types.Order, error) {
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

func (s *MemoryStorage) SavePosition(ctx context.Context, position *types.Position) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.positions[position.Symbol] = position
	return nil
}

func (s *MemoryStorage) GetPosition(ctx context.Context, symbol string) (*types.Position, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.positions[symbol], nil
}

func (s *MemoryStorage) SaveTrade(ctx context.Context, trade *types.Trade) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.trades[trade.Symbol] = append(s.trades[trade.Symbol], trade)
	return nil
}

func (s *MemoryStorage) GetTrades(ctx context.Context, symbol string) ([]*types.Trade, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.trades[symbol], nil
}

func (s *MemoryStorage) GetAllPositions(ctx context.Context) (map[string]*types.Position, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	positions := make(map[string]*types.Position)
	for k, v := range s.positions {
		positions[k] = v
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
