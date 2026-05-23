@echo off
echo ============================================
echo Starting DR Screening System
echo ============================================
echo.

echo [1/2] Starting AI Service on port 8000...
cd /d "C:\Users\DELL\diabetic-retinopathy\ai-service"
start "AI-Service" /min cmd /c "C:\Users\DELL\diabetic-retinopathy\.venv\Scripts\python.exe main.py"
timeout /t 10 /nobreak > nul

echo [2/2] Starting Backend Server on port 3000...
cd /d "C:\Users\DELL\diabetic-retinopathy\backend"
start "Backend" /min cmd /c "node src/server.js"
timeout /t 3 /nobreak > nul

echo.
echo ============================================
echo All services started!
echo ============================================
echo.
echo AI Service:    http://localhost:8000
echo Backend:       http://localhost:3000
echo.
echo Login URLs:
echo   Admin:  http://localhost:3000/login
echo.
echo Credentials:
echo   Admin:  admin@centre-ophtalmo.fr / admin123
echo   Doctor: dr.martin@centre-ophtalmo.fr / doctor123
echo.
pause