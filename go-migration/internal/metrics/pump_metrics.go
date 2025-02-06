package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

var (
	TokenPrice = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_token_price",
			Help: "Token price",
		},
		[]string{"symbol"},
	)

	TokenVolume = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_token_volume",
			Help: "Token volume",
		},
		[]string{"symbol"},
	)

	TradeExecutions = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pump_trade_executions",
			Help: "Number of trade executions",
		},
		[]string{"symbol", "side"},
	)

	PositionSize = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_position_size",
			Help: "Position size",
		},
		[]string{"symbol"},
	)

	RiskLimits = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_risk_limits",
			Help: "Risk limits",
		},
		[]string{"symbol", "type"},
	)

	StopLossTriggers = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pump_stop_loss_triggers",
			Help: "Number of stop loss triggers",
		},
		[]string{"symbol"},
	)

	TakeProfitTriggers = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pump_take_profit_triggers",
			Help: "Number of take profit triggers",
		},
		[]string{"symbol"},
	)

	UnrealizedPnL = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_unrealized_pnl",
			Help: "Unrealized PnL",
		},
		[]string{"symbol"},
	)

	APIKeyUsage = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "api_key_usage",
			Help: "API key usage",
		},
		[]string{"key"},
	)

	TotalVolume = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_total_volume",
			Help: "Total trading volume",
		},
		[]string{"symbol"},
	)

	RiskExposure = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_risk_exposure",
			Help: "Risk exposure",
		},
		[]string{"symbol"},
	)

	TotalRiskExposure = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_total_risk_exposure",
			Help: "Total risk exposure",
		},
		[]string{},
	)

	TokenMarketCap = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_token_market_cap",
			Help: "Token market cap",
		},
		[]string{"symbol"},
	)

	TokenPriceChangeHour = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_token_price_change_hour",
			Help: "Token price change in the last hour",
		},
		[]string{"symbol"},
	)

	TokenPriceChangeDay = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_token_price_change_day",
			Help: "Token price change in the last day",
		},
		[]string{"symbol"},
	)

	ActiveTokens = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_active_tokens",
			Help: "Number of active tokens",
		},
		[]string{},
	)

	LastUpdate = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_last_update",
			Help: "Last update timestamp",
		},
		[]string{"type"},
	)

	NewTokensTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "pump_new_tokens_total",
			Help: "Total number of new tokens",
		},
		[]string{},
	)

	WebsocketConnections = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "pump_websocket_connections",
			Help: "Number of websocket connections",
		},
		[]string{"type"},
	)
)

type PumpMetrics struct {
	TokenPrice          *prometheus.GaugeVec
	TokenVolume         *prometheus.GaugeVec
	TradeExecutions     *prometheus.CounterVec
	PositionSize        *prometheus.GaugeVec
	RiskLimits          *prometheus.GaugeVec
	StopLossTriggers    *prometheus.CounterVec
	TakeProfitTriggers  *prometheus.CounterVec
	UnrealizedPnL       *prometheus.GaugeVec
	APIKeyUsage         *prometheus.CounterVec
	TotalVolume         *prometheus.GaugeVec
	RiskExposure        *prometheus.GaugeVec
	TotalRiskExposure   *prometheus.GaugeVec
	TokenMarketCap      *prometheus.GaugeVec
	TokenPriceChangeHour *prometheus.GaugeVec
	TokenPriceChangeDay  *prometheus.GaugeVec
	ActiveTokens        *prometheus.GaugeVec
	LastUpdate          *prometheus.GaugeVec
	NewTokensTotal      *prometheus.CounterVec
	WebsocketConnections *prometheus.GaugeVec
}

// NewPumpMetrics creates a new instance of PumpMetrics with initialized metrics
func NewPumpMetrics() *PumpMetrics {
	return &PumpMetrics{
		TokenPrice:          TokenPrice,
		TokenVolume:         TokenVolume,
		TradeExecutions:     PumpTradeExecutions,
		PositionSize:        PumpPositionSize,
		RiskLimits:          PumpRiskLimits,
		StopLossTriggers:    PumpStopLossTriggers,
		TakeProfitTriggers:  PumpTakeProfitTriggers,
		UnrealizedPnL:       PumpUnrealizedPnL,
		APIKeyUsage:         APIKeyUsage,
		TotalVolume:         PumpTotalVolume,
		RiskExposure:        PumpRiskExposure,
		TotalRiskExposure:   PumpTotalRiskExposure,
		TokenMarketCap:      TokenMarketCap,
		TokenPriceChangeHour: TokenPriceChangeHour,
		TokenPriceChangeDay:  TokenPriceChangeDay,
		ActiveTokens:        ActiveTokens,
		LastUpdate:          LastUpdate,
		NewTokensTotal:      NewTokensTotal,
		WebsocketConnections: WebsocketConnections,
		TradeVolume:         NewGaugeVec("pump_trade_volume", "Trading volume", []string{"symbol"}),
		PositionPnL:         NewGaugeVec("pump_position_pnl", "Position PnL", []string{"symbol"}),
		TotalValue:          NewGaugeVec("pump_total_value", "Total value", []string{"symbol"}),
		PendingTrades:       NewGaugeVec("pump_pending_trades", "Pending trades", []string{"symbol"}),
	}
}
