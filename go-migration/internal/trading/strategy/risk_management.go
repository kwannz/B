package strategy

import (
	"context"
	"math"

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

func (s *RiskManagementStrategy) CalculatePositionSize(portfolioValue float64, price float64) float64 {
	maxSize := portfolioValue * s.config.PositionSizing.MaxPositionSize
	minSize := portfolioValue * s.config.PositionSizing.MinPositionSize
	
	size := maxSize
	if size < minSize {
		size = minSize
	}
	
	return math.Floor(size/price) * price
}

func (s *RiskManagementStrategy) UpdateStopLoss(position *types.Position) *types.StopLoss {
	if position.Size <= 0 {
		return nil
	}

	initialStop := position.EntryPrice * (1 - s.config.StopLoss.Initial)
	trailingStop := position.CurrentPrice * (1 - s.config.StopLoss.Trailing)
	
	stopPrice := math.Max(initialStop, trailingStop)
	
	return &types.StopLoss{
		Price: stopPrice,
		Size:  position.Size,
	}
}

func (s *RiskManagementStrategy) CheckStopLoss(ctx context.Context, position *types.Position) (bool, error) {
	if position.Size <= 0 {
		return false, nil
	}

	stopLoss := s.UpdateStopLoss(position)
	if stopLoss == nil {
		return false, nil
	}

	if position.CurrentPrice <= stopLoss.Price {
		s.logger.Info("Stop loss triggered",
			zap.String("symbol", position.Symbol),
			zap.Float64("current_price", position.CurrentPrice),
			zap.Float64("stop_price", stopLoss.Price),
			zap.Float64("size", stopLoss.Size))
		return true, nil
	}

	return false, nil
}

func (s *RiskManagementStrategy) GetTakeProfitLevels(position *types.Position) []types.TakeProfit {
	if position.Size <= 0 {
		return nil
	}

	var levels []types.TakeProfit
	remainingSize := position.Size
	sizePerLevel := position.Size / float64(len(s.config.TakeProfitLevels))

	for _, multiple := range s.config.TakeProfitLevels {
		if remainingSize <= 0 {
			break
		}

		size := math.Min(sizePerLevel, remainingSize)
		levels = append(levels, types.TakeProfit{
			Price: position.EntryPrice * multiple,
			Size:  size,
		})
		remainingSize -= size
	}

	return levels
}
