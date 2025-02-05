package metrics

import (
	"sync"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	dto "github.com/prometheus/client_model/go"
)

var (
	pumpMetricsOnce sync.Once
	TokenPrice = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "pump_token_price",
		Help: "Current token price",
	}, []string{"provider", "symbol"})

	TokenVolume = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "pump_token_volume",
		Help: "24h trading volume",
	}, []string{"provider", "symbol"})

	NewTokensTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "pump_new_tokens_total",
		Help: "Total number of new tokens detected",
	})

	PumpTradeExecutions = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "pump_trade_executions_total",
		Help: "Total number of trade executions",
	}, []string{"status"})

	WebsocketConnections = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "pump_websocket_connections",
		Help: "Number of active WebSocket connections",
	})

	APIErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "pump_api_errors_total",
		Help: "Total number of API errors",
	}, []string{"type"})

	PumpPositionSize = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "pump_position_size",
		Help: "Current position size",
	}, []string{"symbol"})

	PumpRiskLimits = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "pump_risk_limits",
		Help: "Risk management limits",
	}, []string{"type"})

	PumpStopLossTriggers = promauto.NewCounter(prometheus.CounterOpts{
		Name: "pump_stop_loss_triggers_total",
		Help: "Total number of stop loss triggers",
	})

	PumpTakeProfitTriggers = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "pump_take_profit_triggers_total",
		Help: "Total number of take profit triggers",
	}, []string{"level"})

	PumpUnrealizedPnL = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "pump_unrealized_pnl",
		Help: "Unrealized PnL per position",
	}, []string{"symbol"})

	APIKeyUsage = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "api_key_usage_total",
		Help: "Total number of API key usages",
	}, []string{"provider", "type"})

	PumpTotalVolume = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "pump_total_volume",
		Help: "Total trading volume",
	}, []string{"provider"})

	PumpRiskExposure = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "pump_risk_exposure",
		Help: "Current risk exposure per symbol",
	}, []string{"symbol"})

	PumpTotalRiskExposure = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "pump_total_risk_exposure",
		Help: "Total risk exposure",
	}, []string{"provider"})

	TokenMarketCap = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Name: "pump_token_market_cap",
		Help: "Current token market capitalization",
	}, []string{"provider", "symbol"})
)

func GetVolumes() map[string]float64 {
	volumes := make(map[string]float64)
	metrics := make(chan prometheus.Metric, 100)
	TokenVolume.Collect(metrics)
	
	for metric := range metrics {
		m := &dto.Metric{}
		metric.Write(m)
		if m.Label != nil && m.Gauge != nil {
			symbol := ""
			for _, label := range m.Label {
				if label.GetName() == "symbol" {
					symbol = label.GetValue()
					break
				}
			}
			if symbol != "" {
				volumes[symbol] = m.Gauge.GetValue()
			}
		}
	}
	return volumes
}

func GetPreviousVolume(symbol string) float64 {
	return 0
}

func GetMarketCaps() map[string]float64 {
	marketCaps := make(map[string]float64)
	metrics := make(chan prometheus.Metric, 100)
	TokenVolume.Collect(metrics)
	
	for metric := range metrics {
		m := &dto.Metric{}
		metric.Write(m)
		if m.Label != nil && m.Gauge != nil {
			symbol := ""
			for _, label := range m.Label {
				if label.GetName() == "symbol" {
					symbol = label.GetValue()
					break
				}
			}
			if symbol != "" {
				marketCaps[symbol] = m.Gauge.GetValue()
			}
		}
	}
	return marketCaps
}

type PumpMetrics struct {
	TokenPrice          *prometheus.GaugeVec
	TokenVolume         *prometheus.GaugeVec
	TradeExecutions     *prometheus.CounterVec
	PositionSize        *prometheus.GaugeVec
	RiskLimits          *prometheus.GaugeVec
	StopLossTriggers    prometheus.Counter
	TakeProfitTriggers  *prometheus.CounterVec
	UnrealizedPnL      *prometheus.GaugeVec
	APIKeyUsage         *prometheus.CounterVec
	TotalVolume         *prometheus.CounterVec
	RiskExposure        *prometheus.GaugeVec
	TotalRiskExposure   *prometheus.CounterVec
}

var pumpMetrics *PumpMetrics

func init() {
	pumpMetricsOnce.Do(func() {
		pumpMetrics = &PumpMetrics{
			TokenPrice:         TokenPrice,
			TokenVolume:        TokenVolume,
			TradeExecutions:    PumpTradeExecutions,
			PositionSize:       PumpPositionSize,
			RiskLimits:         PumpRiskLimits,
			StopLossTriggers:   PumpStopLossTriggers,
			TakeProfitTriggers: PumpTakeProfitTriggers,
			UnrealizedPnL:      PumpUnrealizedPnL,
			APIKeyUsage:        APIKeyUsage,
			TotalVolume:        PumpTotalVolume,
			RiskExposure:       PumpRiskExposure,
			TotalRiskExposure:  PumpTotalRiskExposure,
		}
	})
}

func GetPumpMetrics() *PumpMetrics {
	if pumpMetrics == nil {
		pumpMetricsOnce.Do(func() {
			pumpMetrics = &PumpMetrics{
				TokenPrice:         TokenPrice,
				TokenVolume:        TokenVolume,
				TradeExecutions:    PumpTradeExecutions,
				PositionSize:       PumpPositionSize,
				RiskLimits:         PumpRiskLimits,
				StopLossTriggers:   PumpStopLossTriggers,
				TakeProfitTriggers: PumpTakeProfitTriggers,
				UnrealizedPnL:      PumpUnrealizedPnL,
				APIKeyUsage:        APIKeyUsage,
				TotalVolume:        PumpTotalVolume,
				RiskExposure:       PumpRiskExposure,
				TotalRiskExposure:  PumpTotalRiskExposure,
			}
		})
	}
	return pumpMetrics
}
