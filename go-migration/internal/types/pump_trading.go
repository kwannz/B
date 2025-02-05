package types

import (
	"context"
	"time"
	"github.com/shopspring/decimal"
)

type PumpTradingConfig struct {
	MaxMarketCap     decimal.Decimal `yaml:"max_market_cap"`
	MinVolume        decimal.Decimal `yaml:"min_volume"`
	WebSocket        WSConfig        `yaml:"websocket"`
	Risk             RiskConfig      `yaml:"risk"`
	TakeProfitLevels []ProfitLevel   `yaml:"take_profit_levels"`
}

type WSConfig struct {
	ReconnectTimeout time.Duration `yaml:"reconnect_timeout"`
	PingInterval     time.Duration `yaml:"ping_interval"`
	WriteTimeout     time.Duration `yaml:"write_timeout"`
	ReadTimeout      time.Duration `yaml:"read_timeout"`
	PongWait        time.Duration `yaml:"pong_wait"`
	MaxRetries      int           `yaml:"max_retries"`
}

type StopLossConfig struct {
	Initial  decimal.Decimal `yaml:"initial"`
	Trailing decimal.Decimal `yaml:"trailing"`
}

type PumpTrader interface {
	ExecuteTrade(ctx context.Context, signal *Signal) error
	GetPosition(symbol string) *Position
	GetPositions() map[string]*Position
	Start() error
	Stop() error
}

type PumpMarketData interface {
	GetTokenPrice(ctx context.Context, symbol string) (decimal.Decimal, error)
	GetTokenVolume(ctx context.Context, symbol string) (decimal.Decimal, error)
	GetBondingCurve(ctx context.Context, symbol string) (*BondingCurve, error)
	SubscribeNewTokens(ctx context.Context) (<-chan *TokenInfo, error)
	GetTokenUpdates() <-chan *TokenUpdate
}

type PumpRiskManager interface {
	ValidatePosition(symbol string, size decimal.Decimal) error
	CalculatePositionSize(symbol string, price decimal.Decimal) (decimal.Decimal, error)
	UpdateStopLoss(symbol string, price decimal.Decimal) error
	CheckTakeProfit(symbol string, price decimal.Decimal) (bool, decimal.Decimal)
}

type PumpStrategy interface {
	Name() string
	Init(ctx context.Context) error
	ProcessUpdate(update *TokenUpdate) error
	ExecuteTrade(ctx context.Context, signal *Signal) error
	GetConfig() *PumpTradingConfig
	GetRiskManager() PumpRiskManager
}
