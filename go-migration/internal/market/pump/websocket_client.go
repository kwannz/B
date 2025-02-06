package pump

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type WSClient struct {
	url         string
	apiKey      string
	conn        *websocket.Conn
	logger      *zap.Logger
	mu          sync.RWMutex
	done        chan struct{}
	updates     chan *types.TokenUpdate
	trades      chan *types.Trade
	config      types.WSConfig
	initMessage map[string]interface{}
	// metrics field removed as we're using global metrics
}

func NewWSClient(url string, logger *zap.Logger, config types.WSConfig) *WSClient {
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
		url:         url,
		apiKey:      config.APIKey,
		logger:      logger,
		done:        make(chan struct{}),
		updates:     make(chan *types.TokenUpdate, 100),
		trades:      make(chan *types.Trade, 100),
		config:      config,
		initMessage: make(map[string]interface{}),
		// metrics initialization removed
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
		TLSClientConfig: nil,
		Subprotocols:     []string{"pump.fun-api"},
	}

	headers := http.Header{}
	headers.Set("X-API-Key", c.config.APIKey)
	headers.Set("User-Agent", "pump-trading-bot/1.0")
	headers.Set("Content-Type", "application/json")
	headers.Set("Accept", "application/json")
	headers.Set("Origin", "https://pump.fun")
	
	wsURL := strings.Replace(c.url, "https://", "wss://", 1) + "/ws"
	conn, resp, err := dialer.DialContext(ctx, wsURL, headers)
	if err != nil {
		metrics.APIErrors.WithLabelValues("websocket_connect").Inc()
		metrics.WebsocketConnections.Set(0)
		// Fallback to REST API polling if WebSocket connection fails
		c.logger.Warn("WebSocket connection failed, will use REST API polling",
			zap.Error(err),
			zap.String("url", wsURL))
		if resp != nil {
			c.logger.Error("WebSocket connection failed",
				zap.Int("status_code", resp.StatusCode),
				zap.Error(err))
			return fmt.Errorf("failed to connect to WebSocket (status %d): %w", resp.StatusCode, err)
		}
		return fmt.Errorf("failed to connect to WebSocket: %w", err)
	}
	metrics.WebsocketConnections.Set(1)
	c.conn = conn

	// Initialize WebSocket connection with authentication
	authMessage := map[string]interface{}{
		"type": "auth",
		"data": map[string]interface{}{
			"key": c.config.APIKey,
			"version": "1.0",
			"client": "pump-trading-bot",
		},
	}
	
	if err := c.conn.WriteJSON(authMessage); err != nil {
		metrics.APIErrors.WithLabelValues("websocket_auth").Inc()
		return fmt.Errorf("failed to send auth message: %w", err)
	}
	
	// Subscribe to token updates
	c.initMessage = map[string]interface{}{
		"type": "subscribe",
		"channel": "trades",
		"data": map[string]interface{}{
			"market_cap_max": 30000,
			"include_metadata": true,
			"interval": "1m",
		},
	}
	
	if err := c.conn.WriteJSON(c.initMessage); err != nil {
		metrics.APIErrors.WithLabelValues("websocket_subscribe").Inc()
		return fmt.Errorf("failed to send subscription message: %w", err)
	}
	
	// Subscribe to real-time trades and executions
	tradeSubMessage := map[string]interface{}{
		"type": "subscribe",
		"channel": "trades",
		"data": map[string]interface{}{
			"interval": "1m",
			"include_changes": true,
			"market_cap_max": 30000,
			"include_metadata": true,
			"include_executions": true,
		},
	}
	
	if err := c.conn.WriteJSON(tradeSubMessage); err != nil {
		metrics.APIErrors.WithLabelValues("websocket_trade_subscribe").Inc()
		return fmt.Errorf("failed to send trade subscription message: %w", err)
	}

	// Subscribe to executions channel
	execSubMessage := map[string]interface{}{
		"type": "subscribe",
		"channel": "executions",
		"data": map[string]interface{}{
			"include_metadata": true,
		},
	}
	
	if err := c.conn.WriteJSON(execSubMessage); err != nil {
		metrics.APIErrors.WithLabelValues("websocket_execution_subscribe").Inc()
		return fmt.Errorf("failed to send execution subscription message: %w", err)
	}
	
	// Start ping/pong routine
	go c.setupPingPong()
	
	// Start message pump
	go c.readPump()
	
	c.logger.Info("Successfully connected to WebSocket",
		zap.String("url", c.url))
	
	return nil
}

