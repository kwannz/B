package metrics

import (
	"github.com/kwanRoshi/B/go-migration/internal/types"
)

func RecordNewToken(token *types.TokenInfo) {
	NewTokensTotal.Inc()
	TokenPrice.WithLabelValues("pump.fun", token.Symbol).Set(0)
}

func RecordBondingCurve(curve *types.BondingCurve) {
	TokenPrice.WithLabelValues("pump.fun", curve.Symbol).Set(curve.CurrentPrice.InexactFloat64())
}

func RecordAPIError(operation string) {
	APIErrors.WithLabelValues(operation).Inc()
}

func RecordWebsocketConnection(active bool) {
	if active {
		WebsocketConnections.Inc()
	} else {
		WebsocketConnections.Dec()
	}
}

func RecordTokenMarketCap(provider, symbol string, marketCap float64) {
	TokenMarketCap.WithLabelValues(provider, symbol).Set(marketCap)
}
