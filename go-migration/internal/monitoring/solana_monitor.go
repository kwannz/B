package monitoring

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type SolanaMonitor struct {
	logger     *zap.Logger
	metrics    *metrics.PumpMetrics
	mu         sync.RWMutex
	lastUpdate time.Time
	account    string
	trades     []*types.Trade
}

func NewSolanaMonitor(logger *zap.Logger, metrics *metrics.PumpMetrics, account string) *SolanaMonitor {
	return &SolanaMonitor{
		logger:  logger,
		metrics: metrics,
		account: account,
		trades:  make([]*types.Trade, 0),
	}
}

func (m *SolanaMonitor) Start(ctx context.Context) error {
	m.logger.Info("Starting Solana account monitor",
		zap.String("account", m.account))
	go m.monitorTransactions(ctx)
	return nil
}

func (m *SolanaMonitor) monitorTransactions(ctx context.Context) {
	ticker := time.NewTicker(time.Second * 30)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := m.fetchTransactions(); err != nil {
				m.logger.Error("Failed to fetch transactions",
					zap.Error(err))
				metrics.APIErrors.WithLabelValues("solana_fetch").Inc()
				continue
			}
		}
	}
}

func (m *SolanaMonitor) fetchTransactions() error {
	url := fmt.Sprintf("https://public-api.solscan.io/account/%s/transactions", m.account)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to fetch transactions: %w", err)
	}
	defer resp.Body.Close()

	var transactions []struct {
		Signature      string    `json:"signature"`
		BlockTime     int64     `json:"blockTime"`
		Status        string    `json:"status"`
		TokenTransfers []struct {
			Source      string  `json:"source"`
			Destination string  `json:"destination"`
			Amount      float64 `json:"amount"`
			Symbol      string  `json:"symbol"`
		} `json:"tokenTransfers"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&transactions); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	for _, tx := range transactions {
		if tx.Status != "Success" {
			continue
		}

		for _, transfer := range tx.TokenTransfers {
			if transfer.Source == m.account || transfer.Destination == m.account {
				m.logger.Info("Detected token transfer",
					zap.String("tx", tx.Signature),
					zap.String("symbol", transfer.Symbol),
					zap.Float64("amount", transfer.Amount),
					zap.String("source", transfer.Source),
					zap.String("destination", transfer.Destination))

				metrics.TokenTransfers.WithLabelValues(transfer.Symbol).Inc()
				metrics.TransferVolume.WithLabelValues(transfer.Symbol).Add(transfer.Amount)
			}
		}
	}

	m.lastUpdate = time.Now()
	return nil
}

func (m *SolanaMonitor) GetLastUpdate() time.Time {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.lastUpdate
}
