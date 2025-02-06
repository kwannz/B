package strategy

import (
	"fmt"
	"strings"

	"github.com/kwanRoshi/B/go-migration/internal/metrics"
)

type PumpStrategyError struct {
	Op      string
	Symbol  string
	Message string
	Err     error
}

func (e *PumpStrategyError) Error() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("[pump_strategy:%s] ", e.Op))
	if e.Symbol != "" {
		sb.WriteString(fmt.Sprintf("symbol=%s ", e.Symbol))
	}
	if e.Message != "" {
		sb.WriteString(e.Message)
	}
	if e.Err != nil {
		if e.Message != "" {
			sb.WriteString(": ")
		}
		sb.WriteString(e.Err.Error())
	}
	return sb.String()
}

func (e *PumpStrategyError) Unwrap() error {
	return e.Err
}

func NewPumpStrategyError(op, symbol, message string, err error) *PumpStrategyError {
	metrics.APIErrors.WithLabelValues(fmt.Sprintf("pump_strategy_%s", op)).Inc()
	return &PumpStrategyError{
		Op:      op,
		Symbol:  symbol,
		Message: message,
		Err:     err,
	}
}

const (
	OpProcessUpdate     = "process_update"
	OpExecuteTrade      = "execute_trade"
	OpUpdateStopLoss    = "update_stop_loss"
	OpCheckTakeProfit   = "check_take_profit"
	OpCalculatePosition = "calculate_position"
	OpValidatePosition  = "validate_position"
	OpInitStrategy      = "init_strategy"
)

func IsStrategyError(err error) bool {
	_, ok := err.(*PumpStrategyError)
	return err != nil && ok
}
