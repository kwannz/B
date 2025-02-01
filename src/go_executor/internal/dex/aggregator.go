package dex

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Exchange represents a DEX exchange
type Exchange interface {
	GetName() string
	GetLiquidity(ctx context.Context, pair string) (float64, error)
	GetPrice(ctx context.Context, pair string) (float64, error)
	GetOrderBook(ctx context.Context, pair string) (*OrderBook, error)
}

// OrderBook represents an order book
type OrderBook struct {
	Bids []Order
	Asks []Order
}

// Order represents an order in the order book
type Order struct {
	Price  float64
	Amount float64
}

// Config holds configuration for DEX aggregator
type Config struct {
	CacheTTL           time.Duration
	ParallelQueries    int
	RetryAttempts      int
	RetryDelay         time.Duration
	MinLiquidity       float64
	PriceSlippageLimit float64
	RedisURL           string
}

// DefaultConfig returns default configuration
func DefaultConfig() *Config {
	return &Config{
		CacheTTL:           time.Second * 5,
		ParallelQueries:    5,
		RetryAttempts:      3,
		RetryDelay:         time.Millisecond * 100,
		MinLiquidity:       1000.0,
		PriceSlippageLimit: 0.01,
		RedisURL:           "redis://localhost:6379/0",
	}
}

// Aggregator aggregates data from multiple DEXes
type Aggregator struct {
	mu        sync.RWMutex
	config    *Config
	exchanges []Exchange
	cache     *redis.Client
}

// NewAggregator creates a new DEX aggregator
func NewAggregator(config *Config) (*Aggregator, error) {
	if config == nil {
		config = DefaultConfig()
	}

	// Connect to Redis
	opt, err := redis.ParseURL(config.RedisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %v", err)
	}

	cache := redis.NewClient(opt)
	if err := cache.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %v", err)
	}

	return &Aggregator{
		config:    config,
		exchanges: make([]Exchange, 0),
		cache:     cache,
	}, nil
}

// RegisterExchange registers a new exchange
func (a *Aggregator) RegisterExchange(exchange Exchange) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.exchanges = append(a.exchanges, exchange)
}

// GetBestPrice returns the best price across all exchanges
func (a *Aggregator) GetBestPrice(ctx context.Context, pair string, isBuy bool) (float64, string, error) {
	// Try to get from cache
	cacheKey := fmt.Sprintf("price:%s:%v", pair, isBuy)
	if price, err := a.cache.Get(ctx, cacheKey).Float64(); err == nil {
		return price, "cache", nil
	}

	// Query all exchanges in parallel
	type result struct {
		exchange Exchange
		price    float64
		err      error
	}

	results := make(chan result, len(a.exchanges))
	for _, ex := range a.exchanges {
		go func(e Exchange) {
			price, err := e.GetPrice(ctx, pair)
			results <- result{e, price, err}
		}(ex)
	}

	// Collect results
	var bestPrice float64
	var bestExchange string
	validResults := 0

	for i := 0; i < len(a.exchanges); i++ {
		select {
		case <-ctx.Done():
			return 0, "", ctx.Err()
		case r := <-results:
			if r.err != nil {
				continue
			}
			validResults++

			if bestExchange == "" || (isBuy && r.price < bestPrice) || (!isBuy && r.price > bestPrice) {
				bestPrice = r.price
				bestExchange = r.exchange.GetName()
			}
		}
	}

	if validResults == 0 {
		return 0, "", fmt.Errorf("no valid prices found")
	}

	// Cache the result
	a.cache.Set(ctx, cacheKey, bestPrice, a.config.CacheTTL)

	return bestPrice, bestExchange, nil
}

// GetAggregatedOrderBook returns the aggregated order book
func (a *Aggregator) GetAggregatedOrderBook(ctx context.Context, pair string) (*OrderBook, error) {
	// Try to get from cache
	cacheKey := fmt.Sprintf("orderbook:%s", pair)
	if cached, err := a.cache.Get(ctx, cacheKey).Bytes(); err == nil {
		var ob OrderBook
		if err := json.Unmarshal(cached, &ob); err == nil {
			return &ob, nil
		}
	}

	// Query all exchanges in parallel
	type result struct {
		orderBook *OrderBook
		err       error
	}

	results := make(chan result, len(a.exchanges))
	for _, ex := range a.exchanges {
		go func(e Exchange) {
			ob, err := e.GetOrderBook(ctx, pair)
			results <- result{ob, err}
		}(ex)
	}

	// Collect and merge order books
	var bids, asks []Order
	validResults := 0

	for i := 0; i < len(a.exchanges); i++ {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case r := <-results:
			if r.err != nil {
				continue
			}
			validResults++
			bids = append(bids, r.orderBook.Bids...)
			asks = append(asks, r.orderBook.Asks...)
		}
	}

	if validResults == 0 {
		return nil, fmt.Errorf("no valid order books found")
	}

	// Sort bids and asks
	sort.Slice(bids, func(i, j int) bool {
		return bids[i].Price > bids[j].Price
	})
	sort.Slice(asks, func(i, j int) bool {
		return asks[i].Price < asks[j].Price
	})

	// Create aggregated order book
	ob := &OrderBook{
		Bids: mergeSamePriceLevels(bids),
		Asks: mergeSamePriceLevels(asks),
	}

	// Cache the result
	if data, err := json.Marshal(ob); err == nil {
		a.cache.Set(ctx, cacheKey, data, a.config.CacheTTL)
	}

	return ob, nil
}

// GetLiquidityScore returns the liquidity score for a pair
func (a *Aggregator) GetLiquidityScore(ctx context.Context, pair string) (float64, error) {
	// Try to get from cache
	cacheKey := fmt.Sprintf("liquidity:%s", pair)
	if score, err := a.cache.Get(ctx, cacheKey).Float64(); err == nil {
		return score, nil
	}

	// Query all exchanges in parallel
	type result struct {
		liquidity float64
		err       error
	}

	results := make(chan result, len(a.exchanges))
	for _, ex := range a.exchanges {
		go func(e Exchange) {
			liq, err := e.GetLiquidity(ctx, pair)
			results <- result{liq, err}
		}(ex)
	}

	// Calculate total liquidity
	var totalLiquidity float64
	validResults := 0

	for i := 0; i < len(a.exchanges); i++ {
		select {
		case <-ctx.Done():
			return 0, ctx.Err()
		case r := <-results:
			if r.err != nil {
				continue
			}
			validResults++
			totalLiquidity += r.liquidity
		}
	}

	if validResults == 0 {
		return 0, fmt.Errorf("no valid liquidity data found")
	}

	// Cache the result
	a.cache.Set(ctx, cacheKey, totalLiquidity, a.config.CacheTTL)

	return totalLiquidity, nil
}

// mergeSamePriceLevels merges orders with the same price
func mergeSamePriceLevels(orders []Order) []Order {
	if len(orders) == 0 {
		return orders
	}

	merged := make([]Order, 0)
	current := orders[0]

	for i := 1; i < len(orders); i++ {
		if orders[i].Price == current.Price {
			current.Amount += orders[i].Amount
		} else {
			merged = append(merged, current)
			current = orders[i]
		}
	}
	merged = append(merged, current)

	return merged
}

// Close closes the aggregator and its connections
func (a *Aggregator) Close() error {
	return a.cache.Close()
}