func (c *WSClient) setupPingPong() {
	ticker := time.NewTicker(c.config.PingInterval)
	lastPong := time.Now()

	c.conn.SetPongHandler(func(string) error {
		lastPong = time.Now()
		c.conn.SetReadDeadline(time.Now().Add(c.config.PongWait))
		metrics.APIErrors.WithLabelValues("websocket_pong_received").Inc()
		metrics.WebsocketConnections.Set(1)
		c.logger.Debug("Pong received successfully",
			zap.Time("last_pong", lastPong))
		return nil
	})

	defer ticker.Stop()
	for {
		select {
		case <-c.done:
			metrics.WebsocketConnections.Set(0)
			return
		case <-ticker.C:
			if time.Since(lastPong) > c.config.PongWait {
				metrics.APIErrors.WithLabelValues("websocket_pong_timeout").Inc()
				metrics.WebsocketConnections.Set(0)
				c.logger.Error("Pong timeout exceeded",
					zap.Duration("timeout", c.config.PongWait),
					zap.Duration("since_last_pong", time.Since(lastPong)))
				c.reconnect()
				return
			}

			if err := c.conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(c.config.WriteTimeout)); err != nil {
				metrics.APIErrors.WithLabelValues("websocket_ping").Inc()
				metrics.WebsocketConnections.Set(0)
				c.logger.Error("Failed to write ping message", zap.Error(err))
				c.reconnect()
				return
			}
			
			metrics.APIErrors.WithLabelValues("websocket_ping_sent").Inc()
			c.logger.Debug("Ping sent successfully")
		}
	}
	
	defer ticker.Stop()
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
				metrics.APIErrors.WithLabelValues("websocket_unexpected_close").Inc()
				metrics.WebsocketConnections.Set(0)
					c.logger.Error("Unexpected WebSocket closure", zap.Error(err))
				} else {
					metrics.APIErrors.WithLabelValues("websocket_read").Inc()
					c.logger.Error("WebSocket read error", zap.Error(err))
				}
				c.reconnect()
				continue
			}

			var response struct {
				Type    string `json:"type"`
				Channel string `json:"channel"`
				Data    struct {
					Symbol      string  `json:"symbol"`
					Name        string  `json:"name"`
					Price       float64 `json:"price"`
					Volume      float64 `json:"volume"`
					MarketCap   float64 `json:"market_cap"`
					TotalSupply float64 `json:"total_supply"`
					TxHash      string  `json:"tx_hash"`
					BlockTime   int64   `json:"block_time"`
					Changes     struct {
						Hour float64 `json:"hour"`
						Day  float64 `json:"day"`
					} `json:"changes"`
					Status string `json:"status"`
				} `json:"data"`
				Error *struct {
					Code    int    `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}

			if err := json.Unmarshal(message, &response); err != nil {
				metrics.APIErrors.WithLabelValues("websocket_unmarshal").Inc()
				c.logger.Error("Failed to unmarshal message", zap.Error(err))
				continue
			}

			if response.Error != nil {
				metrics.APIErrors.WithLabelValues("websocket_api_error").Inc()
				c.logger.Error("WebSocket error received",
					zap.Int("code", response.Error.Code),
					zap.String("message", response.Error.Message))
				continue
			}

			// Handle different event types
			switch response.Type {
			case "trade", "price", "token", "execution":
				if response.Channel != "trades" && response.Channel != "tokens" && response.Channel != "executions" {
					continue
				}

				if response.Type == "execution" {
					if response.Error != nil {
						c.logger.Error("Trade execution failed",
							zap.Int("code", response.Error.Code),
							zap.String("message", response.Error.Message))
						metrics.APIErrors.WithLabelValues("trade_execution_failed").Inc()
						continue
					}
					c.logger.Info("Trade execution successful",
						zap.String("symbol", response.Data.Symbol),
						zap.Float64("price", response.Data.Price),
						zap.String("tx_hash", response.Data.TxHash))
					metrics.APIErrors.WithLabelValues("trade_execution_success").Inc()
					continue
				}

				tokenUpdate := &types.TokenUpdate{
					Symbol:      response.Data.Symbol,
					TokenName:   response.Data.Name,
					Price:       response.Data.Price,
					Volume:      response.Data.Volume,
					MarketCap:   response.Data.MarketCap,
					TotalSupply: response.Data.TotalSupply,
					TxHash:      response.Data.TxHash,
					BlockTime:   response.Data.BlockTime,
					PriceChange: types.PriceChange{
						Hour: response.Data.Changes.Hour,
						Day:  response.Data.Changes.Day,
					},
					Status:    response.Data.Status,
					Timestamp: time.Now().UTC(),
				}

				// Update metrics
				metrics.TokenPrice.WithLabelValues("pump.fun", tokenUpdate.Symbol).Set(tokenUpdate.Price)
				metrics.TokenVolume.WithLabelValues("pump.fun", tokenUpdate.Symbol).Set(tokenUpdate.Volume)
				metrics.TokenMarketCap.WithLabelValues("pump.fun", tokenUpdate.Symbol).Set(tokenUpdate.MarketCap)
				
				c.logger.Debug("Received token update",
					zap.String("symbol", tokenUpdate.Symbol),
					zap.String("name", tokenUpdate.TokenName),
					zap.Float64("price", tokenUpdate.Price),
					zap.Float64("volume", tokenUpdate.Volume),
					zap.Float64("market_cap", tokenUpdate.MarketCap),
					zap.String("status", tokenUpdate.Status),
					zap.Float64("price_change_1h", tokenUpdate.PriceChange.Hour),
					zap.Float64("price_change_24h", tokenUpdate.PriceChange.Day))

				// Validate token update
				if tokenUpdate.Symbol == "" || tokenUpdate.Price <= 0 {
					c.logger.Warn("Invalid token update received",
						zap.Any("update", tokenUpdate))
					continue
				}

				// Update metrics for new tokens
				if response.Type == "new_token" {
					metrics.NewTokensTotal.Inc()
					c.logger.Info("New token detected",
						zap.String("symbol", tokenUpdate.Symbol),
						zap.Float64("price", tokenUpdate.Price),
						zap.Float64("market_cap", tokenUpdate.MarketCap),
						zap.Float64("volume", tokenUpdate.Volume))
				}

				// Send update to trading executor
				select {
				case c.updates <- tokenUpdate:
					metrics.APIErrors.WithLabelValues("websocket_message_success").Inc()
				default:
					metrics.APIErrors.WithLabelValues("websocket_message_dropped").Inc()
					c.logger.Warn("Update channel full, dropping message",
						zap.String("symbol", tokenUpdate.Symbol))
				}
			
			case "error":
				if response.Error != nil {
					metrics.APIErrors.WithLabelValues("websocket_error").Inc()
					c.logger.Error("WebSocket error received",
						zap.Int("code", response.Error.Code),
						zap.String("message", response.Error.Message))
				}
			default:
				c.logger.Debug("Unhandled message type",
					zap.String("type", response.Type))
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

	for _, method := range methods {
		var payload map[string]interface{}
		
		switch method {
		case "subscribeNewToken":
			payload = map[string]interface{}{
				"type": "subscribe",
				"channel": "tokens",
				"data": map[string]interface{}{
					"market_cap_max": 30000,
					"include_metadata": true,
					"include_changes": true,
				},
			}
		case "subscribePrices":
			payload = map[string]interface{}{
				"type": "subscribe",
				"channel": "trades",
				"data": map[string]interface{}{
					"interval": "1m",
					"include_changes": true,
					"include_metadata": true,
					"market_cap_max": 30000,
				},
			}
		default:
			c.logger.Warn("Unknown subscription method", zap.String("method", method))
			continue
		}

		if err := c.conn.WriteJSON(payload); err != nil {
			metrics.APIErrors.WithLabelValues("websocket_subscribe").Inc()
			return fmt.Errorf("failed to subscribe with method %s: %w", method, err)
		}

		c.logger.Info("Subscribed to pump.fun WebSocket",
			zap.String("method", method),
			zap.String("api_key_status", "verified"))
	}

	return nil
}

func (c *WSClient) reconnect() {
	c.mu.Lock()
	defer c.mu.Unlock()

	metrics.WebsocketConnections.Set(0)
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
				metrics.APIErrors.WithLabelValues("websocket_resubscribe").Inc()
				c.logger.Error("Failed to resubscribe after reconnect", zap.Error(err))
				metrics.WebsocketConnections.Set(0)
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

	metrics.APIErrors.WithLabelValues("websocket_reconnect_failed").Inc()
	c.logger.Error("Failed to reconnect after max retries",
		zap.Int("max_retries", c.config.MaxRetries))
}

func (c *WSClient) GetTokenUpdates() <-chan *types.TokenUpdate {
	return c.updates
}

func (c *WSClient) ExecuteTrade(ctx context.Context, trade *types.Trade) error {
	if trade == nil {
		return fmt.Errorf("trade cannot be nil")
	}

	payload := map[string]interface{}{
		"type": "execute_trade",
		"channel": "executions",
		"data": map[string]interface{}{
			"symbol": trade.Symbol,
			"side":   string(trade.Side),
			"size":   trade.Size.String(),
			"price":  trade.Price.String(),
		},
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn == nil {
		return fmt.Errorf("websocket connection is not established")
	}

	if err := c.conn.WriteJSON(payload); err != nil {
		metrics.APIErrors.WithLabelValues("trade_execution_failed").Inc()
		return fmt.Errorf("failed to send trade execution message: %w", err)
	}

	metrics.APIKeyUsage.WithLabelValues("pump.fun", "trade_execution").Inc()
	return nil
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
		close(c.updates)
		if c.trades != nil {
			close(c.trades)
		}
	}

	if c.conn != nil {
		// Send close message
		msg := websocket.FormatCloseMessage(websocket.CloseNormalClosure, "client closing connection")
		err := c.conn.WriteControl(websocket.CloseMessage, msg, time.Now().Add(c.config.WriteTimeout))
		if err != nil {
			metrics.APIErrors.WithLabelValues("websocket_close_message").Inc()
			c.logger.Warn("Failed to send close message", zap.Error(err))
		}

		// Close the connection
		if err := c.conn.Close(); err != nil {
			metrics.APIErrors.WithLabelValues("websocket_close").Inc()
			c.logger.Error("Failed to close WebSocket connection", zap.Error(err))
			return fmt.Errorf("failed to close connection: %w", err)
		}
	}

	metrics.WebsocketConnections.Set(0)
	metrics.APIKeyUsage.WithLabelValues("pump.fun", "websocket_closed").Inc()
	c.logger.Info("WebSocket connection closed successfully")
	return nil
}

func (c *WSClient) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.conn != nil
}

func (c *WSClient) GetTrades() <-chan *types.Trade {
	return c.trades
}
