package monitoring

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type Service struct {
	logger   *zap.Logger
	provider *pump.Provider
	metrics  *metrics.PumpMetrics
	mu       sync.RWMutex
	tokens   map[string]*types.TokenMarketInfo
	maxCap   decimal.Decimal
}

func NewService(provider *pump.Provider, metrics *metrics.PumpMetrics, logger *zap.Logger) *Service {
	return &Service{
		logger:   logger,
		provider: provider,
		metrics:  metrics,
		tokens:   make(map[string]*types.TokenMarketInfo),
		maxCap:   decimal.NewFromInt(30000),
	}
}

func (s *Service) Start(ctx context.Context) error {
	tokenUpdates, err := s.provider.SubscribeNewTokens(ctx)
	if err != nil {
		return err
	}

	go s.monitorNewTokens(ctx, tokenUpdates)
	go s.monitorMarketData(ctx)

	return nil
}

func (s *Service) monitorNewTokens(ctx context.Context, updates <-chan *types.TokenMarketInfo) {
	for {
		select {
		case <-ctx.Done():
			return
		case token := <-updates:
			// Filter for SOL meme coins with market cap below threshold
			if !strings.HasSuffix(strings.ToUpper(token.Symbol), "/SOL") || token.MarketCap.GreaterThan(s.maxCap) {
				s.logger.Debug("Token filtered out",
					zap.String("symbol", token.Symbol),
					zap.String("market_cap", token.MarketCap.String()),
					zap.String("reason", "not SOL meme coin or market cap too high"))
				continue
			}

			s.mu.Lock()
			s.tokens[token.Symbol] = token
			s.mu.Unlock()

			s.logger.Info("New SOL meme token detected",
				zap.String("symbol", token.Symbol),
				zap.String("name", token.Name),
				zap.String("market_cap", token.MarketCap.String()),
				zap.Int64("supply", token.Supply),
				zap.String("volume", token.Volume.String()))

			metrics.NewTokensTotal.Inc()
			metrics.TokenPrice.WithLabelValues(token.Symbol).Set(token.MarketCap.InexactFloat64())
			metrics.TokenVolume.WithLabelValues(token.Symbol).Set(token.Volume.InexactFloat64())

			// Trigger early entry alert for qualifying tokens
			if token.MarketCap.LessThan(s.maxCap) {
				s.logger.Info("Early entry opportunity detected",
					zap.String("symbol", token.Symbol),
					zap.String("market_cap", token.MarketCap.String()),
					zap.String("volume", token.Volume.String()))
			}
		}
	}
}

func (s *Service) monitorMarketData(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.mu.RLock()
			tokens := make([]string, 0, len(s.tokens))
			for symbol := range s.tokens {
				tokens = append(tokens, symbol)
			}
			s.mu.RUnlock()

			for _, symbol := range tokens {
				curve, err := s.provider.GetBondingCurve(ctx, symbol)
				if err != nil {
					s.logger.Error("Failed to get bonding curve",
						zap.String("symbol", symbol),
						zap.Error(err))
					continue
				}

				metrics.TokenPrice.WithLabelValues(symbol + "_base").Set(curve.BasePrice.InexactFloat64())
				metrics.TokenPrice.WithLabelValues(symbol + "_current").Set(curve.CurrentPrice.InexactFloat64())
				s.logger.Debug("Updated bonding curve",
					zap.String("symbol", symbol),
					zap.String("price", curve.CurrentPrice.String()),
					zap.String("base_price", curve.BasePrice.String()),
					zap.Int64("supply", curve.Supply))
			}
		}
	}
}

func (s *Service) GetTokens() map[string]*types.TokenMarketInfo {
	s.mu.RLock()
	defer s.mu.RUnlock()

	tokens := make(map[string]*types.TokenMarketInfo, len(s.tokens))
	for k, v := range s.tokens {
		tokens[k] = v
	}
	return tokens
}

func calculateAverageVolume(history []float64) float64 {
	if len(history) == 0 {
		return 0
	}
	
	var sum float64
	for _, v := range history {
		sum += v
	}
	return sum / float64(len(history))
}
