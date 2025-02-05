package executor

import (
    "context"
    "fmt"
    "strings"
    "sync"

    "github.com/shopspring/decimal"
    "go.uber.org/zap"

    "github.com/kwanRoshi/B/go-migration/internal/metrics"
    "github.com/kwanRoshi/B/go-migration/internal/types"
    "github.com/kwanRoshi/B/go-migration/internal/market/pump"
)

type PumpExecutor struct {
    logger     *zap.Logger
    provider   *pump.Provider
    riskMgr    types.RiskManager
    config     *types.PumpTradingConfig
    mu         sync.RWMutex
    positions  map[string]*types.Position
    apiKey     string
    isRunning  bool
}

func NewPumpExecutor(logger *zap.Logger, provider *pump.Provider, riskMgr types.RiskManager, config *types.PumpTradingConfig, apiKey string) *PumpExecutor {
    return &PumpExecutor{
        logger:    logger,
        provider:  provider,
        riskMgr:   riskMgr,
        positions: make(map[string]*types.Position),
        apiKey:    apiKey,
        config:    config,
    }
}

func (e *PumpExecutor) Start() error {
    e.mu.Lock()
    defer e.mu.Unlock()

    if e.isRunning {
        return fmt.Errorf("executor already running")
    }

    if e.apiKey == "" {
        metrics.APIErrors.WithLabelValues("api_key_missing").Inc()
        return fmt.Errorf("API key not configured")
    }

    e.isRunning = true
    e.logger.Info("pump.fun executor started",
        zap.Bool("api_key_configured", true),
        zap.String("provider", "pump.fun"))
    return nil
}

func (e *PumpExecutor) Stop() error {
    e.mu.Lock()
    defer e.mu.Unlock()

    if !e.isRunning {
        return fmt.Errorf("executor not running")
    }

    e.isRunning = false
    return nil
}

func (e *PumpExecutor) ExecuteTrade(ctx context.Context, signal *types.Signal) error {
    e.mu.Lock()
    defer e.mu.Unlock()

    if !e.isRunning {
        return fmt.Errorf("executor not running")
    }

    // Verify API key
    if err := e.verifyAPIKey(); err != nil {
        metrics.APIErrors.WithLabelValues("api_key_verification").Inc()
        return fmt.Errorf("API key verification failed: %w", err)
    }

    // Validate position against risk limits
    if err := e.riskMgr.ValidatePosition(signal.Symbol, signal.Amount); err != nil {
        metrics.PumpTradeExecutions.WithLabelValues("risk_rejected").Inc()
        return fmt.Errorf("risk validation failed: %w", err)
    }

    // Calculate stop loss and take profit levels
    stopLoss := signal.Price.Mul(decimal.NewFromFloat(0.85))  // 15% stop loss
    takeProfits := []decimal.Decimal{
        signal.Price.Mul(decimal.NewFromFloat(2.0)),  // 2x take profit (20%)
        signal.Price.Mul(decimal.NewFromFloat(3.0)),  // 3x take profit (25%)
        signal.Price.Mul(decimal.NewFromFloat(5.0)),  // 5x take profit (20%)
    }

    // Execute trade through provider
    if err := e.provider.ExecuteOrder(ctx, signal.Symbol, signal.Type, signal.Amount, signal.Price, &stopLoss, takeProfits); err != nil {
        metrics.PumpTradeExecutions.WithLabelValues("failed").Inc()
        return fmt.Errorf("trade execution failed: %w", err)
    }

    // Update position tracking
    position, exists := e.positions[signal.Symbol]
    if !exists {
        position = types.NewPosition(signal.Symbol, decimal.Zero, signal.Price)
        e.positions[signal.Symbol] = position
    }

    if signal.Type == types.SignalTypeBuy {
        oldSize := position.Size
        position.Size = position.Size.Add(signal.Amount)
        position.EntryPrice = position.EntryPrice.Mul(oldSize).Add(signal.Price.Mul(signal.Amount)).Div(position.Size)
    } else {
        position.Size = position.Size.Sub(signal.Amount)
        if position.Size.LessThanOrEqual(decimal.Zero) {
            delete(e.positions, signal.Symbol)
        }
    }

    // Record metrics
    metrics.PumpTradeExecutions.WithLabelValues("success").Inc()
    metrics.TokenVolume.WithLabelValues("pump.fun", signal.Symbol).Add(signal.Amount.InexactFloat64())
    metrics.PumpPositionSize.WithLabelValues(signal.Symbol).Set(position.Size.InexactFloat64())

    e.logger.Info("trade executed successfully",
        zap.String("symbol", signal.Symbol),
        zap.String("type", string(signal.Type)),
        zap.String("size", signal.Amount.String()),
        zap.String("price", signal.Price.String()))

    return nil
}

func (e *PumpExecutor) GetPosition(symbol string) *types.Position {
    e.mu.RLock()
    defer e.mu.RUnlock()
    return e.positions[symbol]
}

func (e *PumpExecutor) GetPositions() map[string]*types.Position {
    e.mu.RLock()
    defer e.mu.RUnlock()
    
    positions := make(map[string]*types.Position)
    for k, v := range e.positions {
        positions[k] = v
    }
    return positions
}

func (e *PumpExecutor) verifyAPIKey() error {
    if e.apiKey == "" {
        return fmt.Errorf("API key not configured")
    }
    
    if len(e.apiKey) != 88 {
        return fmt.Errorf("invalid API key format")
    }
    
    metrics.APIKeyUsage.WithLabelValues("pump.fun", "verification").Inc()
    return nil
}
