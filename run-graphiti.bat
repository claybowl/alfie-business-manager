@echo off
echo 🚀 Starting Graphiti service on port 8500...
cd graphiti-service

REM Set PORT environment variable explicitly
set PORT=8500

REM Check if requirements exist and install if needed
if exist requirements.txt (
    echo 📦 Installing Python dependencies...
    pip install -r requirements.txt
)

REM Start the service
echo 📊 Graphiti service starting on http://localhost:8500
python main.py

pause