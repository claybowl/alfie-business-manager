#!/bin/bash

echo "🛑 Stopping all Alfie services..."

# Read PIDs from files if they exist
if [ -f "logs/frontend.pid" ]; then
    FRONTEND_PID=$(cat logs/frontend.pid)
    echo "🔪 Stopping frontend (PID: $FRONTEND_PID)..."
    kill -TERM $FRONTEND_PID 2>/dev/null
    kill -9 $FRONTEND_PID 2>/dev/null
    rm logs/frontend.pid
fi

if [ -f "logs/backend.pid" ]; then
    BACKEND_PID=$(cat logs/backend.pid)
    echo "🔪 Stopping backend (PID: $BACKEND_PID)..."
    kill -TERM $BACKEND_PID 2>/dev/null
    kill -9 $BACKEND_PID 2>/dev/null
    rm logs/backend.pid
fi

if [ -f "logs/graphiti.pid" ]; then
    GRAPHITI_PID=$(cat logs/graphiti.pid)
    echo "🔪 Stopping Graphiti service (PID: $GRAPHITI_PID)..."
    kill -TERM $GRAPHITI_PID 2>/dev/null
    kill -9 $GRAPHITI_PID 2>/dev/null
    rm logs/graphiti.pid
fi

# Also do a blanket kill on the ports to be sure
echo "🔫 Checking for any remaining processes on ports 3000, 8000, 8001, 8500, 39300..."
for port in 3000 8000 8001 8500 39300; do
    PID=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$PID" ]; then
        echo "🔪 Killing remaining process on port $port (PID: $PID)"
        kill -9 $PID 2>/dev/null
    fi
done

# Kill any stray node/python processes
echo "🧹 Cleaning up stray processes..."
pkill -f "node.*server" 2>/dev/null
pkill -f "npm.*dev" 2>/dev/null
pkill -f "python.*server" 2>/dev/null

echo "✅ All services stopped!"
echo ""
echo "📊 Service Status:"
echo "   • Port 3000: $(lsof -ti:3000 > /dev/null && echo '❌ OCCUPIED' || echo '✅ FREE')"
echo "   • Port 8001: $(lsof -ti:8001 > /dev/null && echo '❌ OCCUPIED' || echo '✅ FREE')"
echo "   • Port 8500: $(lsof -ti:8500 > /dev/null && echo '❌ OCCUPIED' || echo '✅ FREE')"
echo "   • Port 39300: $(lsof -ti:39300 > /dev/null && echo '❌ OCCUPIED' || echo '✅ FREE')"