package types

import "time"

type TokenUpdate struct {
	Symbol      string    `json:"symbol"`
	TokenName   string    `json:"token_name"`
	Price       float64   `json:"price"`
	MarketCap   float64   `json:"market_cap"`
	Volume      float64   `json:"volume"`
	TotalSupply float64   `json:"total_supply"`
	Address     string    `json:"address"`
	TxHash      string    `json:"tx_hash"`
	BlockTime   int64     `json:"block_time"`
	PriceChange struct {
		Hour float64 `json:"hour"`
		Day  float64 `json:"day"`
	} `json:"price_change"`
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
}
