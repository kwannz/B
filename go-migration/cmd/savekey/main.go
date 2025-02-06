package main

import (
	"log"

	"github.com/kwanRoshi/B/go-migration/internal/config"
)

func main() {
	secrets := &config.Secrets{
		PumpFunKey: os.Getenv("PUMP_FUN_API_KEY"),
	}

	if err := config.SaveSecrets(secrets); err != nil {
		log.Fatalf("Failed to save secrets: %v", err)
	}
	log.Println("Successfully saved secret key")
}
