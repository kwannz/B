package types

import (
	"github.com/shopspring/decimal"
)

type Quote struct {
	TokenIn     string          `json:"token_in"`
	TokenOut    string          `json:"token_out"`
	Amount      decimal.Decimal `json:"amount"`
	RawTx       string          `json:"raw_tx"`
	BlockHeight int             `json:"block_height"`
	Blockhash   string          `json:"blockhash"`
}

type TransactionResult struct {
	Hash           string `json:"hash"`
	OrderID        string `json:"order_id"`
	BundleID       string `json:"bundle_id"`
	LastValidBlock int    `json:"last_valid_block"`
}

type TransactionStatus struct {
	Success bool `json:"success"`
	Expired bool `json:"expired"`
}

type GMGNProvider interface {
	GetQuote(ctx context.Context, tokenIn, tokenOut string, amount decimal.Decimal) (*Quote, error)
	SubmitTransaction(ctx context.Context, signedTx string) (*TransactionResult, error)
	GetTransactionStatus(ctx context.Context, hash string, lastValidHeight int) (*TransactionStatus, error)
}
