package processor

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"
)

// Config holds configuration for feature processing
type Config struct {
	WindowSizes          []int
	VolatilityWindows    []int
	CorrelationThreshold float64
}

// DefaultConfig returns default configuration
func DefaultConfig() *Config {
	return &Config{
		WindowSizes:          []int{5, 10, 20, 30, 60},
		VolatilityWindows:    []int{5, 10, 20},
		CorrelationThreshold: 0.8,
	}
}

// MarketData represents OHLCV market data
type MarketData struct {
	Timestamp []time.Time
	Open      []float64
	High      []float64
	Low       []float64
	Close     []float64
	Volume    []float64
}

// FeatureProcessor handles feature engineering tasks
type FeatureProcessor struct {
	mu     sync.RWMutex
	config *Config
	cache  map[string]interface{}
}

// NewFeatureProcessor creates a new feature processor instance
func NewFeatureProcessor(config *Config) *FeatureProcessor {
	if config == nil {
		config = DefaultConfig()
	}
	return &FeatureProcessor{
		config: config,
		cache:  make(map[string]interface{}),
	}
}

// ProcessMarketFeatures generates market features from OHLCV data
func (fp *FeatureProcessor) ProcessMarketFeatures(ctx context.Context, data *MarketData) (map[string][]float64, error) {
	if err := fp.validateData(data); err != nil {
		return nil, fmt.Errorf("invalid data: %v", err)
	}

	features := make(map[string][]float64)

	// Add basic technical indicators
	if err := fp.addTechnicalIndicators(data, features); err != nil {
		return nil, fmt.Errorf("failed to add technical indicators: %v", err)
	}

	// Add custom market features
	if err := fp.addCustomMarketFeatures(data, features); err != nil {
		return nil, fmt.Errorf("failed to add custom market features: %v", err)
	}

	return features, nil
}

func (fp *FeatureProcessor) validateData(data *MarketData) error {
	if data == nil {
		return fmt.Errorf("data is nil")
	}
	if len(data.Close) == 0 {
		return fmt.Errorf("no price data")
	}
	return nil
}

func (fp *FeatureProcessor) addTechnicalIndicators(data *MarketData, features map[string][]float64) error {
	// Calculate ADX (Average Directional Index)
	features["ADX"] = fp.calculateADX(data.High, data.Low, data.Close, 14)

	// Calculate CCI (Commodity Channel Index)
	features["CCI"] = fp.calculateCCI(data.High, data.Low, data.Close, 14)

	// Calculate RSI (Relative Strength Index)
	features["RSI"] = fp.calculateRSI(data.Close, 14)

	// Calculate MACD (Moving Average Convergence Divergence)
	features["MACD"] = fp.calculateMACD(data.Close, 12, 26, 9)

	// Calculate ATR (Average True Range)
	features["ATR"] = fp.calculateATR(data.High, data.Low, data.Close, 14)

	// Calculate Bollinger Bands
	upper, middle, lower := fp.calculateBollingerBands(data.Close, 20, 2.0)
	features["BBANDS_UPPER"] = upper
	features["BBANDS_MIDDLE"] = middle
	features["BBANDS_LOWER"] = lower

	return nil
}

// calculateSMA calculates Simple Moving Average
func (fp *FeatureProcessor) calculateSMA(data []float64, period int) []float64 {
	length := len(data)
	result := make([]float64, length)

	for i := period - 1; i < length; i++ {
		sum := 0.0
		for j := 0; j < period; j++ {
			sum += data[i-j]
		}
		result[i] = sum / float64(period)
	}
	return result
}

// calculateEMA calculates Exponential Moving Average
func (fp *FeatureProcessor) calculateEMA(data []float64, period int) []float64 {
	length := len(data)
	result := make([]float64, length)
	multiplier := 2.0 / float64(period+1)

	// Initialize with SMA
	var sum float64
	for i := 0; i < period; i++ {
		sum += data[i]
	}
	result[period-1] = sum / float64(period)

	// Calculate EMA
	for i := period; i < length; i++ {
		result[i] = (data[i]-result[i-1])*multiplier + result[i-1]
	}
	return result
}

// calculateRSI calculates Relative Strength Index
func (fp *FeatureProcessor) calculateRSI(data []float64, period int) []float64 {
	length := len(data)
	result := make([]float64, length)
	gains := make([]float64, length)
	losses := make([]float64, length)

	// Calculate gains and losses
	for i := 1; i < length; i++ {
		change := data[i] - data[i-1]
		if change > 0 {
			gains[i] = change
		} else {
			losses[i] = -change
		}
	}

	// Calculate average gains and losses
	avgGain := fp.calculateEMA(gains, period)
	avgLoss := fp.calculateEMA(losses, period)

	// Calculate RSI
	for i := period; i < length; i++ {
		if avgLoss[i] == 0 {
			result[i] = 100
		} else {
			rs := avgGain[i] / avgLoss[i]
			result[i] = 100 - (100 / (1 + rs))
		}
	}
	return result
}

// calculateMACD calculates Moving Average Convergence Divergence
func (fp *FeatureProcessor) calculateMACD(data []float64, fastPeriod, slowPeriod, signalPeriod int) []float64 {
	fastEMA := fp.calculateEMA(data, fastPeriod)
	slowEMA := fp.calculateEMA(data, slowPeriod)

	length := len(data)
	macd := make([]float64, length)
	for i := 0; i < length; i++ {
		macd[i] = fastEMA[i] - slowEMA[i]
	}
	return macd
}

