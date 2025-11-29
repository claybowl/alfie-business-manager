@echo off
echo 📊 Killing all running services...

REM Kill processes on all relevant ports
echo Checking ports 3000, 8001, 8000, 8500, 39300...

for %%p in (5173 8001 8500 39300) do (
    for /f "tokens=1,2,3,4,5" %%i in ('netstat -ano ^| findstr ":%%p "') do (
        if not "%%i"=="" (
            echo Killing process on port %%p - PID: %%i
            taskkill /F /PID %%i >nul 2>&1
        )
    )
)

REM Kill stray node/npm/python processes
echo Cleaning up stray processes...
taskkill /F /IM "node.exe" /FI "WINDOWTITLE eq *server*" >nul 2>&1
taskkill /F /IM "node.exe" /FI "WINDOWTITLE eq *dev*" >nul 2>&1
taskkill /F /IM "python.exe" /FI "WINDOWTITLE eq *server*" >nul 2>&1

echo Waiting 2 seconds...
timeout /t 2 >nul

echo.
echo 🚀 Starting services with correct port configuration...

REM Start Graphiti service on port 8500
echo 📊 Starting Graphiti service ^(port 8500^)...
cd graphiti-service
if exist requirements.txt (
    echo Installing Graphiti dependencies...
    python -m pip install -r requirements.txt
)
start /B "Graphiti Service" cmd /c "python main.py"
cd ..

REM Start backend server on port 8001
echo 🔧 Starting backend server ^(port 8001^)...
cd backend
set BACKEND_PORT=8001
start /B "Backend Server" cmd /c "npm run dev"
cd ..

REM Start frontend on port 5173
echo ⚛ Starting frontend ^(port 5173^)...
start /B "Frontend" cmd /c "npm run dev"

echo.
echo ✅ All services started!
echo.
echo 📍 Service URLs:
echo    • Frontend: http://localhost:5173
echo    • Backend API: http://localhost:8001
echo    • Graphiti Service: http://localhost:8500
echo    • Pieces OS: http://localhost:39300
echo.
echo 📝 Check individual terminal windows for service logs
echo.
pause