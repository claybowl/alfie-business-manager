@echo off
echo 🛑 Stopping all Alfie services...

REM Kill processes on all relevant ports
echo 📊 Checking ports 3000, 8000, 8001, 8500, 39300...

for %%p in (3000 8000 8001 8500 39300) do (
    for /f "tokens=1,2,3,4,5" %%i in ('netstat -ano ^| findstr ":%%p "') do (
        if not "%%i"=="" (
            echo Killing process on port %%p - PID: %%i
            taskkill /F /PID %%i >nul 2>&1
        )
    )
)

REM Kill stray node/npm/python processes
echo 🧹 Cleaning up stray processes...
taskkill /F /IM "node.exe" /FI "WINDOWTITLE eq *server*" >nul 2>&1
taskkill /F /IM "node.exe" /FI "WINDOWTITLE eq *dev*" >nul 2>&1
taskkill /F /IM "python.exe" /FI "WINDOWTITLE eq *server*" >nul 2>&1

echo ✅ All services stopped!
echo.
echo 📊 Port Status:
for %%p in (3000 8001 8500 39300) do (
    netstat -ano ^| findstr ":%%p " >nul
    if errorlevel 1 (
        echo    • Port %%p: ✅ FREE
    ) else (
        echo    • Port %%p: ❌ OCCUPIED
    )
)
echo.
pause