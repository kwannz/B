package monitoring

import (
	"context"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type TokenMonitor struct {
	logger     *zap.Logger
	metrics    *metrics.PumpMetrics
	tokens     map[string]*types.TokenMarketInfo
	mu         sync.RWMutex
	lastUpdate time.Time
}

func NewTokenMonitor(logger *zap.Logger, metrics *metrics.PumpMetrics) *TokenMonitor {
	return &TokenMonitor{
		logger:  logger,
		metrics: metrics,
		tokens:  make(map[string]*types.TokenMarketInfo),
	}
}

func (m *TokenMonitor) Start(ctx context.Context) error {
	m.logger.Info("Starting token monitor")
	go m.monitorTokens(ctx)
	return nil
}

func (m *TokenMonitor) monitorTokens(ctx context.Context) {
	ticker := time.NewTicker(time.Second * 1)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.updateMetrics()
		}
	}
}

func (m *TokenMonitor) AddToken(token *types.TokenMarketInfo) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.tokens[token.Symbol] = token
	m.lastUpdate = time.Now()

	m.metrics.NewTokensTotal.Inc()
	m.metrics.TokenPrice.WithLabelValues(token.Symbol).Set(token.Price.InexactFloat64())
	m.metrics.TokenVolume.WithLabelValues(token.Symbol).Set(token.Volume.InexactFloat64())
	m.metrics.TokenMarketCap.WithLabelValues(token.Symbol).Set(token.MarketCap.InexactFloat64())

	m.logger.Info("New token detected",
		zap.String("symbol", token.Symbol),
		zap.String("name", token.Name),
		zap.Float64("price", token.Price.InexactFloat64()),
		zap.Float64("market_cap", token.MarketCap.InexactFloat64()))
}

func (m *TokenMonitor) UpdateToken(symbol string, update *types.TokenUpdate) {
	m.mu.Lock()
	defer m.mu.Unlock()

	token, exists := m.tokens[symbol]
	if !exists {
	token = &types.TokenMarketInfo{
			Symbol: symbol,
			Name:   update.TokenName,
		}
		m.tokens[symbol] = token
	}

	token.Price = decimal.NewFromFloat(update.Price)
	token.Volume = decimal.NewFromFloat(update.Volume)
	token.MarketCap = decimal.NewFromFloat(update.MarketCap)
	token.LastUpdate = time.Now()

	m.metrics.TokenPrice.WithLabelValues("pump.fun", symbol).Set(update.Price)
	m.metrics.TokenVolume.WithLabelValues("pump.fun", symbol).Set(update.Volume)
	m.metrics.TokenMarketCap.WithLabelValues("pump.fun", symbol).Set(update.MarketCap)

	if token.MarketCap.LessThan(decimal.NewFromFloat(30000)) {
		m.logger.Info("Low cap token detected",
			zap.String("symbol", symbol),
			zap.Float64("market_cap", update.MarketCap))
	}

	if token.Volume.GreaterThan(decimal.NewFromFloat(1000)) {
		m.logger.Info("High volume token detected",
			zap.String("symbol", symbol),
			zap.Float64("volume", update.Volume))
	}

	if update.PriceChange.Hour > 0 {
		m.metrics.TokenPriceChangeHour.WithLabelValues("pump.fun", symbol).Set(update.PriceChange.Hour)
	}
	if update.PriceChange.Day > 0 {
		m.metrics.TokenPriceChangeDay.WithLabelValues("pump.fun", symbol).Set(update.PriceChange.Day)
	}

	if update.PriceChange.Hour > 0 {
		m.metrics.TokenPriceChangeHour.WithLabelValues(symbol).Set(update.PriceChange.Hour)
	}
	if update.PriceChange.Day > 0 {
		m.metrics.TokenPriceChangeDay.WithLabelValues(symbol).Set(update.PriceChange.Day)
	}
}

func (m *TokenMonitor) updateMetrics() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	activeTokens := 0
	for _, token := range m.tokens {
		if time.Since(token.LastUpdate) < time.Minute*5 {
			activeTokens++
		}
	}

	m.metrics.ActiveTokens.Set(float64(activeTokens))
	m.metrics.LastUpdate.Set(float64(m.lastUpdate.Unix()))
}

func (m *TokenMonitor) GetTokens() map[string]*types.TokenMarketInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tokens := make(map[string]*types.TokenMarketInfo)
	for k, v := range m.tokens {
		tokens[k] = v
	}
	return tokens
}
