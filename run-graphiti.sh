#!/bin/bash

echo "🚀 Starting Graphiti service on port 8500..."
cd graphiti-service

# Set PORT environment variable explicitly
export PORT=8500

# Check if requirements exist and install if needed
if [ -f "requirements.txt" ]; then
    echo "📦 Installing Python dependencies..."
    pip install -r requirements.txt
fi

# Start the service
echo "📊 Graphiti service starting on http://localhost:8500"
python main.py