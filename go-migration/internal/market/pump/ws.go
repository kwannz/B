package pump

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/types"
)

// WSConfig holds WebSocket client configuration
type WSConfig struct {
	DialTimeout  time.Duration
	WriteTimeout time.Duration
	ReadTimeout  time.Duration
	PongWait     time.Duration
	MaxRetries   int
}

// WSClient handles WebSocket connections for real-time price updates
type WSClient struct {
	logger       *zap.Logger
	conn         *websocket.Conn
	updates      chan *types.PriceUpdate
	done         chan struct{}
	mu           sync.RWMutex
	symbols      map[string]bool
	wsURL        string
	dialTimeout  time.Duration
	writeTimeout time.Duration
	readTimeout  time.Duration
	pongWait     time.Duration
	pingPeriod   time.Duration
	maxRetries   int
}

// NewWSClient creates a new WebSocket client
func NewWSClient(wsURL string, logger *zap.Logger, config WSConfig) *WSClient {
	return &WSClient{
		logger:       logger,
		updates:      make(chan *types.PriceUpdate, 1000),
		done:         make(chan struct{}),
		symbols:      make(map[string]bool),
		wsURL:        wsURL,
		dialTimeout:  config.DialTimeout,
		writeTimeout: config.WriteTimeout,
		readTimeout:  config.ReadTimeout,
		pongWait:     config.PongWait,
		pingPeriod:   (config.PongWait * 9) / 10,
		maxRetries:   config.MaxRetries,
	}
}

// Connect establishes WebSocket connection
func (c *WSClient) Connect(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.conn != nil {
		return nil
	}

	headers := http.Header{}
	headers.Add("Origin", "https://pump.fun")
	headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

	dialer := websocket.Dialer{
		HandshakeTimeout: c.dialTimeout,
		WriteBufferSize:  1024 * 16,
		ReadBufferSize:   1024 * 16,
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
		EnableCompression: true,
		Proxy:            http.ProxyFromEnvironment,
	}

	backoff := time.Second
	maxBackoff := 30 * time.Second

	var lastErr error
	for retry := 0; retry < c.maxRetries; retry++ {
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

		conn, resp, err := dialer.DialContext(ctx, c.wsURL, headers)
		if err != nil {
			if resp != nil {
				c.logger.Error("WebSocket connection failed",
					zap.Int("status", resp.StatusCode),
					zap.String("status_text", resp.Status))
			}
			lastErr = fmt.Errorf("failed to connect: %w", err)
			c.logger.Error("websocket connection failed",
				zap.Error(err),
				zap.Int("retry", retry),
				zap.Duration("backoff", backoff))
			continue
		}

		conn.SetReadDeadline(time.Now().Add(c.readTimeout))
		conn.SetWriteDeadline(time.Now().Add(c.writeTimeout))
		conn.SetPongHandler(func(string) error {
			return conn.SetReadDeadline(time.Now().Add(c.pongWait))
		})

		c.conn = conn

		go c.handleMessages()
		go c.keepAlive(ctx)

		return nil
	}

	return fmt.Errorf("max retries exceeded: %w", lastErr)
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

func (c *WSClient) keepAlive(ctx context.Context) {
	ticker := time.NewTicker(c.pingPeriod)
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

			if err := c.conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(c.writeTimeout)); err != nil {
				c.logger.Error("failed to write ping message", zap.Error(err))
				c.conn.Close()
				c.conn = nil
				c.mu.Unlock()
				return
			}
			c.mu.Unlock()
		}
	}
}

func (c *WSClient) handleMessages() {
	defer close(c.updates)

	for {
		select {
		case <-c.done:
			return
		default:
			c.conn.SetReadDeadline(time.Now().Add(c.readTimeout))
			_, msg, err := c.conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					c.logger.Error("WebSocket read error", zap.Error(err))
				}
				c.mu.Lock()
				if c.conn != nil {
					c.conn.Close()
					c.conn = nil
				}
				c.mu.Unlock()
				return
			}

			var data struct {
				Method string `json:"method"`
				Data   struct {
					Symbol    string  `json:"symbol"`
					Price     float64 `json:"price"`
					Volume    float64 `json:"volume"`
					Timestamp int64   `json:"timestamp"`
				} `json:"data"`
			}

			if err := json.Unmarshal(msg, &data); err != nil {
				c.logger.Error("Failed to parse WebSocket message", zap.Error(err))
				continue
			}

			if data.Method == "tokenTrade" {
				update := &types.PriceUpdate{
					Symbol:    data.Data.Symbol,
					Price:     data.Data.Price,
					Volume:    data.Data.Volume,
					Timestamp: time.Unix(data.Data.Timestamp/1000, 0),
				}

				select {
				case c.updates <- update:
				default:
					c.logger.Warn("Update channel full", 
						zap.String("symbol", data.Data.Symbol))
				}
			}
		}
	}
}
