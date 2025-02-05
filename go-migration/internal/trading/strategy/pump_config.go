package strategy

import (
	"time"
)

type PumpFunConfig struct {
	MaxMarketCap     float64 `yaml:"max_market_cap"`
	MinVolume        float64 `yaml:"min_volume"`
	APIKey           string  `yaml:"api_key"`
	WebSocket struct {
		ReconnectTimeout time.Duration `yaml:"reconnect_timeout"`
		PingInterval     time.Duration `yaml:"ping_interval"`
		WriteTimeout     time.Duration `yaml:"write_timeout"`
		ReadTimeout      time.Duration `yaml:"read_timeout"`
		PongWait        time.Duration `yaml:"pong_wait"`
		MaxRetries      int           `yaml:"max_retries"`
	} `yaml:"websocket"`
	Risk struct {
		MaxPositionSize float64 `yaml:"max_position_size"`
		MinPositionSize float64 `yaml:"min_position_size"`
		StopLoss struct {
			Initial  float64 `yaml:"initial"`
			Trailing float64 `yaml:"trailing"`
		} `yaml:"stop_loss"`
	} `yaml:"risk"`
	ProfitTaking []struct {
		Level      float64 `yaml:"level"`
		Percentage float64 `yaml:"percentage"`
	} `yaml:"profit_taking"`
}

func NewDefaultPumpFunConfig() *PumpFunConfig {
	return &PumpFunConfig{
		MaxMarketCap: 30000.0,
		MinVolume:    1000.0,
		WebSocket: struct {
			ReconnectTimeout time.Duration `yaml:"reconnect_timeout"`
			PingInterval     time.Duration `yaml:"ping_interval"`
			WriteTimeout     time.Duration `yaml:"write_timeout"`
			ReadTimeout      time.Duration `yaml:"read_timeout"`
			PongWait        time.Duration `yaml:"pong_wait"`
			MaxRetries      int           `yaml:"max_retries"`
		}{
			ReconnectTimeout: 30 * time.Second,
			PingInterval:     15 * time.Second,
			WriteTimeout:     45 * time.Second,
			ReadTimeout:      45 * time.Second,
			PongWait:        90 * time.Second,
			MaxRetries:      5,
		},
		Risk: struct {
			MaxPositionSize float64 `yaml:"max_position_size"`
			MinPositionSize float64 `yaml:"min_position_size"`
			StopLoss       struct {
				Initial  float64 `yaml:"initial"`
				Trailing float64 `yaml:"trailing"`
			} `yaml:"stop_loss"`
		}{
			MaxPositionSize: 0.02,
			MinPositionSize: 0.01,
			StopLoss: struct {
				Initial  float64 `yaml:"initial"`
				Trailing float64 `yaml:"trailing"`
			}{
				Initial:  0.05,
				Trailing: 0.03,
			},
		},
		ProfitTaking: []struct {
			Level      float64 `yaml:"level"`
			Percentage float64 `yaml:"percentage"`
		}{
			{Level: 2.0, Percentage: 0.20},
			{Level: 3.0, Percentage: 0.25},
			{Level: 5.0, Percentage: 0.20},
		},
	}
}
