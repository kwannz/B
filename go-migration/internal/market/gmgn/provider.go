package gmgn

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type Provider struct {
	logger        *zap.Logger
	baseURL       string
	apiKey        string
	walletAddress string
	client        *http.Client
	mu            sync.RWMutex
}

type Config struct {
	BaseURL       string        `yaml:"base_url"`
	APIKey        string        `yaml:"api_key"`
	WalletAddress string        `yaml:"wallet_address"`
	UseAntiMEV    bool          `yaml:"use_anti_mev"`
	MinFee        decimal.Decimal `yaml:"min_fee"`
	Slippage      decimal.Decimal `yaml:"slippage"`
	Timeout       time.Duration  `yaml:"timeout"`
}

func NewProvider(config *Config, logger *zap.Logger) *Provider {
	return &Provider{
		logger:        logger,
		baseURL:       config.BaseURL,
		apiKey:        config.APIKey,
		walletAddress: config.WalletAddress,
		client: &http.Client{
			Timeout: config.Timeout,
		},
	}
}

func (p *Provider) GetQuote(ctx context.Context, tokenIn, tokenOut string, amount decimal.Decimal) (*types.Quote, error) {
	url := fmt.Sprintf("%s/tx/get_swap_route", p.baseURL)
	params := map[string]string{
		"token_in_address":  tokenIn,
		"token_out_address": tokenOut,
		"in_amount":        amount.String(),
		"from_address":     p.walletAddress,
		"slippage":        "0.5",
		"is_anti_mev":     "true",
		"fee":             "0.002",
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	q := req.URL.Query()
	for k, v := range params {
		q.Add(k, v)
	}
	req.URL.RawQuery = q.Encode()

	start := time.Now()
	resp, err := p.client.Do(req)
	metrics.GMGNQuoteLatency.WithLabelValues("request").Observe(time.Since(start).Seconds())
	if err != nil {
		metrics.APIErrors.WithLabelValues("gmgn_quote_request").Inc()
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		metrics.APIErrors.WithLabelValues("gmgn_quote_status").Inc()
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Data struct {
			RawTx struct {
				SwapTransaction     string `json:"swapTransaction"`
				LastValidBlockHeight int    `json:"lastValidBlockHeight"`
				RecentBlockhash     string `json:"recentBlockhash"`
			} `json:"raw_tx"`
			Quote struct {
				InputMint  string `json:"inputMint"`
				OutputMint string `json:"outputMint"`
				InAmount   string `json:"inAmount"`
				OutAmount  string `json:"outAmount"`
			} `json:"quote"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		metrics.APIErrors.WithLabelValues("gmgn_quote_decode").Inc()
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if result.Code != 0 {
		metrics.APIErrors.WithLabelValues("gmgn_quote_error").Inc()
		return nil, fmt.Errorf("API error: %s", result.Msg)
	}

	return &types.Quote{
		TokenIn:  tokenIn,
		TokenOut: tokenOut,
		Amount:   amount,
		RawTx:    result.Data.RawTx.SwapTransaction,
		BlockHeight: result.Data.RawTx.LastValidBlockHeight,
		Blockhash:   result.Data.RawTx.RecentBlockhash,
	}, nil
}

func (p *Provider) SubmitTransaction(ctx context.Context, signedTx string) (*types.TransactionResult, error) {
	url := fmt.Sprintf("%s/tx/submit_signed_transaction", p.baseURL)
	
	payload := map[string]string{
		"signed_tx": signedTx,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	start := time.Now()
	resp, err := p.client.Do(req)
	metrics.GMGNTradeExecutions.WithLabelValues("submit").Inc()
	metrics.GMGNQuoteLatency.WithLabelValues("submit").Observe(time.Since(start).Seconds())
	if err != nil {
		metrics.APIErrors.WithLabelValues("gmgn_submit_request").Inc()
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		metrics.APIErrors.WithLabelValues("gmgn_submit_status").Inc()
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Data struct {
			TxHash              string `json:"tx_hash"`
			OrderID             string `json:"order_id"`
			BundleID            string `json:"bundle_id"`
			LastValidBlockNumber int    `json:"last_valid_block_number"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		metrics.APIErrors.WithLabelValues("gmgn_submit_decode").Inc()
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if result.Code != 0 {
		metrics.APIErrors.WithLabelValues("gmgn_submit_error").Inc()
		return nil, fmt.Errorf("API error: %s", result.Msg)
	}

	return &types.TransactionResult{
		Hash:           result.Data.TxHash,
		OrderID:        result.Data.OrderID,
		BundleID:       result.Data.BundleID,
		LastValidBlock: result.Data.LastValidBlockNumber,
	}, nil
}

func (p *Provider) GetTransactionStatus(ctx context.Context, hash string, lastValidHeight int) (*types.TransactionStatus, error) {
	url := fmt.Sprintf("%s/tx/get_transaction_status", p.baseURL)
	
	params := map[string]string{
		"hash":              hash,
		"last_valid_height": fmt.Sprintf("%d", lastValidHeight),
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	q := req.URL.Query()
	for k, v := range params {
		q.Add(k, v)
	}
	req.URL.RawQuery = q.Encode()

	start := time.Now()
	resp, err := p.client.Do(req)
	metrics.GMGNQuoteLatency.WithLabelValues("status").Observe(time.Since(start).Seconds())
	if err != nil {
		metrics.APIErrors.WithLabelValues("gmgn_status_request").Inc()
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		metrics.APIErrors.WithLabelValues("gmgn_status_status").Inc()
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	var result struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Data struct {
			Success bool `json:"success"`
			Expired bool `json:"expired"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		metrics.APIErrors.WithLabelValues("gmgn_status_decode").Inc()
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if result.Code != 0 {
		metrics.APIErrors.WithLabelValues("gmgn_status_error").Inc()
		return nil, fmt.Errorf("API error: %s", result.Msg)
	}

	return &types.TransactionStatus{
		Success: result.Data.Success,
		Expired: result.Data.Expired,
	}, nil
}
