package strategy

import (
	"context"

	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type BatchTradingStrategy struct {
	config *BatchTradingConfig
	logger *zap.Logger
}

func NewBatchTradingStrategy(config *BatchTradingConfig, logger *zap.Logger) *BatchTradingStrategy {
	return &BatchTradingStrategy{
		config: config,
		logger: logger,
	}
}

func (s *BatchTradingStrategy) CalculateExits(position *types.Position) []types.TakeProfit {
	var exits []types.TakeProfit
	remainingSize := position.Size

	for _, stage := range s.config.Stages {
		size := position.Size * (stage.Percentage / 100.0)
		if size > remainingSize {
			size = remainingSize
		}

		exits = append(exits, types.TakeProfit{
			Price: position.EntryPrice * stage.TargetMultiple,
			Size:  size,
		})

		remainingSize -= size
		if remainingSize <= 0 {
			break
		}
	}

	return exits
}

func (s *BatchTradingStrategy) UpdatePosition(ctx context.Context, position *types.Position) error {
	if position.Size <= 0 {
		return nil
	}

	exits := s.CalculateExits(position)
	for _, exit := range exits {
		if position.CurrentPrice >= exit.Price {
			s.logger.Info("Take profit triggered",
				zap.String("symbol", position.Symbol),
				zap.Float64("price", position.CurrentPrice),
				zap.Float64("target", exit.Price),
				zap.Float64("size", exit.Size))
		}
	}

	return nil
}
