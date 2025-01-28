FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY deploy-docker/requirements.consolidated.txt .
RUN pip install --no-cache-dir -r requirements.consolidated.txt

# Copy application code
COPY src/backend /app/src/backend
COPY src/shared /app/src/shared

ENV PYTHONPATH=/app/src

# Run API Gateway by default
CMD ["uvicorn", "src.backend.api_gateway.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
