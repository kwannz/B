package executor

import (
	"context"
	"testing"
	"time"

	"github.com/kwanRoshi/B/go-migration/internal/types"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"go.uber.org/zap"
)

func TestPumpExecutor_ExecuteTrade(t *testing.T) {
	logger := zap.NewNop()
	mockProvider := new(MockProvider)
	riskMgr := &types.MockRiskManager{}
	config := &types.PumpTradingConfig{
		MaxMarketCap: decimal.NewFromFloat(1000000),
		MinVolume:    decimal.NewFromFloat(1000),
	}

	executor := NewPumpExecutor(logger, mockProvider, riskMgr, config, "test_api_key")
	assert.NoError(t, executor.Start())

	signal := &types.Signal{
		Symbol:    "TEST",
		Type:      types.SignalTypeBuy,
		Amount:    decimal.NewFromFloat(1.0),
		Price:     decimal.NewFromFloat(100.0),
		Provider:  "pump.fun",
		Timestamp: time.Now(),
	}

	riskMgr.On("ValidatePosition", "TEST", decimal.NewFromFloat(1.0)).Return(nil)
	mockProvider.On("ExecuteTrade", mock.Anything, mock.Anything).Return(nil)

	err := executor.ExecuteTrade(context.Background(), signal)
	assert.NoError(t, err)

	mockProvider.AssertExpectations(t)
	riskMgr.AssertExpectations(t)

	positions := executor.GetPositions()
	assert.Len(t, positions, 1)
	assert.True(t, decimal.NewFromFloat(1.0).Equal(positions["TEST"].Size))
	assert.True(t, decimal.NewFromFloat(100.0).Equal(positions["TEST"].EntryPrice))
}

func TestPumpExecutor_InvalidAPIKey(t *testing.T) {
	logger := zap.NewNop()
	mockProvider := new(MockProvider)
	riskMgr := &types.MockRiskManager{}
	config := &types.PumpTradingConfig{
		MaxMarketCap: decimal.NewFromFloat(1000000),
		MinVolume:    decimal.NewFromFloat(1000),
	}
	
	executor := NewPumpExecutor(logger, mockProvider, riskMgr, config, "invalid_key")
	assert.NoError(t, executor.Start())

	signal := &types.Signal{
		Symbol:    "TEST",
		Type:      types.SignalTypeBuy,
		Amount:    decimal.NewFromFloat(1.0),
		Price:     decimal.NewFromFloat(100.0),
		Provider:  "pump.fun",
		Timestamp: time.Now(),
	}

	err := executor.ExecuteTrade(context.Background(), signal)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid API key")
}
