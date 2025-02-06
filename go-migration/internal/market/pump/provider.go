package pump

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
	
	"github.com/shopspring/decimal"

	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

// Provider implements MarketDataProvider interface for Pump.fun
type Provider struct {
	logger       *zap.Logger
	client       *http.Client
	baseURL      string
	wsClient     *WSClient
	tokenMonitor *TokenMonitor
	mu           sync.RWMutex
	apiKey       string
}

// Config represents Pump.fun provider configuration
type Config struct {
	BaseURL      string `json:"base_url"`
	WebSocketURL string `json:"websocket_url"`
	TimeoutSec   int    `json:"timeout_sec"`
	APIKey       string `json:"api_key"`
}

// NewProvider creates a new Pump.fun provider
func NewProvider(config Config, logger *zap.Logger) *Provider {
	baseURL := "https://pumpportal.fun"
	wsURL := "wss://pumpportal.fun/ws/trades"
	
	if config.BaseURL != "" {
		baseURL = config.BaseURL
	}
	if config.WebSocketURL != "" {
		wsURL = config.WebSocketURL
	}

	return &Provider{
		logger: logger,
		client: &http.Client{
			Timeout: time.Duration(config.TimeoutSec) * time.Second,
		},
		baseURL:      baseURL,
	wsClient:     NewWSClient(wsURL, logger, types.WSConfig{
		APIKey:       config.APIKey,
		DialTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		ReadTimeout:  60 * time.Second,
		PongWait:     60 * time.Second,
		PingInterval: 15 * time.Second,
		MaxRetries:   5,
	}),
		tokenMonitor: NewTokenMonitor(baseURL, logger),
		apiKey:       config.APIKey,
	}
}

