package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// TradeServer represents the trading server
type TradeServer struct {
	mu       sync.RWMutex
	trades   map[string]*Trade
	orders   map[string]*Order
	done     chan struct{}
}

// Trade represents a trade record
type Trade struct {
	ID        string
	Symbol    string
	Side      string
	Amount    float64
	Price     float64
	Timestamp time.Time
}

// Order represents an order record
type Order struct {
	ID            string
	Symbol        string
	Side          string
	Amount        float64
	Price         float64
	FilledAmount  float64
	Status        string
	CreatedAt     time.Time
	LastUpdatedAt time.Time
}

// NewTradeServer creates a new trade server
func NewTradeServer() (*TradeServer, error) {
	return &TradeServer{
		trades: make(map[string]*Trade),
		orders: make(map[string]*Order),
		done:   make(chan struct{}),
	}, nil
}

// Start starts the trade server
func (s *TradeServer) Start(ctx context.Context) error {
	// Start background tasks if needed
	return nil
}

// Stop stops the trade server
func (s *TradeServer) Stop() error {
	close(s.done)
	return nil
}

// RecordTrade records a new trade
func (s *TradeServer) RecordTrade(trade *Trade) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.trades[trade.ID] = trade
	return nil
}

// GetTrade gets a trade by ID
func (s *TradeServer) GetTrade(id string) (*Trade, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	trade, exists := s.trades[id]
	if !exists {
		return nil, fmt.Errorf("trade not found: %s", id)
	}

	return trade, nil
}

// CreateOrder creates a new order
func (s *TradeServer) CreateOrder(order *Order) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.orders[order.ID] = order
	return nil
}

// UpdateOrder updates an existing order
func (s *TradeServer) UpdateOrder(order *Order) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.orders[order.ID]; !exists {
		return fmt.Errorf("order not found: %s", order.ID)
	}

	order.LastUpdatedAt = time.Now()
	s.orders[order.ID] = order
	return nil
}

// GetOrder gets an order by ID
func (s *TradeServer) GetOrder(id string) (*Order, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	order, exists := s.orders[id]
	if !exists {
		return nil, fmt.Errorf("order not found: %s", id)
	}

	return order, nil
}
