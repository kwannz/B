package strategy

import (
	"context"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type RiskManagementStrategy struct {
	config *RiskManagementConfig
	logger *zap.Logger
}

func NewRiskManagementStrategy(config *RiskManagementConfig, logger *zap.Logger) *RiskManagementStrategy {
	return &RiskManagementStrategy{
		config: config,
		logger: logger,
	}
}

func (s *RiskManagementStrategy) CalculatePositionSize(portfolioValue, price decimal.Decimal) decimal.Decimal {
	maxSize := portfolioValue.Mul(s.config.PositionSizing.MaxPositionSize)
	minSize := portfolioValue.Mul(s.config.PositionSizing.MinPositionSize)
	
	size := maxSize
	if size.LessThan(minSize) {
		size = minSize
	}
	
	return size.Div(price).Floor().Mul(price)
}

func (s *RiskManagementStrategy) UpdateStopLoss(position *types.Position) *types.ActiveStopLoss {
	if position.Size.LessThanOrEqual(decimal.Zero) {
		return nil
	}

	one := decimal.NewFromInt(1)
	initialStop := position.EntryPrice.Mul(one.Sub(s.config.StopLoss.Initial))
	trailingStop := position.CurrentPrice.Mul(one.Sub(s.config.StopLoss.Trailing))
	
	stopPrice := initialStop
	if trailingStop.GreaterThan(initialStop) {
		stopPrice = trailingStop
	}
	
	return &types.ActiveStopLoss{
		StopPrice: stopPrice,
		Position:  position,
	}
}

func (s *RiskManagementStrategy) CheckStopLoss(ctx context.Context, position *types.Position) (bool, error) {
	if position.Size.LessThanOrEqual(decimal.Zero) {
		return false, nil
	}

	activeStopLoss := s.UpdateStopLoss(position)
	if activeStopLoss == nil {
		return false, nil
	}

	if position.CurrentPrice.LessThanOrEqual(activeStopLoss.StopPrice) {
		s.logger.Info("Stop loss triggered",
			zap.String("symbol", position.Symbol),
			zap.String("current_price", position.CurrentPrice.String()),
			zap.String("stop_price", activeStopLoss.StopPrice.String()),
			zap.String("size", position.Size.String()))
		return true, nil
	}

	return false, nil
}

func (s *RiskManagementStrategy) GetTakeProfitLevels(position *types.Position) []types.TakeProfit {
	if position.Size.LessThanOrEqual(decimal.Zero) {
		return nil
	}

	var levels []types.TakeProfit
	remainingSize := position.Size
	levelCount := decimal.NewFromInt(int64(len(s.config.TakeProfitLevels)))
	sizePerLevel := position.Size.Div(levelCount)

	for _, multiple := range s.config.TakeProfitLevels {
		if remainingSize.LessThanOrEqual(decimal.Zero) {
			break
		}

		size := decimal.Min(sizePerLevel, remainingSize)
		levels = append(levels, types.TakeProfit{
			Price: position.EntryPrice.Mul(multiple),
			Size:  size,
		})
		remainingSize = remainingSize.Sub(size)
	}

	return levels
}
