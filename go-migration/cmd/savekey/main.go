package main

import (
	"log"

	"github.com/kwanRoshi/B/go-migration/internal/config"
)

func main() {
	secrets := &config.Secrets{
		PumpFunKey: "2zYNtr7JxRkppBS4mWkCUAok8cmyMZqSsLt92kvyAUFseij2ubShVqzkhy8mWcG8J2rSjMNiGcFrtAXAr7Mp3QZ1",
	}

	if err := config.SaveSecrets(secrets); err != nil {
		log.Fatalf("Failed to save secrets: %v", err)
	}
	log.Println("Successfully saved secret key")
}
