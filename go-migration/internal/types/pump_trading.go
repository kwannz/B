package types

import (
	"context"
	"time"
)

type PumpTradingConfig struct {
	MaxMarketCap     float64       `yaml:"max_market_cap"`
	MinVolume        float64       `yaml:"min_volume"`
	WebSocket        WSConfig      `yaml:"websocket"`
	Risk            RiskConfig    `yaml:"risk"`
	ProfitTaking    []ProfitLevel `yaml:"profit_taking"`
}

type WSConfig struct {
	ReconnectTimeout time.Duration `yaml:"reconnect_timeout"`
	PingInterval     time.Duration `yaml:"ping_interval"`
	WriteTimeout     time.Duration `yaml:"write_timeout"`
	ReadTimeout      time.Duration `yaml:"read_timeout"`
	PongWait        time.Duration `yaml:"pong_wait"`
	MaxRetries      int           `yaml:"max_retries"`
}

type RiskConfig struct {
	MaxPositionSize float64    `yaml:"max_position_size"`
	MinPositionSize float64    `yaml:"min_position_size"`
	StopLoss       StopLoss   `yaml:"stop_loss"`
}

type StopLoss struct {
	Initial  float64 `yaml:"initial"`
	Trailing float64 `yaml:"trailing"`
}

type ProfitLevel struct {
	Level      float64 `yaml:"level"`
	Percentage float64 `yaml:"percentage"`
}

type PumpTrader interface {
	ExecuteTrade(ctx context.Context, signal *Signal) error
	GetPosition(symbol string) *Position
	GetPositions() map[string]*Position
	Start() error
	Stop() error
}

type PumpMarketData interface {
	GetTokenPrice(ctx context.Context, symbol string) (float64, error)
	GetTokenVolume(ctx context.Context, symbol string) (float64, error)
	GetBondingCurve(ctx context.Context, symbol string) (*TokenBondingCurve, error)
	SubscribeNewTokens(ctx context.Context) (<-chan *TokenInfo, error)
	GetTokenUpdates() <-chan *TokenUpdate
}

type PumpRiskManager interface {
	ValidatePosition(symbol string, size float64) error
	CalculatePositionSize(symbol string, price float64) (float64, error)
	UpdateStopLoss(symbol string, price float64) error
	CheckTakeProfit(symbol string, price float64) (bool, float64)
}

type PumpStrategy interface {
	Name() string
	Init(ctx context.Context) error
	ProcessUpdate(update *TokenUpdate) error
	ExecuteTrade(ctx context.Context, signal *Signal) error
	GetConfig() *PumpTradingConfig
	GetRiskManager() PumpRiskManager
}
