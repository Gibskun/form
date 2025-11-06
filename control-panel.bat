@echo off
title Form System Servers
color 0A
echo.
echo =====================================
echo   FORM SYSTEM CONTROL PANEL
echo =====================================
echo.
echo [1] Start Both Servers (Backend + Frontend)
echo [2] Start Backend Only
echo [3] Start Frontend Only  
echo [4] Initialize Database
echo [5] Install All Dependencies
echo [6] Exit
echo.
set /p choice="Choose an option (1-6): "

if %choice%==1 (
    echo.
    echo Starting both servers...
    npm start
) else if %choice%==2 (
    echo.
    echo Starting backend only...
    cd backend
    node server.js
) else if %choice%==3 (
    echo.
    echo Starting frontend only...
    cd frontend
    npm start
) else if %choice%==4 (
    echo.
    echo Initializing database...
    npm run init-db
) else if %choice%==5 (
    echo.
    echo Installing all dependencies...
    npm run install-all
) else if %choice%==6 (
    echo.
    echo Goodbye!
    exit
) else (
    echo.
    echo Invalid choice. Please try again.
    pause
    goto start
)

:start
pause