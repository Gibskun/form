@echo off
echo =====================================
echo  Multi-User Form System Startup
echo =====================================
echo.
echo [1/3] Installing dependencies...
call npm run install-all

if %errorlevel% neq 0 (
    echo.
    echo ❌ Failed to install dependencies
    echo Please check your internet connection and try again
    pause
    exit /b 1
)

echo.
echo [2/3] Starting servers...
echo 🔄 Backend will run on: http://localhost:5000
echo 🔄 Frontend will run on: http://localhost:3000
echo 👤 Admin login: http://localhost:3000/admin
echo.
echo Default admin credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo [3/3] Launching application...
echo ⏳ Please wait while servers start up...
echo.

npm start