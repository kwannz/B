package pump

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type WSClient struct {
	url        string
	apiKey     string
	conn       *websocket.Conn
	logger     *zap.Logger
	mu         sync.RWMutex
	done       chan struct{}
	updates    chan *types.TokenUpdate
	config     WSConfig
	metrics    *metrics.PumpMetrics
}

type WSConfig struct {
	APIKey         string
	DialTimeout    time.Duration
	WriteTimeout   time.Duration
	ReadTimeout    time.Duration
	PongWait       time.Duration
	PingInterval   time.Duration
	MaxRetries     int
}

func NewWSClient(url string, logger *zap.Logger, config WSConfig) *WSClient {
	if config.PingInterval == 0 {
		config.PingInterval = 15 * time.Second
	}
	if config.PongWait == 0 {
		config.PongWait = 60 * time.Second
	}
	if config.WriteTimeout == 0 {
		config.WriteTimeout = 10 * time.Second
	}
	if config.ReadTimeout == 0 {
		config.ReadTimeout = 60 * time.Second
	}
	if config.DialTimeout == 0 {
		config.DialTimeout = 10 * time.Second
	}
	if config.MaxRetries == 0 {
		config.MaxRetries = 5
	}

	return &WSClient{
		url:     url,
		apiKey:  config.APIKey,
		logger:  logger,
		done:    make(chan struct{}),
		updates: make(chan *types.TokenUpdate, 100),
		config:  config,
		metrics: metrics.NewPumpMetrics(),
	}
}

func (c *WSClient) Connect(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Close existing connection if any
	if c.conn != nil {
		c.conn.Close()
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: c.config.DialTimeout,
		EnableCompression: true,
	}

	headers := map[string][]string{
		"User-Agent": {"TradingBot/1.0"},
	}
	
	if c.apiKey != "" {
		headers["X-API-Key"] = []string{c.apiKey}
		headers["Authorization"] = []string{fmt.Sprintf("Bearer %s", c.apiKey)}
	}

	conn, resp, err := dialer.DialContext(ctx, c.url, headers)
	if err != nil {
		metrics.PumpWebSocketErrors.WithLabelValues("connect").Inc()
		metrics.PumpWebSocketConnections.Set(0)
		if resp != nil {
			c.logger.Error("WebSocket connection failed",
				zap.Int("status_code", resp.StatusCode),
				zap.Error(err))
			return fmt.Errorf("failed to connect to WebSocket (status %d): %w", resp.StatusCode, err)
		}
		return fmt.Errorf("failed to connect to WebSocket: %w", err)
	}
	metrics.PumpWebSocketConnections.Set(1)

	c.conn = conn
	c.setupPingPong()
	go c.readPump()

	c.logger.Info("Successfully connected to WebSocket",
		zap.String("url", c.url))

	return nil
}

func (c *WSClient) setupPingPong() {
	ticker := time.NewTicker(c.config.PingInterval)
	lastPong := time.Now()
	
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-c.done:
				metrics.PumpWebSocketConnections.Set(0)
				return
			case <-ticker.C:
				if time.Since(lastPong) > c.config.PongWait {
					metrics.PumpWebSocketErrors.WithLabelValues("pong_timeout").Inc()
					metrics.PumpWebSocketConnections.Set(0)
					c.logger.Error("Pong timeout exceeded",
						zap.Duration("timeout", c.config.PongWait),
						zap.Duration("since_last_pong", time.Since(lastPong)))
					c.reconnect()
					return
				}

				if err := c.conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(c.config.WriteTimeout)); err != nil {
					metrics.PumpWebSocketErrors.WithLabelValues("ping").Inc()
					metrics.PumpWebSocketConnections.Set(0)
					c.logger.Error("Failed to write ping message", zap.Error(err))
					c.reconnect()
					return
				}
				
				metrics.PumpWebSocketPings.Inc()
				c.logger.Debug("Ping sent successfully")
			}
		}
	}()

	c.conn.SetPongHandler(func(string) error {
		lastPong = time.Now()
		c.conn.SetReadDeadline(time.Now().Add(c.config.PongWait))
		metrics.PumpWebSocketPongs.Inc()
		metrics.PumpWebSocketConnections.Set(1)
		c.logger.Debug("Pong received successfully",
			zap.Time("last_pong", lastPong))
		return nil
	})
}

