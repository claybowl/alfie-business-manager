#!/bin/bash

echo "🔧 Killing all running services..."

# Kill any process using ports 5173, 8001, 8500, 39300
echo "📋 Checking for processes on ports 5173, 8001, 8500, 39300..."

# Find and kill processes on these ports
for port in 5173 8001 8500 39300; do
    PID=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$PID" ]; then
        echo "🔪 Killing process on port $port (PID: $PID)"
        kill -9 $PID 2>/dev/null
    fi
done

# Also kill any node processes that might be running
echo "🔪 Killing any stray node processes..."
pkill -f "node.*server" 2>/dev/null
pkill -f "npm.*dev" 2>/dev/null
pkill -f "python.*server" 2>/dev/null

echo "⏳ Waiting 2 seconds for processes to terminate..."
sleep 2

echo ""
echo "🚀 Starting services with correct port configuration..."

# Start Graphiti service on port 8500
echo "📊 Starting Graphiti service (port 8500)..."
cd graphiti-service
if [ -f "requirements.txt" ]; then
    python -m pip install -r requirements.txt
fi
nohup python server.py > ../logs/graphiti.log 2>&1 &
GRAPHITI_PID=$!
echo "✅ Graphiti service started (PID: $GRAPHITI_PID)"

# Go back to root directory
cd ..

# Start backend server on port 8001
echo "🔧 Starting backend server (port 8001)..."
cd backend
# Set environment variable for backend port
export PORT=8001
nohup npm run dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend server started (PID: $BACKEND_PID) on port 8001"

# Go back to root directory
cd ..

# Start frontend on port 5173
echo "⚛ Starting frontend (port 5173)..."
nohup npm run dev > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID) on port 5173"

echo ""
echo "🎉 All services started!"
echo ""
echo "📍 Service URLs:"
echo "   • Frontend: http://localhost:3000"
echo "   • Backend API: http://localhost:8001"
echo "   • Graphiti Service: http://localhost:8500"
echo "   • Pieces OS: http://localhost:39300"
echo ""
echo "📝 Logs:"
echo "   • Frontend: logs/frontend.log"
echo "   • Backend: logs/backend.log"
echo "   • Graphiti: logs/graphiti.log"
echo ""
echo "🛑 To stop all services, run: ./stop-services.sh"
echo ""

# Create log directory if it doesn't exist
mkdir -p logs

# Save PIDs for later use
echo $FRONTEND_PID > logs/frontend.pid
echo $BACKEND_PID > logs/backend.pid
echo $GRAPHITI_PID > logs/graphiti.pid

echo "💾 Process IDs saved to logs/*.pid files"