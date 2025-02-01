package main

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// Engine represents the trading engine
type Engine struct {
	mu            sync.RWMutex
	positions     map[string]*Position
	orders        map[string]*Order
	trades        map[string]*Trade
	done          chan struct{}
	errorHandlers []func(error)
}

// Position represents a trading position
type Position struct {
	Symbol        string
	Side          string
	Amount        float64
	AveragePrice  float64
	UnrealizedPnL float64
	RealizedPnL   float64
	LastUpdated   time.Time
}

// NewEngine creates a new trading engine
func NewEngine() (*Engine, error) {
	return &Engine{
		positions:     make(map[string]*Position),
		orders:        make(map[string]*Order),
		trades:        make(map[string]*Trade),
		done:          make(chan struct{}),
		errorHandlers: make([]func(error), 0),
	}, nil
}

// Start starts the trading engine
func (e *Engine) Start(ctx context.Context) error {
	// Start background tasks if needed
	return nil
}

// Stop stops the trading engine
func (e *Engine) Stop() error {
	close(e.done)
	return nil
}

// RegisterErrorHandler registers an error handler function
func (e *Engine) RegisterErrorHandler(handler func(error)) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.errorHandlers = append(e.errorHandlers, handler)
}

// handleError processes an error through all registered handlers
func (e *Engine) handleError(err error) {
	e.mu.RLock()
	handlers := make([]func(error), len(e.errorHandlers))
	copy(handlers, e.errorHandlers)
	e.mu.RUnlock()

	for _, handler := range handlers {
		handler(err)
	}
}

// UpdatePosition updates a position
func (e *Engine) UpdatePosition(position *Position) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	position.LastUpdated = time.Now()
	e.positions[position.Symbol] = position
	return nil
}

// GetPosition gets a position by symbol
func (e *Engine) GetPosition(symbol string) (*Position, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	position, exists := e.positions[symbol]
	if !exists {
		return nil, fmt.Errorf("position not found: %s", symbol)
	}

	return position, nil
}

// ProcessTrade processes a new trade
func (e *Engine) ProcessTrade(trade *Trade) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Store trade
	e.trades[trade.ID] = trade

	// Update position
	position, exists := e.positions[trade.Symbol]
	if !exists {
		position = &Position{
			Symbol:      trade.Symbol,
			LastUpdated: time.Now(),
		}
	}

	// Update position based on trade
	if trade.Side == "buy" {
		position.Amount += trade.Amount
		position.AveragePrice = (position.AveragePrice*position.Amount + trade.Price*trade.Amount) / (position.Amount + trade.Amount)
	} else {
		realizedPnL := (trade.Price - position.AveragePrice) * trade.Amount
		position.RealizedPnL += realizedPnL
		position.Amount -= trade.Amount
	}

	position.LastUpdated = time.Now()
	e.positions[trade.Symbol] = position

	return nil
}

// GetTrade gets a trade by ID
func (e *Engine) GetTrade(id string) (*Trade, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	trade, exists := e.trades[id]
	if !exists {
		return nil, fmt.Errorf("trade not found: %s", id)
	}

	return trade, nil
}
