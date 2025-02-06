package strategy

import (
	"context"
	"time"

	"github.com/shopspring/decimal"
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

func (s *EarlyEntryStrategy) Evaluate(ctx context.Context, token *types.TokenMarketInfo) (bool, error) {
	if token.MarketCap.GreaterThan(s.config.MaxMarketCap) {
		s.logger.Debug("Token market cap above threshold",
			zap.String("symbol", token.Symbol),
			zap.String("market_cap", token.MarketCap.String()),
			zap.String("threshold", s.config.MaxMarketCap.String()))
		return false, nil
	}

	if token.Volume.LessThan(s.config.VolumeThreshold) {
		s.logger.Debug("Token volume below threshold",
			zap.String("symbol", token.Symbol),
			zap.String("volume", token.Volume.String()),
			zap.String("threshold", s.config.VolumeThreshold.String()))
		return false, nil
	}

	curve, err := s.provider.GetBondingCurve(ctx, token.Symbol)
	if err != nil {
		return false, err
	}

	liquidity := curve.BasePrice.Mul(decimal.NewFromInt(curve.Supply))
	if liquidity.LessThan(s.config.MinLiquidity) {
		s.logger.Debug("Token liquidity below threshold",
			zap.String("symbol", token.Symbol),
			zap.String("liquidity", liquidity.String()),
			zap.String("threshold", s.config.MinLiquidity.String()))
		return false, nil
	}

	s.logger.Info("Token qualifies for early entry",
		zap.String("symbol", token.Symbol),
		zap.String("market_cap", token.MarketCap.String()),
		zap.String("volume", token.Volume.String()),
		zap.String("liquidity", liquidity.String()))

	return true, nil
}
