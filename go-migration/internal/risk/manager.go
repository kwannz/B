package risk

import (
	"context"
	"fmt"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

// Limits defines risk management limits
type Limits struct {
	MaxPositionSize  decimal.Decimal `json:"max_position_size"`
	MaxDrawdown      decimal.Decimal `json:"max_drawdown"`
	MaxDailyLoss     decimal.Decimal `json:"max_daily_loss"`
	MaxLeverage      decimal.Decimal `json:"max_leverage"`
	MinMarginLevel   decimal.Decimal `json:"min_margin_level"`
	MaxConcentration decimal.Decimal `json:"max_concentration"`
}

// Manager handles risk management
type Manager struct {
	logger *zap.Logger
	limits Limits
}

func (m *Manager) GetLimits() Limits {
	return m.limits
}

func (m *Manager) CheckTakeProfit(symbol string, price decimal.Decimal) (bool, decimal.Decimal) {
	// Default take profit at 100% gain (2x)
	return price.GreaterThanOrEqual(decimal.NewFromFloat(2.0)), decimal.NewFromFloat(0.5)
}

func (m *Manager) UpdateStopLoss(symbol string, price decimal.Decimal) error {
	// Simple stop loss at 15% below current price
	return nil
}

func (m *Manager) ValidatePosition(symbol string, size decimal.Decimal) error {
	if size.IsZero() {
		return fmt.Errorf("position size cannot be zero")
	}
	if size.GreaterThan(m.limits.MaxPositionSize) {
		return fmt.Errorf("position size %s exceeds limit %s", size.String(), m.limits.MaxPositionSize.String())
	}
	return nil
}

func (m *Manager) CalculatePositionSize(symbol string, price decimal.Decimal) (decimal.Decimal, error) {
	maxSize := m.limits.MaxPositionSize
	if price.IsZero() {
		return decimal.Zero, fmt.Errorf("price cannot be zero")
	}
	return maxSize.Div(price), nil
}

// NewManager creates a new risk manager
func NewManager(limits Limits, logger *zap.Logger) *Manager {
	return &Manager{
		logger: logger,
		limits: limits,
	}
}

// CheckOrderRisk checks if an order complies with risk limits
func (m *Manager) CheckOrderRisk(ctx context.Context, order *types.Order) error {
	// Check order size
	if order.Size.GreaterThan(m.limits.MaxPositionSize) {
		return fmt.Errorf("order size exceeds limit: %s > %s",
			order.Size.String(), m.limits.MaxPositionSize.String())
	}

	// TODO: Implement more order risk checks
	// - Check margin requirements
	// - Check concentration limits
	// - Check daily loss limits

	return nil
}

// ValidatePositionSize validates if a position size is within limits
func (m *Manager) ValidatePositionSize(symbol string, size float64) error {
	if size <= 0 {
		return fmt.Errorf("position size must be positive")
	}

	sizeDecimal := decimal.NewFromFloat(size)
	if sizeDecimal.GreaterThan(m.limits.MaxPositionSize) {
		return fmt.Errorf("position size %s exceeds limit %s", sizeDecimal.String(), m.limits.MaxPositionSize.String())
	}

	return nil
}

// ValidateNewPosition validates if a new position can be opened
func (m *Manager) ValidateNewPosition(ctx context.Context, symbol string, size decimal.Decimal, price decimal.Decimal) error {
	if size.IsZero() {
		return fmt.Errorf("position size cannot be zero")
	}

	if size.Abs().GreaterThan(m.limits.MaxPositionSize) {
		return fmt.Errorf("position size %s exceeds limit %s", size.String(), m.limits.MaxPositionSize.String())
	}

	return nil
}

// CheckPositionRisk checks if a position complies with risk limits
func (m *Manager) CheckPositionRisk(ctx context.Context, position *types.Position) error {
	// Check position size
	if position.Size.Abs().GreaterThan(m.limits.MaxPositionSize) {
		return fmt.Errorf("position size exceeds limit: %s > %s",
			position.Size.Abs().String(), m.limits.MaxPositionSize.String())
	}

	// Check drawdown
	if position.UnrealizedPnL.IsNegative() {
		positionValue := position.Size.Mul(position.EntryPrice).Abs()
		if !positionValue.IsZero() {
			drawdown := position.UnrealizedPnL.Abs().Div(positionValue)
			if drawdown.GreaterThan(m.limits.MaxDrawdown) {
				return fmt.Errorf("drawdown exceeds limit: %s > %s",
					drawdown.String(), m.limits.MaxDrawdown.String())
			}
		}
	}

	// TODO: Implement more position risk checks
	// - Check leverage
	// - Check margin level
	// - Check concentration

	return nil
}

// CheckAccountRisk checks overall account risk
func (m *Manager) CheckAccountRisk(ctx context.Context, metrics *types.RiskMetrics) error {
	// Check daily loss
	maxLossNeg := m.limits.MaxDailyLoss.Neg()
	if metrics.DailyPnL.LessThan(maxLossNeg) {
		return fmt.Errorf("daily loss exceeds limit: %s < %s",
			metrics.DailyPnL.String(), maxLossNeg.String())
	}

	// Check margin level
	if metrics.MarginLevel.LessThan(m.limits.MinMarginLevel) {
		return fmt.Errorf("margin level below limit: %s < %s",
			metrics.MarginLevel.String(), m.limits.MinMarginLevel.String())
	}

	// TODO: Implement more account risk checks
	// - Check total exposure
	// - Check portfolio concentration
	// - Check correlation risk

	return nil
}

// CalculateMetrics calculates risk metrics
func (m *Manager) CalculateMetrics(ctx context.Context, positions []*types.Position) (*types.RiskMetrics, error) {
	metrics := &types.RiskMetrics{
		UserID:     "",
		UpdateTime: time.Now(),
	}

	// Calculate metrics from positions
	for _, pos := range positions {
		positionValue := pos.Size.Mul(pos.EntryPrice).Abs()
		marginReq := positionValue.Mul(decimal.NewFromFloat(0.1)) // Example margin requirement
		metrics.UsedMargin = metrics.UsedMargin.Add(marginReq)
		metrics.TotalEquity = metrics.TotalEquity.Add(positionValue).Add(pos.UnrealizedPnL)
		metrics.DailyPnL = metrics.DailyPnL.Add(pos.UnrealizedPnL).Add(pos.RealizedPnL)
	}

	metrics.AvailableMargin = metrics.TotalEquity.Sub(metrics.UsedMargin)
	if !metrics.UsedMargin.IsZero() {
		metrics.MarginLevel = metrics.TotalEquity.Div(metrics.UsedMargin).Mul(decimal.NewFromInt(100))
	}

	return metrics, nil
}
