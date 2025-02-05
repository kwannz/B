package analysis

import (
	"go.uber.org/zap"

	"github.com/shopspring/decimal"
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type Analyzer struct {
	logger *zap.Logger
}

func NewAnalyzer(logger *zap.Logger) *Analyzer {
	return &Analyzer{
		logger: logger,
	}
}

func (a *Analyzer) CalculateRSI(prices []*types.PriceUpdate, period int) float64 {
	if len(prices) < period+1 {
		return 50.0
	}

	gains := decimal.Zero
	losses := decimal.Zero
	for i := 1; i <= period; i++ {
		current := prices[len(prices)-i].Price
		prev := prices[len(prices)-i-1].Price
		change := current.Sub(prev)
		if change.IsPositive() {
			gains = gains.Add(change)
		} else {
			losses = losses.Add(change.Abs())
		}
	}

	if losses.IsZero() {
		return 100.0
	}

	periodDecimal := decimal.NewFromInt(int64(period))
	avgGain := gains.Div(periodDecimal)
	avgLoss := losses.Div(periodDecimal)
	rs := avgGain.Div(avgLoss)
	hundred := decimal.NewFromInt(100)
	one := decimal.NewFromInt(1)
	rsi := hundred.Sub(hundred.Div(one.Add(rs)))

	return rsi.InexactFloat64()
}

func (a *Analyzer) CalculateMA(prices []*types.PriceUpdate, period int) float64 {
	if len(prices) < period {
		return prices[len(prices)-1].Price.InexactFloat64()
	}

	sum := decimal.Zero
	for i := 0; i < period; i++ {
		sum = sum.Add(prices[len(prices)-1-i].Price)
	}

	return sum.Div(decimal.NewFromInt(int64(period))).InexactFloat64()
}

func (a *Analyzer) CalculateVolatility(prices []*types.PriceUpdate, period int) float64 {
	if len(prices) < period {
		return 0.0
	}

	mean := decimal.NewFromFloat(a.CalculateMA(prices, period))
	sumSquaredDiff := decimal.Zero

	for i := 0; i < period; i++ {
		diff := prices[len(prices)-1-i].Price.Sub(mean)
		sumSquaredDiff = sumSquaredDiff.Add(diff.Mul(diff))
	}

	variance := sumSquaredDiff.Div(decimal.NewFromInt(int64(period)))
	// Calculate square root using Newton's method
	x := variance.Div(decimal.NewFromInt(2))
	for i := 0; i < 10; i++ {
		x = x.Add(variance.Div(x)).Div(decimal.NewFromInt(2))
	}
	return x.InexactFloat64()
}
