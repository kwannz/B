package trading

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/trading/executor"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type Config struct {
	Commission     float64       `yaml:"commission"`
	Slippage      float64       `yaml:"slippage"`
	MaxOrderSize   float64       `yaml:"max_order_size"`
	MinOrderSize   float64       `yaml:"min_order_size"`
	MaxPositions   int          `yaml:"max_positions"`
	UpdateInterval time.Duration `yaml:"update_interval"`
}

type Strategy interface {
	Name() string
	Init(ctx context.Context) error
	ProcessUpdate(update *types.TokenUpdate) error
	ExecuteTrade(ctx context.Context, signal *types.Signal) error
}

type Storage interface {
	SaveOrder(order *types.Order) error
	SavePosition(position *types.Position) error
	GetOrder(orderID string) (*types.Order, error)
	GetOrders(userID string) ([]*types.Order, error)
	GetPosition(symbol string) (*types.Position, error)
	GetPositions(userID string) ([]*types.Position, error)
}

type Engine struct {
	logger     *zap.Logger
	config     Config
	storage    Storage
	positions  map[string]*types.Position
	orders     map[string]*types.Order
	strategies map[string]Strategy
	executors  map[string]executor.TradingExecutor
	stop       chan struct{}
	isRunning  bool
	mu         sync.RWMutex
}

func NewEngine(config Config, logger *zap.Logger, storage Storage) *Engine {
	return &Engine{
		logger:     logger,
		config:     config,
		storage:    storage,
		positions:  make(map[string]*types.Position),
		orders:     make(map[string]*types.Order),
		strategies: make(map[string]Strategy),
		executors:  make(map[string]executor.TradingExecutor),
		stop:       make(chan struct{}),
	}
}

func (e *Engine) RegisterExecutor(name string, exec executor.TradingExecutor) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if _, exists := e.executors[name]; exists {
		return fmt.Errorf("executor %s already registered", name)
	}

	e.executors[name] = exec
	return nil
}

func (e *Engine) RegisterStrategy(strategy Strategy) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	name := strategy.Name()
	if _, exists := e.strategies[name]; exists {
		return fmt.Errorf("strategy %s already registered", name)
	}

	e.strategies[name] = strategy
	return nil
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

func (e *Engine) Start(ctx context.Context) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.isRunning {
		return fmt.Errorf("engine already running")
	}

	e.isRunning = true
	e.logger.Info("Trading engine started")

	go e.run(ctx)
	return nil
}

func (e *Engine) Stop() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if !e.isRunning {
		return fmt.Errorf("engine not running")
	}

	close(e.stop)
	e.isRunning = false
	e.logger.Info("Trading engine stopped")
	return nil
}

func (e *Engine) run(ctx context.Context) {
	ticker := time.NewTicker(e.config.UpdateInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-e.stop:
			return
		case <-ticker.C:
			e.updatePositions(ctx)
		}
	}
}

func (e *Engine) updatePositions(ctx context.Context) {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, pos := range e.positions {
		if err := e.storage.SavePosition(pos); err != nil {
			e.logger.Error("Failed to save position",
				zap.String("symbol", pos.Symbol),
				zap.Error(err))
		}
	}
}

func (e *Engine) PlaceOrder(ctx context.Context, order *types.Order) error {
	if err := e.validateOrder(order); err != nil {
		return err
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	e.orders[order.ID] = order
	if err := e.storage.SaveOrder(order); err != nil {
		delete(e.orders, order.ID)
		return fmt.Errorf("failed to save order: %w", err)
	}

	return nil
}

func (e *Engine) CancelOrder(ctx context.Context, orderID string) error {
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

func (e *Engine) GetOrder(ctx context.Context, orderID string) (*types.Order, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	order, exists := e.orders[orderID]
	if !exists {
		return nil, fmt.Errorf("order not found: %s", orderID)
	}
	return order, nil
}

func (e *Engine) GetOrders(ctx context.Context) ([]*types.Order, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	orders := make([]*types.Order, 0, len(e.orders))
	for _, order := range e.orders {
		orders = append(orders, order)
	}
	return orders, nil
}

func (e *Engine) GetPosition(ctx context.Context, symbol string) (*types.Position, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	pos, exists := e.positions[symbol]
	if !exists {
		return nil, fmt.Errorf("position for %s not found", symbol)
	}
	return pos, nil
}

func (e *Engine) GetPositions(ctx context.Context) ([]*types.Position, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	positions := make([]*types.Position, 0, len(e.positions))
	for _, pos := range e.positions {
		positions = append(positions, pos)
	}
	return positions, nil
}

func (e *Engine) validateOrder(order *types.Order) error {
	size := order.Size
	maxSize := decimal.NewFromFloat(e.config.MaxOrderSize)
	minSize := decimal.NewFromFloat(e.config.MinOrderSize)

	if size.GreaterThan(maxSize) {
		return fmt.Errorf("order size %v exceeds maximum %v", size, maxSize)
	}

	if size.LessThan(minSize) {
		return fmt.Errorf("order size %v below minimum %v", size, minSize)
	}

	return nil
}

func (e *Engine) ExecuteTrade(ctx context.Context, trade *types.Trade) error {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if trade.Provider == "" {
		return fmt.Errorf("trade provider not specified")
	}

	executor, ok := e.executors[trade.Provider]
	if !ok {
		return fmt.Errorf("executor %s not found", trade.Provider)
	}

	signal := &types.Signal{
		Provider:   trade.Provider,
		Symbol:     trade.Symbol,
		Type:       types.SignalType(trade.Side),
		Amount:     trade.Size,
		Price:      trade.Price,
		Timestamp:  trade.Timestamp,
	}

	if err := executor.ExecuteTrade(ctx, signal); err != nil {
		return fmt.Errorf("failed to execute trade: %w", err)
	}

	return nil
}