// calculateATR calculates Average True Range
func (fp *FeatureProcessor) calculateATR(high, low, close []float64, period int) []float64 {
	length := len(close)
	tr := make([]float64, length)
	atr := make([]float64, length)

	// Calculate True Range
	for i := 1; i < length; i++ {
		hl := high[i] - low[i]
		hc := math.Abs(high[i] - close[i-1])
		lc := math.Abs(low[i] - close[i-1])
		tr[i] = math.Max(hl, math.Max(hc, lc))
	}

	// Calculate ATR using EMA of TR
	atr = fp.calculateEMA(tr, period)
	return atr
}

// calculateBollingerBands calculates Bollinger Bands
func (fp *FeatureProcessor) calculateBollingerBands(data []float64, period int, stdDev float64) ([]float64, []float64, []float64) {
	length := len(data)
	upper := make([]float64, length)
	middle := make([]float64, length)
	lower := make([]float64, length)

	// Calculate middle band (SMA)
	middle = fp.calculateSMA(data, period)

	// Calculate standard deviation and bands
	for i := period - 1; i < length; i++ {
		sum := 0.0
		for j := 0; j < period; j++ {
			diff := data[i-j] - middle[i]
			sum += diff * diff
		}
		sd := math.Sqrt(sum / float64(period))
		upper[i] = middle[i] + stdDev*sd
		lower[i] = middle[i] - stdDev*sd
	}

	return upper, middle, lower
}

// calculateADX calculates Average Directional Index
func (fp *FeatureProcessor) calculateADX(high, low, close []float64, period int) []float64 {
	length := len(close)
	adx := make([]float64, length)
	tr := make([]float64, length)
	plusDM := make([]float64, length)
	minusDM := make([]float64, length)

	// Calculate True Range and Directional Movement
	for i := 1; i < length; i++ {
		hl := high[i] - low[i]
		hc := math.Abs(high[i] - close[i-1])
		lc := math.Abs(low[i] - close[i-1])
		tr[i] = math.Max(hl, math.Max(hc, lc))

		upMove := high[i] - high[i-1]
		downMove := low[i-1] - low[i]

		if upMove > downMove && upMove > 0 {
			plusDM[i] = upMove
		}
		if downMove > upMove && downMove > 0 {
			minusDM[i] = downMove
		}
	}

	// Smooth the indicators
	smoothTR := fp.calculateEMA(tr, period)
	smoothPlusDM := fp.calculateEMA(plusDM, period)
	smoothMinusDM := fp.calculateEMA(minusDM, period)

	// Calculate ADX
	for i := period; i < length; i++ {
		if smoothTR[i] > 0 {
			plusDI := 100 * smoothPlusDM[i] / smoothTR[i]
			minusDI := 100 * smoothMinusDM[i] / smoothTR[i]
			dx := 100 * math.Abs(plusDI-minusDI) / (plusDI + minusDI)
			adx[i] = (adx[i-1]*(float64(period)-1) + dx) / float64(period)
		}
	}

	return adx
}

// calculateCCI calculates Commodity Channel Index
func (fp *FeatureProcessor) calculateCCI(high, low, close []float64, period int) []float64 {
	length := len(close)
	cci := make([]float64, length)
	tp := make([]float64, length)

	// Calculate Typical Price
	for i := 0; i < length; i++ {
		tp[i] = (high[i] + low[i] + close[i]) / 3
	}

	sma := fp.calculateSMA(tp, period)

	// Calculate CCI
	for i := period - 1; i < length; i++ {
		// Calculate Mean Deviation
		sum := 0.0
		for j := 0; j < period; j++ {
			sum += math.Abs(tp[i-j] - sma[i])
		}
		meanDev := sum / float64(period)

		if meanDev != 0 {
			cci[i] = (tp[i] - sma[i]) / (0.015 * meanDev)
		}
	}

	return cci
}

func (fp *FeatureProcessor) addCustomMarketFeatures(data *MarketData, features map[string][]float64) error {
	length := len(data.Close)

	// Calculate returns for different windows
	for _, window := range fp.config.WindowSizes {
		returns := make([]float64, length)
		for i := window; i < length; i++ {
			returns[i] = (data.Close[i] - data.Close[i-window]) / data.Close[i-window]
		}
		features[fmt.Sprintf("return_%d", window)] = returns
	}

	// Calculate volatility for different windows
	for _, window := range fp.config.VolatilityWindows {
		volatility := make([]float64, length)
		for i := window; i < length; i++ {
			sum := 0.0
			mean := data.Close[i-window : i]
			meanVal := fp.mean(mean)
			for j := i - window; j < i; j++ {
				diff := data.Close[j] - meanVal
				sum += diff * diff
			}
			volatility[i] = math.Sqrt(sum / float64(window))
		}
		features[fmt.Sprintf("volatility_%d", window)] = volatility
	}

	return nil
}

func (fp *FeatureProcessor) mean(data []float64) float64 {
	sum := 0.0
	for _, v := range data {
		sum += v
	}
	return sum / float64(len(data))
}
