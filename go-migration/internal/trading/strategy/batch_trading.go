package strategy

import (
	"context"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type BatchTradingConfig struct {
	Stages []struct {
		TargetMultiple decimal.Decimal `yaml:"target_multiple"`
		Percentage     decimal.Decimal `yaml:"percentage"`
	} `yaml:"stages"`
}

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

	hundred := decimal.NewFromInt(100)
	for _, stage := range s.config.Stages {
		size := position.Size.Mul(stage.Percentage.Div(hundred))
		if size.GreaterThan(remainingSize) {
			size = remainingSize
		}

		exits = append(exits, types.TakeProfit{
			Price: position.EntryPrice.Mul(stage.TargetMultiple),
			Size:  size,
		})

		remainingSize = remainingSize.Sub(size)
		if remainingSize.LessThanOrEqual(decimal.Zero) {
			break
		}
	}

	return exits
}

func (s *BatchTradingStrategy) UpdatePosition(ctx context.Context, position *types.Position) error {
	if position.Size.LessThanOrEqual(decimal.Zero) {
		return nil
	}

	exits := s.CalculateExits(position)
	for _, exit := range exits {
		if position.CurrentPrice.GreaterThanOrEqual(exit.Price) {
			s.logger.Info("Take profit triggered",
				zap.String("symbol", position.Symbol),
				zap.String("price", position.CurrentPrice.String()),
				zap.String("target", exit.Price.String()),
				zap.String("size", exit.Size.String()))
		}
	}

	return nil
}
