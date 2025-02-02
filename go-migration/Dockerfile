# Build stage
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/tradingbot ./cmd/tradingbot

# Final stage
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/tradingbot .

# Copy configuration
COPY configs/ ./configs/

# Create non-root user
RUN adduser -D -g '' tradingbot
USER tradingbot

# Expose ports
EXPOSE 8080 8081 50051 9090

# Set entrypoint
ENTRYPOINT ["/app/tradingbot"]
CMD ["--config", "configs/config.yaml"] 