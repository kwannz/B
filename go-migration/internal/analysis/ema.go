package analysis

import (
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

type EMAIndicator struct {
	period int
	value  float64
}

func NewEMAIndicator(period int) *EMAIndicator {
	return &EMAIndicator{
		period: period,
		value:  0,
	}
}

func (i *EMAIndicator) Calculate(history *types.PriceHistory) error {
	if history == nil || history.Len() < i.period {
		return nil
	}

	prices := make([]float64, history.Len())
	for j := 0; j < history.Len(); j++ {
		level := history.Get(j)
		if level != nil {
			prices[j] = level.Price
		}
	}

	multiplier := 2.0 / float64(i.period+1)
	i.value = prices[0]

	for j := 1; j < len(prices); j++ {
		i.value = (prices[j]-i.value)*multiplier + i.value
	}

	return nil
}

func (i *EMAIndicator) Name() string {
	return "ema"
}

func (i *EMAIndicator) Value() float64 {
	return i.value
}

func (i *EMAIndicator) Params() interface{} {
	return map[string]interface{}{
		"period": i.period,
	}
}
