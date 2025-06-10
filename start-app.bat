@echo off
echo ========================================
echo Starting PIO Help Desk Application
echo ========================================
echo.

echo [1/2] Starting Backend Server...
cd backend
start cmd /k "npx tsx src/server.ts"
timeout /t 3 /nobreak > nul

echo [2/2] Starting Frontend Server...
cd ../frontend  
start cmd /k "npm run dev"
timeout /t 3 /nobreak > nul

echo.
echo ========================================
echo Application is starting...
echo ========================================
echo.
echo Backend API: http://localhost:5000
echo Frontend UI: http://localhost:5173
echo.
echo Login with:
echo Username: admin
echo Password: Admin123!
echo.
echo Press any key to open the application in your browser...
pause > nul

start http://localhost:5173 