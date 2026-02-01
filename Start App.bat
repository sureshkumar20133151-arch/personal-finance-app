@echo off
echo Starting FinTrack Personal Finance App...
echo.
echo Please wait while the server starts...
echo.
cd /d "%~dp0"
start "" "http://localhost:5173"
call npm run dev
pause