// GetPrice implements MarketDataProvider interface
func (p *Provider) GetPrice(ctx context.Context, symbol string) (float64, error) {
	url := fmt.Sprintf("%s/api/v1/price/%s", p.baseURL, symbol)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.apiKey))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Origin", "https://pump.fun")
	req.Header.Set("User-Agent", "pump-trading-bot/1.0")

	resp, err := p.client.Do(req)
	if err != nil {
		metrics.APIErrors.WithLabelValues("get_price").Inc()
		return 0, fmt.Errorf("failed to get price: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		metrics.APIErrors.WithLabelValues("get_price_status").Inc()
		return 0, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result struct {
		Data struct {
			Price  decimal.Decimal `json:"price"`
			Volume decimal.Decimal `json:"volume"`
			Time   int64          `json:"timestamp"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Data.Price.InexactFloat64(), nil
}

// SubscribePrices implements MarketDataProvider interface
func (p *Provider) SubscribePrices(ctx context.Context, symbols []string) (<-chan *types.PriceUpdate, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	priceUpdates := make(chan *types.PriceUpdate, 100)

	// Try WebSocket connection first
	wsErr := p.wsClient.Connect(ctx)
	if wsErr == nil {
		if err := p.wsClient.Subscribe(symbols); err == nil {
			updates := p.wsClient.GetTokenUpdates()
			go func() {
				defer close(priceUpdates)
				for update := range updates {
					select {
					case <-ctx.Done():
						return
					case priceUpdates <- &types.PriceUpdate{
						Symbol:      update.Symbol,
						Price:      decimal.NewFromFloat(update.Price),
						Volume:     decimal.NewFromFloat(update.Volume),
						Timestamp:  update.Timestamp,
						TokenName:  update.TokenName,
						MarketCap:  decimal.NewFromFloat(update.MarketCap),
						TotalSupply: decimal.NewFromFloat(update.TotalSupply),
					}:
					}
				}
			}()
			return priceUpdates, nil
		}
	}

	// Fallback to REST API polling if WebSocket fails
	p.logger.Warn("WebSocket connection failed, falling back to REST API polling",
		zap.Error(wsErr))

	go func() {
		defer close(priceUpdates)
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				tokens, err := p.GetNewTokens(ctx)
				if err != nil {
					p.logger.Error("Failed to get new tokens", zap.Error(err))
					continue
				}

				for _, token := range tokens {
					select {
					case priceUpdates <- &types.PriceUpdate{
						Symbol:    token.Symbol,
						Price:    token.Price,
						Volume:   token.Volume,
						Timestamp: time.Now(),
					}:
					case <-ctx.Done():
						return
					}
				}
			}
		}
	}()

	return priceUpdates, nil
}

// GetHistoricalPrices implements MarketDataProvider interface
func (p *Provider) GetHistoricalPrices(ctx context.Context, symbol string, interval string, limit int) ([]types.PriceUpdate, error) {
	url := fmt.Sprintf("%s/api/v1/historical/%s?interval=%s&limit=%d",
		p.baseURL, symbol, interval, limit)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", p.apiKey))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Origin", "https://pump.fun")
	req.Header.Set("User-Agent", "pump-trading-bot/1.0")

	resp, err := p.client.Do(req)
	if err != nil {
		metrics.APIErrors.WithLabelValues("get_historical_prices").Inc()
		return nil, fmt.Errorf("failed to get historical prices: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		metrics.APIErrors.WithLabelValues("get_historical_prices_status").Inc()
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result struct {
		Data []struct {
			Time   int64   `json:"timestamp"`
			Price  float64 `json:"price"`
			Volume float64 `json:"volume"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		metrics.APIErrors.WithLabelValues("decode_historical_prices").Inc()
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	updates := make([]types.PriceUpdate, len(result.Data))
	for i, item := range result.Data {
		updates[i] = types.PriceUpdate{
			Symbol:    symbol,
			Price:     decimal.NewFromFloat(item.Price),
			Volume:    decimal.NewFromFloat(item.Volume),
			Timestamp: time.Unix(item.Time, 0),
		}
		metrics.TokenPrice.WithLabelValues("pump.fun", symbol).Set(item.Price)
		metrics.TokenVolume.WithLabelValues("pump.fun", symbol).Set(item.Volume)
	}

	return updates, nil
}

// GetBondingCurve implements MarketDataProvider interface
func (p *Provider) GetBondingCurve(ctx context.Context, symbol string) (*types.BondingCurve, error) {
	url := fmt.Sprintf("%s/tokens/%s/bonding-curve", p.baseURL, symbol)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("X-API-Key", p.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Origin", "https://pump.fun")
	req.Header.Set("User-Agent", "pump-trading-bot/1.0")

	resp, err := p.client.Do(req)
	if err != nil {
		metrics.APIErrors.WithLabelValues("get_bonding_curve").Inc()
		return nil, fmt.Errorf("failed to get bonding curve: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		metrics.APIErrors.WithLabelValues("get_bonding_curve_status").Inc()
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result struct {
		Data types.BondingCurve `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		metrics.APIErrors.WithLabelValues("decode_bonding_curve").Inc()
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Update metrics
	metrics.TokenPrice.WithLabelValues("pump.fun", symbol).Set(result.Data.CurrentPrice.InexactFloat64())

	return &result.Data, nil
}

// GetNewTokens fetches new tokens from the API
func (p *Provider) GetNewTokens(ctx context.Context) ([]*types.TokenMarketInfo, error) {
	url := fmt.Sprintf("%s/api/v1/trades/latest", p.baseURL)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	p.logger.Debug("Making API request",
		zap.String("url", url),
		zap.String("method", "GET"),
		zap.String("api_key_status", "verified"))

	req.Header.Set("X-API-Key", p.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Origin", "https://pump.fun")
	req.Header.Set("User-Agent", "pump-trading-bot/1.0")

	p.logger.Debug("Making request to pump.fun API",
		zap.String("url", url),
		zap.String("method", "GET"),
		zap.String("api_key_length", fmt.Sprintf("%d", len(p.apiKey))))

	resp, err := p.client.Do(req)
	if err != nil {
		metrics.APIErrors.WithLabelValues("get_new_tokens").Inc()
		return nil, fmt.Errorf("failed to get new tokens: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		p.logger.Error("Failed to get tokens",
			zap.Int("status_code", resp.StatusCode),
			zap.String("response", string(body)))
		metrics.APIErrors.WithLabelValues("get_new_tokens_status").Inc()
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var response struct {
		Data []struct {
			Symbol      string  `json:"token"`
			Price       float64 `json:"price"`
			Volume      float64 `json:"volume"`
			MarketCap   float64 `json:"market_cap"`
			TotalSupply float64 `json:"total_supply"`
			TxHash      string  `json:"tx_hash"`
			BlockTime   int64   `json:"block_time"`
		} `json:"data"`
		Error *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		metrics.APIErrors.WithLabelValues("decode_new_tokens").Inc()
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if response.Error != nil {
		metrics.APIErrors.WithLabelValues("api_error").Inc()
		return nil, fmt.Errorf("API error: %s (code: %d)", response.Error.Message, response.Error.Code)
	}

	tokens := make([]*types.TokenMarketInfo, 0, len(response.Data))
	for _, t := range response.Data {
		if t.MarketCap > 30000 {
			continue
		}
		token := &types.TokenMarketInfo{
			Symbol:    t.Symbol,
			Price:     decimal.NewFromFloat(t.Price),
			Volume:    decimal.NewFromFloat(t.Volume),
			MarketCap: decimal.NewFromFloat(t.MarketCap),
		}
		tokens = append(tokens, token)
		metrics.TokenPrice.WithLabelValues("pump.fun", t.Symbol).Set(t.Price)
		metrics.TokenVolume.WithLabelValues("pump.fun", t.Symbol).Set(t.Volume)
	}

	metrics.NewTokensTotal.Inc()
	return tokens, nil
}

// SubscribeNewTokens implements MarketDataProvider interface
func (p *Provider) SubscribeNewTokens(ctx context.Context) (<-chan *types.TokenMarketInfo, error) {
	updates := make(chan *types.TokenMarketInfo, 100)

	go func() {
		defer close(updates)

		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				tokens, err := p.GetNewTokens(ctx)
				if err != nil {
					p.logger.Error("Failed to get new tokens", zap.Error(err))
					continue
				}

				for _, token := range tokens {
					select {
					case updates <- token:
					case <-ctx.Done():
						return
					}
				}
			}
		}
	}()

	return updates, nil
}
// ExecuteOrder executes a trade order
func (p *Provider) ExecuteOrder(ctx context.Context, symbol string, orderType types.SignalType, amount decimal.Decimal, price decimal.Decimal, stopLoss *decimal.Decimal, takeProfits []decimal.Decimal) error {
	url := fmt.Sprintf("%s/tokens/%s/trade", p.baseURL, symbol)

	payload := map[string]interface{}{
		"type":        string(orderType),
		"amount":      amount.String(),
		"price":       price.String(),
		"slippage":    "0.005",
		"stop_loss":   stopLoss.String(),
		"take_profit": takeProfits,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		metrics.APIErrors.WithLabelValues("marshal_trade_payload").Inc()
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		metrics.APIErrors.WithLabelValues("create_trade_request").Inc()
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-API-Key", p.apiKey)
	req.Header.Set("Origin", "https://pump.fun")
	req.Header.Set("User-Agent", "pump-trading-bot/1.0")

	p.logger.Debug("Executing trade",
		zap.String("symbol", symbol),
		zap.String("type", string(orderType)),
		zap.String("amount", amount.String()),
		zap.String("price", price.String()))

	resp, err := p.client.Do(req)
	if err != nil {
		metrics.APIErrors.WithLabelValues("execute_trade").Inc()
		return fmt.Errorf("failed to execute trade: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		metrics.APIErrors.WithLabelValues("trade_status").Inc()
		return fmt.Errorf("unexpected status code: %d, response: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Data struct {
			TxHash string `json:"tx_hash"`
			Status string `json:"status"`
		} `json:"data"`
		Error *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		metrics.APIErrors.WithLabelValues("decode_trade_response").Inc()
		return fmt.Errorf("failed to decode response: %w", err)
	}

	if result.Error != nil {
		metrics.APIErrors.WithLabelValues("trade_error").Inc()
		return fmt.Errorf("trade error: %s (code: %d)", result.Error.Message, result.Error.Code)
	}

	p.logger.Info("Trade executed successfully",
		zap.String("symbol", symbol),
		zap.String("tx_hash", result.Data.TxHash),
		zap.String("status", result.Data.Status))

	metrics.PumpTradeExecutions.WithLabelValues("success").Inc()
	return nil
}

// ExecuteTrade implements MarketDataProvider interface
func (p *Provider) ExecuteTrade(ctx context.Context, params map[string]interface{}) error {
	symbol := params["symbol"].(string)
	orderType := types.SignalType(params["type"].(string))
	amount := params["amount"].(decimal.Decimal)
	price := params["price"].(decimal.Decimal)
	stopLoss := params["stop_loss"].(*decimal.Decimal)
	takeProfits := params["take_profits"].([]decimal.Decimal)
	
	return p.ExecuteOrder(ctx, symbol, orderType, amount, price, stopLoss, takeProfits)
}

// Close closes the provider and its WebSocket client
func (p *Provider) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.wsClient != nil {
		return p.wsClient.Close()
	}
	return nil
}
