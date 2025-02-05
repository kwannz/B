package strategy

import (
	"time"
)

type EarlyEntryConfig struct {
	MaxMarketCap    float64 `yaml:"max_market_cap"`
	MinLiquidity    float64 `yaml:"min_liquidity"`
	VolumeThreshold float64 `yaml:"volume_threshold"`
}

type BatchTradingStage struct {
	Percentage     float64 `yaml:"percentage"`
	TargetMultiple float64 `yaml:"target_multiple"`
}

type BatchTradingConfig struct {
	Stages []BatchTradingStage `yaml:"stages"`
}

type PositionSizingConfig struct {
	MaxPositionSize float64 `yaml:"max_position_size"`
	MinPositionSize float64 `yaml:"min_position_size"`
}

type StopLossConfig struct {
	Initial  float64 `yaml:"initial"`
	Trailing float64 `yaml:"trailing"`
}

type RiskManagementConfig struct {
	PositionSizing PositionSizingConfig `yaml:"position_sizing"`
	StopLoss       StopLossConfig       `yaml:"stop_loss"`
	TakeProfitLevels []float64         `yaml:"take_profit_levels"`
}

type IndicatorConfig struct {
	RSI struct {
		Period     int     `yaml:"period"`
		Overbought float64 `yaml:"overbought"`
		Oversold   float64 `yaml:"oversold"`
	} `yaml:"rsi"`
	MovingAverages struct {
		FastPeriod int `yaml:"fast_period"`
		SlowPeriod int `yaml:"slow_period"`
	} `yaml:"moving_averages"`
}

type TechnicalAnalysisConfig struct {
	Timeframes []string       `yaml:"timeframes"`
	Indicators IndicatorConfig `yaml:"indicators"`
}

type MonitoringConfig struct {
	PriceUpdateInterval  time.Duration `yaml:"price_update_interval"`
	VolumeUpdateInterval time.Duration `yaml:"volume_update_interval"`
	MetricsUpdateInterval time.Duration `yaml:"metrics_update_interval"`
}

type TradingConfig struct {
	EarlyEntry        EarlyEntryConfig        `yaml:"early_entry"`
	BatchTrading      BatchTradingConfig      `yaml:"batch_trading"`
	RiskManagement    RiskManagementConfig    `yaml:"risk_management"`
	TechnicalAnalysis TechnicalAnalysisConfig `yaml:"technical_analysis"`
	Monitoring        MonitoringConfig        `yaml:"monitoring"`
}
