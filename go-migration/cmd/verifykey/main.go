package main

import (
	"log"

	"github.com/kwanRoshi/B/go-migration/internal/config"
)

func main() {
	secrets, err := config.LoadSecrets()
	if err != nil {
		log.Fatalf("Failed to load secrets: %v", err)
	}
	log.Printf("Successfully loaded secret key (length: %d)", len(secrets.PumpFunKey))
}
