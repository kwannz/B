#!/bin/bash
set -e

# Start Ollama in the background
ollama serve &
OLLAMA_PID=$!

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
until curl -s -f http://localhost:11434/api/tags > /dev/null; do
    echo "Waiting for Ollama API..."
    sleep 2
done

echo "Pulling DeepSeek model..."
ollama pull deepseek-r1:1.5b

# Keep the container running with the Ollama process
wait $OLLAMA_PID
