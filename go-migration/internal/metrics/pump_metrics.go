package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	PumpNewTokens = promauto.NewCounter(prometheus.CounterOpts{
		Name: "pump_new_tokens_total",
		Help: "Total number of new tokens detected",
	})

	PumpTokenPrice = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "pump_token_price",
		Help: "Current token price",
	}, []string{"symbol"})

	PumpTokenVolume = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "pump_token_volume_24h",
		Help: "24h trading volume",
	}, []string{"symbol"})

	PumpBondingCurvePrice = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "pump_bonding_curve_price",
		Help: "Current bonding curve price",
	}, []string{"symbol"})

	PumpWebsocketConnections = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "pump_websocket_connections",
		Help: "Number of active WebSocket connections",
	})

	PumpAPIErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "pump_api_errors_total",
		Help: "Total number of API errors",
	}, []string{"operation"})
)
