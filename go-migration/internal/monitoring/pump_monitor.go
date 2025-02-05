package monitoring

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/kwanRoshi/B/go-migration/internal/market/pump"
	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
	"go.uber.org/zap"
)

type PumpMonitor struct {
	logger     *zap.Logger
	provider   pump.Provider
	metrics    *metrics.PumpMetrics
	mu         sync.RWMutex
	tokens     map[string]*types.TokenUpdate
	tradeable  map[string]bool
	updateChan chan *types.TokenUpdate
}

func NewPumpMonitor(logger *zap.Logger, provider pump.Provider) *PumpMonitor {
	return &PumpMonitor{
		logger:     logger,
		provider:   provider,
		metrics:    metrics.NewPumpMetrics(),
		tokens:     make(map[string]*types.TokenUpdate),
		tradeable:  make(map[string]bool),
		updateChan: make(chan *types.TokenUpdate, 1000),
	}
}

func (m *PumpMonitor) Start(ctx context.Context) error {
	updates := m.provider.GetTokenUpdates()
	
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case update := <-updates:
				if err := m.handleUpdate(update); err != nil {
					m.metrics.RecordError("handle_update", err)
					m.metrics.RecordWebSocketError("update_handler")
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

	tokenInfo := &types.TokenInfo{
		Symbol:    update.Symbol,
		Name:      update.TokenName,
		MarketCap: update.MarketCap,
		Supply:    int64(update.TotalSupply),
	}

	if prev == nil {
		m.metrics.RecordNewToken(tokenInfo)
	}
	
	m.metrics.RecordPosition(update.Symbol, update.TotalSupply, update.Price)
	metrics.PumpTokenVolume.WithLabelValues(update.Symbol).Set(update.Volume)
	metrics.PumpTokenMarketCap.WithLabelValues(update.Symbol).Set(update.MarketCap)
	metrics.PumpTokenLastTradeTime.WithLabelValues(update.Symbol).Set(float64(update.Timestamp.Unix()))

	prev := m.tokens[update.Symbol]
	if prev == nil {
		m.metrics.RecordNewToken(tokenInfo)
		m.logger.Info("new token detected",
			zap.String("symbol", update.Symbol),
			zap.String("name", update.TokenName),
			zap.Float64("price", update.Price),
			zap.Float64("market_cap", update.MarketCap),
			zap.Float64("volume", update.Volume))
	} else {
		priceChange := ((update.Price - prev.Price) / prev.Price) * 100
		metrics.PumpTokenPriceChange.WithLabelValues(update.Symbol, "30m").Set(priceChange)
		
		if priceChange > 20 || priceChange < -20 {
			m.logger.Info("significant price change detected",
				zap.String("symbol", update.Symbol),
				zap.Float64("change_percent", priceChange),
				zap.Float64("old_price", prev.Price),
				zap.Float64("new_price", update.Price))
		}

		// Track unrealized PnL if we have a position
		if m.tradeable[update.Symbol] {
			m.metrics.RecordUnrealizedPnL(update.Symbol, 
				(update.Price - prev.Price) * update.TotalSupply)
		}
	}

	// Update bonding curve metrics if available
	if update.BondingCurve != nil {
		m.metrics.RecordBondingCurve(&types.TokenBondingCurve{
			Symbol:       update.Symbol,
			CurrentPrice: update.Price,
			BasePrice:    update.BondingCurve.BasePrice,
			Supply:       int64(update.TotalSupply),
		})
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
				m.metrics.RecordError("stale_data", fmt.Errorf("stale data for %s", symbol))
				m.logger.Warn("token trading disabled due to stale data",
					zap.String("symbol", symbol),
					zap.Time("last_update", update.Timestamp))
			}
			metrics.PumpTokenTradingEnabled.WithLabelValues(symbol).Set(0)
			delete(m.tradeable, symbol)
			continue
		}

		wasEnabled := m.tradeable[symbol]
		shouldEnable := update.Volume > 1000 && update.MarketCap < 30000

		if shouldEnable != wasEnabled {
			if shouldEnable {
				m.logger.Info("token trading enabled",
					zap.String("symbol", symbol),
					zap.Float64("volume", update.Volume),
					zap.Float64("market_cap", update.MarketCap))
				
				// Record position metrics when enabling trading
				m.metrics.RecordPosition(symbol, update.TotalSupply, update.Price)
			} else {
				m.logger.Info("token trading disabled",
					zap.String("symbol", symbol),
					zap.Float64("volume", update.Volume),
					zap.Float64("market_cap", update.MarketCap))
				
				// Clear position metrics when disabling trading
				m.metrics.RecordPosition(symbol, 0, update.Price)
			}
		}

		m.tradeable[symbol] = shouldEnable
		metrics.PumpTokenTradingEnabled.WithLabelValues(symbol).Set(btoi(shouldEnable))
	}
}

func btoi(b bool) float64 {
	if b {
		return 1
	}
	return 0
}
