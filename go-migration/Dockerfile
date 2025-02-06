FROM golang:1.23.6-alpine

WORKDIR /app

COPY . .

RUN go mod download && \
    go build -o bin/trading ./cmd/execute_trading

CMD ["./bin/trading"]
