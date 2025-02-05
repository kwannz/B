package pump

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/devinjacknz/tradingbot/internal/types"
)

// WSClient handles WebSocket connections for real-time price updates
type WSClient struct {
	logger  *zap.Logger
	conn    *websocket.Conn
	updates chan *types.PriceUpdate
	done    chan struct{}
	mu      sync.RWMutex
	symbols map[string]bool
	wsURL   string
}

// NewWSClient creates a new WebSocket client
func NewWSClient(wsURL string, logger *zap.Logger) *WSClient {
	return &WSClient{
		logger:  logger,
		updates: make(chan *types.PriceUpdate, 1000),
		done:    make(chan struct{}),
		symbols: make(map[string]bool),
		wsURL:   wsURL,
	}
}

// Connect establishes WebSocket connection
func (c *WSClient) Connect(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil {
		return nil
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
		WriteBufferSize:  1024 * 16,
		ReadBufferSize:   1024 * 16,
	}

	backoff := time.Second
	maxBackoff := 30 * time.Second
	maxRetries := 3

	var lastErr error
	for retry := 0; retry < maxRetries; retry++ {
		if retry > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
				backoff = time.Duration(float64(backoff) * 1.5)
				if backoff > maxBackoff {
					backoff = maxBackoff
				}
			}
		}

		conn, _, err := dialer.DialContext(ctx, c.wsURL, nil)
		if err != nil {
			metrics.PumpAPIErrors.WithLabelValues("websocket_connect").Inc()
			lastErr = fmt.Errorf("failed to connect: %w", err)
			c.logger.Error("websocket connection failed",
				zap.Error(err),
				zap.Int("retry", retry),
				zap.Duration("backoff", backoff))
			continue
		}

		c.conn = conn
		metrics.PumpWebsocketConnections.Inc()

		// Start message handler and keepalive
		go c.handleMessages()
		go c.keepAlive(ctx)

		return nil
	}

	return fmt.Errorf("max retries exceeded: %w", lastErr)
}

func (c *WSClient) keepAlive(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.mu.Lock()
			if c.conn == nil {
				c.mu.Unlock()
				return
			}

			if err := c.conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(10*time.Second)); err != nil {
				c.logger.Error("failed to write ping message", zap.Error(err))
				metrics.PumpAPIErrors.WithLabelValues("websocket_ping").Inc()
				c.conn.Close()
				c.conn = nil
				metrics.PumpWebsocketConnections.Dec()
				c.mu.Unlock()
				return
			}
			c.mu.Unlock()
		}
	}
}

// Subscribe subscribes to price updates for symbols
func (c *WSClient) Subscribe(symbols []string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn == nil {
		return fmt.Errorf("not connected")
	}

	for _, symbol := range symbols {
		if c.symbols[symbol] {
			continue
		}

		msg := struct {
			Type   string `json:"type"`
			Symbol string `json:"symbol"`
		}{
			Type:   "subscribe",
			Symbol: symbol,
		}

		if err := c.conn.WriteJSON(msg); err != nil {
			return fmt.Errorf("failed to subscribe to %s: %w", symbol, err)
		}

		c.symbols[symbol] = true
	}

	return nil
}

// GetUpdates returns the price updates channel
func (c *WSClient) GetUpdates() <-chan *types.PriceUpdate {
	return c.updates
}

// Close closes the WebSocket connection
func (c *WSClient) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil {
		close(c.done)
		if err := c.conn.Close(); err != nil {
			return fmt.Errorf("failed to close WebSocket: %w", err)
		}
		c.conn = nil
	}

	return nil
}

func (c *WSClient) handleMessages() {
	defer close(c.updates)

	for {
		select {
		case <-c.done:
			return
		default:
			_, msg, err := c.conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					c.logger.Error("WebSocket read error", zap.Error(err))
					metrics.PumpAPIErrors.WithLabelValues("websocket_read").Inc()
				}
				c.mu.Lock()
				if c.conn != nil {
					c.conn.Close()
					c.conn = nil
					metrics.PumpWebsocketConnections.Dec()
				}
				c.mu.Unlock()
				return
			}

			var data struct {
				Type      string  `json:"type"`
				Symbol    string  `json:"symbol"`
				Price     float64 `json:"price"`
				Volume    float64 `json:"volume"`
				Timestamp int64   `json:"timestamp"`
			}

			if err := json.Unmarshal(msg, &data); err != nil {
				c.logger.Error("Failed to parse WebSocket message", zap.Error(err))
				metrics.PumpAPIErrors.WithLabelValues("websocket_parse").Inc()
				continue
			}

			update := &types.PriceUpdate{
				Symbol:    data.Symbol,
				Price:     data.Price,
				Volume:    data.Volume,
				Timestamp: time.Unix(data.Timestamp/1000, 0),
			}

			// Update metrics
			metrics.PumpTokenPrice.WithLabelValues(data.Symbol).Set(data.Price)
			metrics.PumpTokenVolume.WithLabelValues(data.Symbol).Set(data.Volume)

			select {
			case c.updates <- update:
			default:
				c.logger.Warn("Update channel full")
			}
		}
	}
}
