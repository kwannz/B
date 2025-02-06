package trading

import (
	"context"
	"fmt"
	"sync"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/trading/executor"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

// Engine manages trading operations
type Engine struct {
	logger     *zap.Logger
	config     Config
	storage    Storage
	positions  map[string]*types.Position
	orders     map[string]*types.Order
	strategies map[string]Strategy
	executors  map[string]executor.TradingExecutor
	mu         sync.RWMutex
	totalValue float64
}

func (e *Engine) RegisterExecutor(name string, exec executor.TradingExecutor) {
	e.mu.Lock()
	defer e.mu.Unlock()
	
	if e.executors == nil {
		e.executors = make(map[string]executor.TradingExecutor)
	}
	e.executors[name] = exec
}

func (e *Engine) RegisterStrategy(strategy Strategy) {
	e.mu.Lock()
	defer e.mu.Unlock()
	
	if e.strategies == nil {
		e.strategies = make(map[string]Strategy)
	}
	e.strategies[strategy.Name()] = strategy
}

func (e *Engine) ProcessSignal(ctx context.Context, signal *types.Signal) error {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if signal.Provider == "" {
		return fmt.Errorf("signal provider not specified")
	}

	executor, ok := e.executors[signal.Provider]
	if !ok {
		return fmt.Errorf("executor %s not found", signal.Provider)
	}

	if err := executor.ExecuteTrade(ctx, signal); err != nil {
		return fmt.Errorf("failed to execute trade: %w", err)
	}

	return nil
}

// NewEngine creates a new trading engine
func NewEngine(config Config, logger *zap.Logger, storage Storage) *Engine {
	return &Engine{
		logger:     logger,
		config:     config,
		storage:    storage,
		positions:  make(map[string]*types.Position),
		orders:     make(map[string]*types.Order),
		strategies: make(map[string]Strategy),
		executors:  make(map[string]executor.TradingExecutor),
		totalValue: 0,
	}
}

func (e *Engine) GetTotalValue() float64 {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.totalValue
}

// PlaceOrder places a new order
func (e *Engine) PlaceOrder(order *types.Order) error {
	// Validate order
	if err := e.validateOrder(order); err != nil {
		return err
	}

	// Store order
	e.mu.Lock()
	e.orders[order.ID] = order
	e.mu.Unlock()

	return e.storage.SaveOrder(order)
}

// CancelOrder cancels an existing order
func (e *Engine) CancelOrder(orderID string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	order, exists := e.orders[orderID]
	if !exists {
		return fmt.Errorf("order not found: %s", orderID)
	}

	order.Status = types.OrderStatusCanceled
	delete(e.orders, orderID)

	return e.storage.SaveOrder(order)
}

// GetOrder returns an order by ID
func (e *Engine) GetOrder(orderID string) (*types.Order, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	order, exists := e.orders[orderID]
	if !exists {
		return nil, fmt.Errorf("order not found: %s", orderID)
	}
	return order, nil
}

// GetOrders returns all orders for a user
func (e *Engine) GetOrders(userID string) ([]*types.Order, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var orders []*types.Order
	for _, order := range e.orders {
		if order.UserID == userID {
			orders = append(orders, order)
		}
	}
	return orders, nil
}

// GetPosition returns current position for a symbol
func (e *Engine) GetPosition(symbol string) *types.Position {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.positions[symbol]
}

// GetPositions returns all current positions
func (e *Engine) GetPositions() []*types.Position {
	e.mu.RLock()
	defer e.mu.RUnlock()

	positions := make([]*types.Position, 0, len(e.positions))
	for _, pos := range e.positions {
		positions = append(positions, pos)
	}
	return positions
}

// Internal methods

func (e *Engine) validateOrder(order *types.Order) error {
	minSize := decimal.NewFromFloat(e.config.MinOrderSize)
	maxSize := decimal.NewFromFloat(e.config.MaxOrderSize)

	if order.Size.LessThan(minSize) {
		return fmt.Errorf("order size too small: %v < %v",
			order.Size, minSize)
	}
	if order.Size.GreaterThan(maxSize) {
		return fmt.Errorf("order size too large: %v > %v",
			order.Size, maxSize)
	}
	return nil
}
