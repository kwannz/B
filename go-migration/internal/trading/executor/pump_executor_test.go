package executor

import (
	"context"
	"testing"
	"time"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
	"github.com/kwanRoshi/B/go-migration/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
)

type MockProvider struct {
	mock.Mock
}

func (m *MockProvider) ExecuteTrade(ctx context.Context, params map[string]interface{}) error {
	args := m.Called(ctx, params)
	return args.Error(0)
}

func TestPumpExecutor_ExecuteTrade(t *testing.T) {
	logger := zap.NewNop()
	mockProvider := new(MockProvider)
	riskMgr := &types.MockRiskManager{}
	apiKey := "test_api_key"

	executor := NewPumpExecutor(logger, mockProvider, riskMgr, apiKey)
	assert.NoError(t, executor.Start())

	signal := &types.Signal{
		Symbol:    "TEST",
		Type:      "buy",
		Size:      1.0,
		Price:     100.0,
		Provider:  "pump.fun",
		Timestamp: time.Now(),
	}

	riskMgr.On("ValidatePosition", "TEST", float64(1.0)).Return(nil)
	mockProvider.On("ExecuteTrade", mock.Anything, mock.Anything).Return(nil)

	err := executor.ExecuteTrade(context.Background(), signal)
	assert.NoError(t, err)

	mockProvider.AssertExpectations(t)
	riskMgr.AssertExpectations(t)

	positions := executor.GetPositions()
	assert.Len(t, positions, 1)
	assert.Equal(t, float64(1.0), positions["TEST"].Size)
	assert.Equal(t, float64(100.0), positions["TEST"].EntryPrice)

	metrics := make(chan prometheus.Metric, 100)
	metrics.PumpPositionSize.Collect(metrics)
	metrics.PumpTradeExecutions.Collect(metrics)
	metrics.APIKeyUsage.Collect(metrics)

	close(metrics)
	var positionSize, tradeCount, keyUsage float64
	for metric := range metrics {
		m := &dto.Metric{}
		metric.Write(m)
		if m.Gauge != nil {
			positionSize = m.Gauge.GetValue()
		}
		if m.Counter != nil {
			if metric.Desc().String() == "pump_trade_executions_total" {
				tradeCount = m.Counter.GetValue()
			}
			if metric.Desc().String() == "api_key_usage_total" {
				keyUsage = m.Counter.GetValue()
			}
		}
	}

	assert.Equal(t, float64(1.0), positionSize)
	assert.Equal(t, float64(1.0), tradeCount)
	assert.Greater(t, keyUsage, float64(0))
}

func TestPumpExecutor_InvalidAPIKey(t *testing.T) {
	logger := zap.NewNop()
	mockProvider := new(MockProvider)
	riskMgr := &types.MockRiskManager{}
	
	executor := NewPumpExecutor(logger, mockProvider, riskMgr, "invalid_key")
	assert.NoError(t, executor.Start())

	signal := &types.Signal{
		Symbol:    "TEST",
		Type:      "buy",
		Size:      1.0,
		Price:     100.0,
		Provider:  "pump.fun",
		Timestamp: time.Now(),
	}

	err := executor.ExecuteTrade(context.Background(), signal)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid API key")
}
