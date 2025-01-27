# Build stage
FROM python:3.11-bullseye AS builder

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=0 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive \
    PATH="/home/tradingbot/.local/bin:${PATH}"

# Create non-root user
RUN useradd -m -d /home/tradingbot tradingbot && \
    mkdir -p /app && \
    chown -R tradingbot:tradingbot /app

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    wget \
    pkg-config \
    python3-dev \
    gcc \
    g++ \
    make \
    libssl-dev \
    libffi-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Switch to non-root user
USER tradingbot

# Copy requirements file
COPY --chown=tradingbot:tradingbot requirements.consolidated.txt .

# Install Python dependencies with increased timeout and retries
RUN pip install --user --no-warn-script-location --timeout 300 --retries 5 -r requirements.consolidated.txt

# Final stage
FROM python:3.11-slim-bullseye

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=0 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DEBIAN_FRONTEND=noninteractive \
    PATH="/home/tradingbot/.local/bin:${PATH}"

# Create non-root user
RUN useradd -m -d /home/tradingbot tradingbot && \
    mkdir -p /app && \
    chown -R tradingbot:tradingbot /app

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq5 \
    libpq-dev \
    python3-dev \
    gcc \
    libssl1.1 \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies from builder
COPY --from=builder --chown=tradingbot:tradingbot /home/tradingbot/.local /home/tradingbot/.local

# Copy project files
COPY --chown=tradingbot:tradingbot . .

# Create directories for database migrations and encryption keys
USER root
RUN mkdir -p /app/src/api_gateway/alembic/versions && \
    mkdir -p /opt/tradingbot/config && \
    chown -R tradingbot:tradingbot /app/src/api_gateway/alembic && \
    chown -R tradingbot:tradingbot /opt/tradingbot && \
    chmod -R 755 /opt/tradingbot
USER tradingbot

# Set entrypoint script
COPY --chown=tradingbot:tradingbot scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Switch to non-root user
USER tradingbot

# Expose ports
EXPOSE 8000 8001

# Add health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
