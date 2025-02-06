package monitoring

import (
	"context"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type PumpMonitor struct {
	logger     *zap.Logger
	provider   *pump.Provider
	mu         sync.RWMutex
	tokens     map[string]*types.TokenUpdate
	tradeable  map[string]bool
	updateChan chan *types.TokenUpdate
}

func NewPumpMonitor(logger *zap.Logger, provider *pump.Provider) *PumpMonitor {
	return &PumpMonitor{
		logger:     logger,
		provider:   provider,
		tokens:     make(map[string]*types.TokenUpdate),
		tradeable:  make(map[string]bool),
		updateChan: make(chan *types.TokenUpdate, 1000),
	}
}

func (m *PumpMonitor) Start(ctx context.Context) error {
updates := make(chan *types.TokenUpdate, 1000)
	go func() {
		tokens, err := m.provider.GetNewTokens(ctx)
		if err != nil {
			m.logger.Error("Failed to get initial tokens", zap.Error(err))
		} else {
			for _, token := range tokens {
				select {
				case updates <- &types.TokenUpdate{
					Symbol:      token.Symbol,
					Price:      token.Price.InexactFloat64(),
					Volume:     token.Volume.InexactFloat64(),
					MarketCap:  token.MarketCap.InexactFloat64(),
					Timestamp:  time.Now(),
				}:
				case <-ctx.Done():
					return
				}
			}
		}

		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				tokens, err := m.provider.GetNewTokens(ctx)
				if err != nil {
					m.logger.Error("Failed to get new tokens", zap.Error(err))
					continue
				}

				for _, token := range tokens {
					select {
					case updates <- &types.TokenUpdate{
						Symbol:      token.Symbol,
						Price:      token.Price.InexactFloat64(),
						Volume:     token.Volume.InexactFloat64(),
						MarketCap:  token.MarketCap.InexactFloat64(),
						Timestamp:  time.Now(),
					}:
					case <-ctx.Done():
						return
					}
				}
			}
		}
	}()
	
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case update := <-updates:
				if err := m.handleUpdate(update); err != nil {
					metrics.APIErrors.WithLabelValues("handle_update").Inc()
					metrics.WebsocketConnections.Dec()
					continue
				}
				
				select {
				case m.updateChan <- update:
				default:
					m.logger.Warn("update channel full, dropping update",
						zap.String("symbol", update.Symbol))
				}
			case <-ticker.C:
				m.checkThresholds()
			}
		}
	}()

	return nil
}

func (m *PumpMonitor) GetUpdates() <-chan *types.TokenUpdate {
	return m.updateChan
}

func (m *PumpMonitor) handleUpdate(update *types.TokenUpdate) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	prev := m.tokens[update.Symbol]
	if prev == nil {
		metrics.NewTokensTotal.Inc()
	}
	
	metrics.TokenPrice.WithLabelValues("pump.fun", update.Symbol).Set(update.Price)
	metrics.TokenVolume.WithLabelValues("pump.fun", update.Symbol).Set(update.Volume)

	if prev == nil {
		m.logger.Info("new token detected",
			zap.String("symbol", update.Symbol),
			zap.Float64("price", update.Price),
			zap.Float64("market_cap", update.MarketCap),
			zap.Float64("volume", update.Volume))
	} else {
		priceChange := (update.Price - prev.Price) / prev.Price * 100
		metrics.TokenPrice.WithLabelValues(update.Symbol).Set(update.Price)
		
		if priceChange > 20 || priceChange < -20 {
			m.logger.Info("significant price change detected",
				zap.String("symbol", update.Symbol),
				zap.Float64("change_percent", priceChange),
				zap.Float64("old_price", prev.Price),
				zap.Float64("new_price", update.Price))
		}

		// Track unrealized PnL if we have a position
		if m.tradeable[update.Symbol] {
			pnl := (update.Price - prev.Price) * float64(update.TotalSupply)
			metrics.TokenVolume.WithLabelValues(update.Symbol + "_pnl").Set(pnl)
		}
	}

	// Update price metrics
	if update.Price > 0 {
		metrics.TokenPrice.WithLabelValues("pump.fun", update.Symbol + "_base").Set(update.Price)
	}

	m.tokens[update.Symbol] = update
	return nil
}

func (m *PumpMonitor) checkThresholds() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	for symbol, update := range m.tokens {
		if now.Sub(update.Timestamp) > 5*time.Minute {
			if m.tradeable[symbol] {
				metrics.APIErrors.WithLabelValues("stale_data").Inc()
				m.logger.Warn("token trading disabled due to stale data",
					zap.String("symbol", symbol),
					zap.Time("last_update", update.Timestamp))
			}
			metrics.TokenVolume.WithLabelValues(symbol + "_enabled").Set(0)
			delete(m.tradeable, symbol)
			continue
		}

		wasEnabled := m.tradeable[symbol]
		minVolume := 1000.0
		maxMarketCap := 30000.0
		shouldEnable := update.Volume > minVolume && update.MarketCap < maxMarketCap

		if shouldEnable != wasEnabled {
			if shouldEnable {
				m.logger.Info("token trading enabled",
					zap.String("symbol", symbol),
					zap.Float64("volume", update.Volume),
					zap.Float64("market_cap", update.MarketCap))
				
				// Record position metrics when enabling trading
				metrics.TokenPrice.WithLabelValues(symbol).Set(update.Price)
				metrics.TokenVolume.WithLabelValues(symbol).Set(update.Volume)
			} else {
				m.logger.Info("token trading disabled",
					zap.String("symbol", symbol),
					zap.Float64("volume", update.Volume),
					zap.Float64("market_cap", update.MarketCap))
				
				// Clear position metrics when disabling trading
				metrics.TokenPrice.WithLabelValues(symbol).Set(0)
				metrics.TokenVolume.WithLabelValues(symbol).Set(0)
			}
		}

		m.tradeable[symbol] = shouldEnable
		metrics.TokenVolume.WithLabelValues(symbol + "_enabled").Set(btoi(shouldEnable))
	}
}

func btoi(b bool) float64 {
	if b {
		return 1
	}
	return 0
}