func (c *WSClient) readPump() {
	defer func() {
		c.conn.Close()
		close(c.updates)
	}()

	for {
		select {
		case <-c.done:
			return
		default:
			c.conn.SetReadDeadline(time.Now().Add(c.config.ReadTimeout))
			_, message, err := c.conn.ReadMessage()
			if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					metrics.PumpWebSocketErrors.WithLabelValues("unexpected_close").Inc()
					metrics.PumpWebSocketConnections.Set(0)
					c.logger.Error("Unexpected WebSocket closure", zap.Error(err))
				} else {
					metrics.PumpWebSocketErrors.WithLabelValues("read").Inc()
					c.logger.Error("WebSocket read error", zap.Error(err))
				}
				c.reconnect()
				continue
			}

			var response struct {
				Method string           `json:"method"`
				Data   *types.TokenUpdate `json:"data"`
				Error  string           `json:"error,omitempty"`
			}

			if err := json.Unmarshal(message, &response); err != nil {
				metrics.PumpWebSocketErrors.WithLabelValues("unmarshal").Inc()
				c.logger.Error("Failed to unmarshal message", zap.Error(err))
				continue
			}

			if response.Error != "" {
				metrics.PumpWebSocketErrors.WithLabelValues("api_error").Inc()
				c.logger.Error("API error received", 
					zap.String("error", response.Error),
					zap.String("method", response.Method))
				continue
			}

			if response.Data == nil {
				continue
			}

			// Validate token update
			if response.Data.Symbol == "" || response.Data.Price <= 0 {
				c.logger.Warn("Invalid token update received",
					zap.Any("update", response.Data))
				continue
			}

			// Update metrics
			metrics.PumpNewTokens.Inc()
			if response.Data.MarketCap > 0 {
				metrics.PumpTokenMarketCap.WithLabelValues(response.Data.Symbol).Set(response.Data.MarketCap)
			}
			if response.Data.Volume > 0 {
				metrics.PumpTokenVolume.WithLabelValues(response.Data.Symbol).Set(response.Data.Volume)
			}

			// Log token details at debug level
			c.logger.Debug("New token detected",
				zap.String("symbol", response.Data.Symbol),
				zap.Float64("price", response.Data.Price),
				zap.Float64("market_cap", response.Data.MarketCap),
				zap.Float64("volume", response.Data.Volume),
				zap.String("address", response.Data.Address))

			// Send update
			select {
			case c.updates <- response.Data:
				c.logger.Debug("Token update sent",
					zap.String("symbol", response.Data.Symbol),
					zap.Float64("price", response.Data.Price),
					zap.String("method", response.Method))
			default:
				c.logger.Warn("Update channel full, dropping update",
					zap.String("symbol", response.Data.Symbol))
			}
		}
	}
}

func (c *WSClient) Subscribe(methods []string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn == nil {
		return fmt.Errorf("websocket connection not established")
	}

	c.conn.SetWriteDeadline(time.Now().Add(c.config.WriteTimeout))

	// Subscribe to new token events with authentication
	payload := map[string]interface{}{
		"method": "subscribeNewToken",
		"params": map[string]interface{}{
			"api_key": c.apiKey,
			"options": map[string]interface{}{
				"reconnect": true,
				"batch": true,
			},
		},
	}

	if err := c.conn.WriteJSON(payload); err != nil {
		metrics.PumpWebSocketErrors.WithLabelValues("subscribe").Inc()
		return fmt.Errorf("failed to subscribe to new tokens: %w", err)
	}

	// Subscribe to additional methods if provided
	for _, method := range methods {
		if method == "subscribeNewToken" {
			continue
		}
		
		methodPayload := map[string]interface{}{
			"method": method,
			"params": map[string]interface{}{
				"api_key": c.apiKey,
				"options": map[string]interface{}{
					"reconnect": true,
					"batch": true,
				},
			},
		}

		if err := c.conn.WriteJSON(methodPayload); err != nil {
			metrics.PumpWebSocketErrors.WithLabelValues("subscribe").Inc()
			return fmt.Errorf("failed to subscribe to %s: %w", method, err)
		}
	}

	return nil
}

func (c *WSClient) reconnect() {
	c.mu.Lock()
	defer c.mu.Unlock()

	metrics.PumpWebSocketConnections.Set(0)
	retries := 0
	backoff := time.Second
	maxBackoff := 30 * time.Second

	for retries < c.config.MaxRetries {
		c.logger.Info("Attempting to reconnect", 
			zap.Int("retry", retries+1),
			zap.Duration("backoff", backoff))
		
		if err := c.Connect(context.Background()); err == nil {
			c.logger.Info("Successfully reconnected")
			// Resubscribe to previous subscriptions
			if err := c.Subscribe([]string{"subscribeNewToken"}); err != nil {
				metrics.PumpWebSocketErrors.WithLabelValues("resubscribe").Inc()
				c.logger.Error("Failed to resubscribe after reconnect", zap.Error(err))
				metrics.PumpWebSocketConnections.Set(0)
				continue
			}
			return
		}

		retries++
		time.Sleep(backoff)
		backoff = time.Duration(float64(backoff) * 1.5)
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
	}

	metrics.PumpWebSocketErrors.WithLabelValues("reconnect_failed").Inc()
	c.logger.Error("Failed to reconnect after max retries",
		zap.Int("max_retries", c.config.MaxRetries))
}

func (c *WSClient) GetTokenUpdates() <-chan *types.TokenUpdate {
	return c.updates
}

func (c *WSClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	select {
	case <-c.done:
		// Already closed
		return nil
	default:
		close(c.done)
	}

	if c.conn != nil {
		// Send close message
		msg := websocket.FormatCloseMessage(websocket.CloseNormalClosure, "client closing connection")
		err := c.conn.WriteControl(websocket.CloseMessage, msg, time.Now().Add(c.config.WriteTimeout))
		if err != nil {
			metrics.PumpWebSocketErrors.WithLabelValues("close_message").Inc()
			c.logger.Warn("Failed to send close message", zap.Error(err))
		}

		// Close the connection
		if err := c.conn.Close(); err != nil {
			metrics.PumpWebSocketErrors.WithLabelValues("close").Inc()
			c.logger.Error("Failed to close WebSocket connection", zap.Error(err))
			return fmt.Errorf("failed to close connection: %w", err)
		}
	}

	metrics.PumpWebSocketConnections.Set(0)
	c.logger.Info("WebSocket connection closed successfully")
	return nil
}
