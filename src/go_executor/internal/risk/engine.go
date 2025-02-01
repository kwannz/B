package risk

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Rule represents a risk control rule
type Rule struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Conditions  map[string]interface{} `json:"conditions"`
	Actions     []string               `json:"actions"`
	Priority    int                    `json:"priority"`
	IsEnabled   bool                   `json:"is_enabled"`
	LastUpdated time.Time              `json:"last_updated"`
}

// Position represents a trading position
type Position struct {
	Symbol        string    `json:"symbol"`
	Side          string    `json:"side"`
	Size          float64   `json:"size"`
	EntryPrice    float64   `json:"entry_price"`
	CurrentPrice  float64   `json:"current_price"`
	UnrealizedPnL float64   `json:"unrealized_pnl"`
	OpenTime      time.Time `json:"open_time"`
}

// Order represents a trading order
type Order struct {
	ID           string    `json:"id"`
	Symbol       string    `json:"symbol"`
	Side         string    `json:"side"`
	Type         string    `json:"type"`
	Price        float64   `json:"price"`
	Amount       float64   `json:"amount"`
	FilledAmount float64   `json:"filled_amount"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
}

// Config holds configuration for risk engine
type Config struct {
	MaxPositionSize     float64
	MaxDrawdown         float64
	MaxLeverage         float64
	MinMarginLevel      float64
	MaxDailyLoss        float64
	MaxOrderValue       float64
	RuleRefreshInterval time.Duration
	RedisURL            string
}

// DefaultConfig returns default configuration
func DefaultConfig() *Config {
	return &Config{
		MaxPositionSize:     100000.0,
		MaxDrawdown:         0.1,
		MaxLeverage:         3.0,
		MinMarginLevel:      1.5,
		MaxDailyLoss:        10000.0,
		MaxOrderValue:       50000.0,
		RuleRefreshInterval: time.Minute,
		RedisURL:            "redis://localhost:6379/2",
	}
}

// Engine represents the risk control engine
type Engine struct {
	mu       sync.RWMutex
	config   *Config
	rules    map[string]*Rule
	cache    *redis.Client
	handlers map[string]RuleHandler
	done     chan struct{}
}

// RuleHandler defines the interface for rule handlers
type RuleHandler interface {
	Handle(ctx context.Context, rule *Rule, data interface{}) error
}

// NewEngine creates a new risk control engine
func NewEngine(config *Config) (*Engine, error) {
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

	return &Engine{
		config:   config,
		rules:    make(map[string]*Rule),
		cache:    cache,
		handlers: make(map[string]RuleHandler),
		done:     make(chan struct{}),
	}, nil
}

// Start starts the risk control engine
func (e *Engine) Start(ctx context.Context) error {
	// Load initial rules
	if err := e.loadRules(ctx); err != nil {
		return fmt.Errorf("failed to load rules: %v", err)
	}

	// Start rule refresh goroutine
	go e.refreshRules(ctx)

	return nil
}

// Stop stops the risk control engine
func (e *Engine) Stop() error {
	close(e.done)
	return e.cache.Close()
}

// RegisterHandler registers a rule handler
func (e *Engine) RegisterHandler(ruleType string, handler RuleHandler) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.handlers[ruleType] = handler
}

// AddRule adds a new risk control rule
func (e *Engine) AddRule(ctx context.Context, rule *Rule) error {
	if rule.ID == "" || rule.Type == "" {
		return fmt.Errorf("invalid rule: missing ID or Type")
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	// Validate rule handler
	if _, exists := e.handlers[rule.Type]; !exists {
		return fmt.Errorf("no handler registered for rule type: %s", rule.Type)
	}

	// Store rule in Redis
	data, err := json.Marshal(rule)
	if err != nil {
		return fmt.Errorf("failed to marshal rule: %v", err)
	}

	key := fmt.Sprintf("risk:rule:%s", rule.ID)
	if err := e.cache.Set(ctx, key, data, 0).Err(); err != nil {
		return fmt.Errorf("failed to store rule: %v", err)
	}

	e.rules[rule.ID] = rule
	return nil
}

// UpdateRule updates an existing risk control rule
func (e *Engine) UpdateRule(ctx context.Context, rule *Rule) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if _, exists := e.rules[rule.ID]; !exists {
		return fmt.Errorf("rule not found: %s", rule.ID)
	}

	// Store updated rule in Redis
	data, err := json.Marshal(rule)
	if err != nil {
		return fmt.Errorf("failed to marshal rule: %v", err)
	}

	key := fmt.Sprintf("risk:rule:%s", rule.ID)
	if err := e.cache.Set(ctx, key, data, 0).Err(); err != nil {
		return fmt.Errorf("failed to store rule: %v", err)
	}

	e.rules[rule.ID] = rule
	return nil
}

// DeleteRule deletes a risk control rule
func (e *Engine) DeleteRule(ctx context.Context, ruleID string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if _, exists := e.rules[ruleID]; !exists {
		return fmt.Errorf("rule not found: %s", ruleID)
	}

	key := fmt.Sprintf("risk:rule:%s", ruleID)
	if err := e.cache.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("failed to delete rule: %v", err)
	}

	delete(e.rules, ruleID)
	return nil
}

// CheckOrder checks if an order complies with risk control rules
func (e *Engine) CheckOrder(ctx context.Context, order *Order) error {
	e.mu.RLock()
	defer e.mu.RUnlock()

	// Basic checks
	if order.Amount*order.Price > e.config.MaxOrderValue {
		return fmt.Errorf("order value exceeds maximum limit")
	}

	// Apply rules in priority order
	rules := e.getSortedRules()
	for _, rule := range rules {
		if !rule.IsEnabled {
			continue
		}

		handler, exists := e.handlers[rule.Type]
		if !exists {
			continue
		}

		if err := handler.Handle(ctx, rule, order); err != nil {
			return fmt.Errorf("rule %s failed: %v", rule.ID, err)
		}
	}

	return nil
}

// CheckPosition checks if a position complies with risk control rules
func (e *Engine) CheckPosition(ctx context.Context, position *Position) error {
	e.mu.RLock()
	defer e.mu.RUnlock()

	// Basic checks
	if position.Size > e.config.MaxPositionSize {
		return fmt.Errorf("position size exceeds maximum limit")
	}

	pnlRatio := position.UnrealizedPnL / (position.Size * position.EntryPrice)
	if pnlRatio < -e.config.MaxDrawdown {
		return fmt.Errorf("position drawdown exceeds maximum limit")
	}

	// Apply rules in priority order
	rules := e.getSortedRules()
	for _, rule := range rules {
		if !rule.IsEnabled {
			continue
		}

		handler, exists := e.handlers[rule.Type]
		if !exists {
			continue
		}

		if err := handler.Handle(ctx, rule, position); err != nil {
			return fmt.Errorf("rule %s failed: %v", rule.ID, err)
		}
	}

	return nil
}

// loadRules loads rules from Redis
func (e *Engine) loadRules(ctx context.Context) error {
	pattern := "risk:rule:*"
	keys, err := e.cache.Keys(ctx, pattern).Result()
	if err != nil {
		return fmt.Errorf("failed to get rule keys: %v", err)
	}

	for _, key := range keys {
		data, err := e.cache.Get(ctx, key).Bytes()
		if err != nil {
			continue
		}

		var rule Rule
		if err := json.Unmarshal(data, &rule); err != nil {
			continue
		}

		e.rules[rule.ID] = &rule
	}

	return nil
}

// refreshRules periodically refreshes rules from Redis
func (e *Engine) refreshRules(ctx context.Context) {
	ticker := time.NewTicker(e.config.RuleRefreshInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-e.done:
			return
		case <-ticker.C:
			if err := e.loadRules(ctx); err != nil {
				// Log error but continue
				fmt.Printf("Failed to refresh rules: %v\n", err)
			}
		}
	}
}

// getSortedRules returns rules sorted by priority
func (e *Engine) getSortedRules() []*Rule {
	rules := make([]*Rule, 0, len(e.rules))
	for _, rule := range e.rules {
		rules = append(rules, rule)
	}

	sort.Slice(rules, func(i, j int) bool {
		return rules[i].Priority > rules[j].Priority
	})

	return rules
}
