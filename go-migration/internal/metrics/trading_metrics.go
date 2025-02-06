package metrics

import "github.com/prometheus/client_golang/prometheus"

var (
	TokenTransfers = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pump_token_transfers_total",
			Help: "Total number of token transfers by symbol",
		},
		[]string{"symbol"},
	)

	TransferVolume = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_transfer_volume",
			Help: "Volume of token transfers by symbol",
		},
		[]string{"symbol"},
	)

	SolanaTransactions = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "solana_transactions_total",
			Help: "Total number of Solana transactions by type",
		},
		[]string{"type"},
	)

	SolanaVolume = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "solana_volume",
			Help: "Volume of Solana transactions by type",
		},
		[]string{"type"},
	)

	TradingStatus = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "trading_status",
			Help: "Trading system status (1 = active, 0 = inactive)",
		},
		[]string{"component"},
	)

	ActiveStrategies = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "active_strategies",
			Help: "Number of active trading strategies by type",
		},
		[]string{"type"},
	)

	StrategyPnL = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "strategy_pnl",
			Help: "Strategy PnL by type",
		},
		[]string{"type"},
	)
)

func init() {
	prometheus.MustRegister(
		TokenTransfers,
		TransferVolume,
		SolanaTransactions,
		SolanaVolume,
		TradingStatus,
		ActiveStrategies,
		StrategyPnL,
	)
}
