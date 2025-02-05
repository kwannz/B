package strategy

import (
	"context"
	"time"

	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type EarlyEntryStrategy struct {
	config     *EarlyEntryConfig
	provider   *pump.Provider
	logger     *zap.Logger
	lastUpdate time.Time
}

func NewEarlyEntryStrategy(config *EarlyEntryConfig, provider *pump.Provider, logger *zap.Logger) *EarlyEntryStrategy {
	return &EarlyEntryStrategy{
		config:   config,
		provider: provider,
		logger:   logger,
	}
}

func (s *EarlyEntryStrategy) Evaluate(ctx context.Context, token *types.TokenInfo) (bool, error) {
	if token.MarketCap > s.config.MaxMarketCap {
		s.logger.Debug("Token market cap above threshold",
			zap.String("symbol", token.Symbol),
			zap.Float64("market_cap", token.MarketCap),
			zap.Float64("threshold", s.config.MaxMarketCap))
		return false, nil
	}

	if token.Volume < s.config.VolumeThreshold {
		s.logger.Debug("Token volume below threshold",
			zap.String("symbol", token.Symbol),
			zap.Float64("volume", token.Volume),
			zap.Float64("threshold", s.config.VolumeThreshold))
		return false, nil
	}

	curve, err := s.provider.GetBondingCurve(ctx, token.Symbol)
	if err != nil {
		return false, err
	}

	liquidity := curve.BasePrice * float64(curve.Supply)
	if liquidity < s.config.MinLiquidity {
		s.logger.Debug("Token liquidity below threshold",
			zap.String("symbol", token.Symbol),
			zap.Float64("liquidity", liquidity),
			zap.Float64("threshold", s.config.MinLiquidity))
		return false, nil
	}

	s.logger.Info("Token qualifies for early entry",
		zap.String("symbol", token.Symbol),
		zap.Float64("market_cap", token.MarketCap),
		zap.Float64("volume", token.Volume),
		zap.Float64("liquidity", liquidity))

	return true, nil
}
