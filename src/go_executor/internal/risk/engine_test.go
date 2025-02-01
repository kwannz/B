package risk

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRuleHandler struct {
	shouldFail bool
}

func (h *mockRuleHandler) Handle(_ context.Context, _ *Rule, _ interface{}) error {
	if h.shouldFail {
		return fmt.Errorf("mock handler error")
	}
	return nil
}

func TestEngine(t *testing.T) {
	// Create test config
	config := &Config{
		MaxPositionSize:     1000.0,
		MaxDrawdown:         0.05,
		MaxLeverage:         2.0,
		MinMarginLevel:      1.2,
		MaxDailyLoss:        500.0,
		MaxOrderValue:       200.0,
		RuleRefreshInterval: time.Millisecond * 100,
		RedisURL:            "redis://localhost:6379/3",
	}

	// Create engine
	engine, err := NewEngine(config)
	require.NoError(t, err)
	defer engine.Stop()

	// Start engine
	ctx := context.Background()
	err = engine.Start(ctx)
	require.NoError(t, err)

	// Register handlers
	engine.RegisterHandler("position_limit", &mockRuleHandler{shouldFail: false})
	engine.RegisterHandler("drawdown_limit", &mockRuleHandler{shouldFail: false})
	engine.RegisterHandler("order_limit", &mockRuleHandler{shouldFail: false})

	t.Run("Rule Management", func(t *testing.T) {
		// Add rule
		rule := &Rule{
			ID:         "test_rule_1",
			Name:       "Test Rule 1",
			Type:       "position_limit",
			Conditions: map[string]interface{}{"max_size": 1000.0},
			Actions:    []string{"reject_order"},
			Priority:   1,
			IsEnabled:  true,
		}

		err := engine.AddRule(ctx, rule)
		require.NoError(t, err)

		// Update rule
		rule.Conditions["max_size"] = 2000.0
		err = engine.UpdateRule(ctx, rule)
		require.NoError(t, err)

		// Delete rule
		err = engine.DeleteRule(ctx, rule.ID)
		require.NoError(t, err)

		// Try to update non-existent rule
		err = engine.UpdateRule(ctx, rule)
		assert.Error(t, err)

		// Try to delete non-existent rule
		err = engine.DeleteRule(ctx, rule.ID)
		assert.Error(t, err)
	})

	t.Run("Order Checks", func(t *testing.T) {
		// Add test rules
		rules := []*Rule{
			{
				ID:         "order_size_limit",
				Name:       "Order Size Limit",
				Type:       "order_limit",
				Conditions: map[string]interface{}{"max_value": 200.0},
				Actions:    []string{"reject_order"},
				Priority:   2,
				IsEnabled:  true,
			},
			{
				ID:         "position_limit",
				Name:       "Position Limit",
				Type:       "position_limit",
				Conditions: map[string]interface{}{"max_size": 1000.0},
				Actions:    []string{"reject_order"},
				Priority:   1,
				IsEnabled:  true,
			},
		}

		for _, rule := range rules {
			err := engine.AddRule(ctx, rule)
			require.NoError(t, err)
		}

		testCases := []struct {
			name        string
			order       *Order
			shouldError bool
		}{
			{
				name: "Valid order",
				order: &Order{
					ID:        "order1",
					Symbol:    "BTC-USD",
					Side:      "buy",
					Type:      "limit",
					Price:     100.0,
					Amount:    1.0,
					Status:    "new",
					CreatedAt: time.Now(),
				},
				shouldError: false,
			},
			{
				name: "Order exceeds max value",
				order: &Order{
					ID:        "order2",
					Symbol:    "BTC-USD",
					Side:      "buy",
					Type:      "limit",
					Price:     1000.0,
					Amount:    1.0,
					Status:    "new",
					CreatedAt: time.Now(),
				},
				shouldError: true,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				err := engine.CheckOrder(ctx, tc.order)
				if tc.shouldError {
					assert.Error(t, err)
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})

	t.Run("Position Checks", func(t *testing.T) {
		testCases := []struct {
			name        string
			position    *Position
			shouldError bool
		}{
			{
				name: "Valid position",
				position: &Position{
					Symbol:        "BTC-USD",
					Side:          "long",
					Size:          500.0,
					EntryPrice:    50000.0,
					CurrentPrice:  51000.0,
					UnrealizedPnL: 1000.0,
					OpenTime:      time.Now(),
				},
				shouldError: false,
			},
			{
				name: "Position exceeds size limit",
				position: &Position{
					Symbol:        "BTC-USD",
					Side:          "long",
					Size:          2000.0,
					EntryPrice:    50000.0,
					CurrentPrice:  51000.0,
					UnrealizedPnL: 2000.0,
					OpenTime:      time.Now(),
				},
				shouldError: true,
			},
			{
				name: "Position exceeds drawdown limit",
				position: &Position{
					Symbol:        "BTC-USD",
					Side:          "long",
					Size:          500.0,
					EntryPrice:    50000.0,
					CurrentPrice:  47000.0,
					UnrealizedPnL: -3000.0,
					OpenTime:      time.Now(),
				},
				shouldError: true,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				err := engine.CheckPosition(ctx, tc.position)
				if tc.shouldError {
					assert.Error(t, err)
				} else {
					assert.NoError(t, err)
				}
			})
		}
	})

	t.Run("Rule Priority", func(t *testing.T) {
		// Register handler that fails for high priority rule
		engine.RegisterHandler("high_priority", &mockRuleHandler{shouldFail: true})

		// Add rules with different priorities
		rules := []*Rule{
			{
				ID:        "low_priority_rule",
				Name:      "Low Priority Rule",
				Type:      "order_limit",
				Priority:  1,
				IsEnabled: true,
			},
			{
				ID:        "high_priority_rule",
				Name:      "High Priority Rule",
				Type:      "high_priority",
				Priority:  2,
				IsEnabled: true,
			},
		}

		for _, rule := range rules {
			err := engine.AddRule(ctx, rule)
			require.NoError(t, err)
		}

		// Check that high priority rule is evaluated first and fails
		order := &Order{
			ID:     "test_order",
			Symbol: "BTC-USD",
			Price:  100.0,
			Amount: 1.0,
		}

		err := engine.CheckOrder(ctx, order)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "mock handler error")
	})
}

func TestEngineConfigValidation(t *testing.T) {
	testCases := []struct {
		name        string
		config      *Config
		shouldError bool
	}{
		{
			name:        "Nil config",
			config:      nil,
			shouldError: false, // Should use default config
		},
		{
			name: "Invalid Redis URL",
			config: &Config{
				RedisURL: "invalid://url",
			},
			shouldError: true,
		},
		{
			name: "Valid config",
			config: &Config{
				MaxPositionSize: 1000.0,
				RedisURL:        "redis://localhost:6379/3",
			},
			shouldError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := NewEngine(tc.config)
			if tc.shouldError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
