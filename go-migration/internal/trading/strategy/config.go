package strategy

import (
	"time"
)

import (
	"github.com/shopspring/decimal"
)

type EarlyEntryConfig struct {
	MaxMarketCap    decimal.Decimal `yaml:"max_market_cap"`
	MinLiquidity    decimal.Decimal `yaml:"min_liquidity"`
	VolumeThreshold decimal.Decimal `yaml:"volume_threshold"`
}

type PositionSizingConfig struct {
	MaxPositionSize decimal.Decimal `yaml:"max_position_size"`
	MinPositionSize decimal.Decimal `yaml:"min_position_size"`
}

type StopLossConfig struct {
	Initial  decimal.Decimal `yaml:"initial"`
	Trailing decimal.Decimal `yaml:"trailing"`
}

type RiskManagementConfig struct {
	PositionSizing   PositionSizingConfig `yaml:"position_sizing"`
	StopLoss         StopLossConfig       `yaml:"stop_loss"`
	TakeProfitLevels []decimal.Decimal    `yaml:"take_profit_levels"`
}

type IndicatorConfig struct {
	RSI struct {
		Period     int             `yaml:"period"`
		Overbought decimal.Decimal `yaml:"overbought"`
		Oversold   decimal.Decimal `yaml:"oversold"`
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
