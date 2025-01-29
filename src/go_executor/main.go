package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

type TradeRequest struct {
	ID        string                 `json:"id"`
	Params    map[string]interface{} `json:"params"`
	Status    string                 `json:"status"`
	Timestamp string                 `json:"timestamp"`
	Wallet    string                 `json:"wallet"`
}

type TradeResponse struct {
	ID        string                 `json:"id"`
	Status    string                 `json:"status"`
	Params    map[string]interface{} `json:"params"`
	Timestamp string                 `json:"timestamp"`
	Wallet    string                 `json:"wallet"`
	Error     string                 `json:"error,omitempty"`
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

func executeTrade(w http.ResponseWriter, r *http.Request) {
	var trade TradeRequest
	if err := json.NewDecoder(r.Body).Decode(&trade); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if trade.Wallet == "" {
		http.Error(w, "wallet address is required", http.StatusBadRequest)
		return
	}

	if trade.Params == nil {
		http.Error(w, "trade parameters are required", http.StatusBadRequest)
		return
	}

	status := "executed"
	var errorMsg string

	if _, hasAmount := trade.Params["amount"]; !hasAmount {
		status = "failed"
		errorMsg = "trade amount is required"
	}

	response := TradeResponse{
		ID:        trade.ID,
		Status:    status,
		Params:    trade.Params,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Wallet:    trade.Wallet,
		Error:     errorMsg,
	}

	w.Header().Set("Content-Type", "application/json")
	if status == "failed" {
		w.WriteHeader(http.StatusBadRequest)
	}
	json.NewEncoder(w).Encode(response)
}

func main() {
	router := mux.NewRouter()
	router.HandleFunc("/health", healthHandler).Methods("GET")
	router.HandleFunc("/execute", executeTrade).Methods("POST")

	srv := &http.Server{
		Handler:      router,
		Addr:         ":9000",
		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	log.Println("Go executor listening on :9000")
	log.Fatal(srv.ListenAndServe())
}
