package metrics

// NewPumpMetrics creates a new instance of PumpMetrics with initialized metrics
func NewPumpMetrics() *PumpMetrics {
	return &PumpMetrics{
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
		TokenMarketCap:      TokenMarketCap,
		TokenPriceChangeHour: TokenPriceChangeHour,
		TokenPriceChangeDay:  TokenPriceChangeDay,
		ActiveTokens:        ActiveTokens,
		LastUpdate:         LastUpdate,
		NewTokensTotal:     NewTokensTotal,
		WebsocketConnections: WebsocketConnections,
	}
}
