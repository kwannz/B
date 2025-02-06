package types

import (
	"context"
	"time"
	"github.com/shopspring/decimal"
)

type PumpTradingConfig struct {
	MaxMarketCap decimal.Decimal `yaml:"max_market_cap"`
	MinVolume    decimal.Decimal `yaml:"min_volume"`
	WebSocket    WSConfig        `yaml:"websocket"`
	Risk         struct {
		MaxPositionSize decimal.Decimal   `yaml:"max_position_size"`
		MinPositionSize decimal.Decimal   `yaml:"min_position_size"`
		StopLossPercent decimal.Decimal   `yaml:"stop_loss_percent"`
		TakeProfitLevels []decimal.Decimal `yaml:"take_profit_levels"`
	} `yaml:"risk"`
}

type WSConfig struct {
	ReconnectTimeout time.Duration `yaml:"reconnect_timeout"`
	PingInterval     time.Duration `yaml:"ping_interval"`
	WriteTimeout     time.Duration `yaml:"write_timeout"`
	ReadTimeout      time.Duration `yaml:"read_timeout"`
	PongWait        time.Duration `yaml:"pong_wait"`
	MaxRetries      int           `yaml:"max_retries"`
	APIKey          string        `yaml:"api_key"`
	DialTimeout     time.Duration `yaml:"dial_timeout"`
}

type StopLossConfig struct {
	Initial  decimal.Decimal `yaml:"initial"`
	Trailing decimal.Decimal `yaml:"trailing"`
}

type PumpExecutor interface {
	ExecuteTrade(ctx context.Context, signal *Signal) error
	GetPosition(symbol string) *Position
	GetPositions() map[string]*Position
	GetRiskManager() PumpRiskManager
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
}
