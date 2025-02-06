package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	GMGNTradeExecutions = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gmgn_trade_executions_total",
			Help: "Total number of GMGN trade executions",
		},
		[]string{"status"},
	)

	GMGNQuoteLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "gmgn_quote_latency_seconds",
			Help: "Latency of GMGN quote requests",
			Buckets: []float64{0.1, 0.5, 1, 2, 5},
		},
		[]string{"operation"},
	)

	GMGNRiskLimits = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "gmgn_risk_limits",
			Help: "GMGN risk management limits and violations",
		},
		[]string{"type"},
	)

	GMGNPositionValue = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "gmgn_position_value",
			Help: "Current value of GMGN positions",
		},
		[]string{"symbol"},
	)

	GMGNTradeVolume = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "gmgn_trade_volume_total",
			Help: "Total trading volume on GMGN",
		},
		[]string{"symbol", "side"},
	)
)
