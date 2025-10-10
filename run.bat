@echo off
REM Choral Run Script for Windows
REM Starts the development server with proper checks and cleanup

echo.
echo 🎵 Starting Choral... (Windows)
echo.
echo ⚠️  WARNING: This script is UNTESTED on Windows
echo    It should work but has not been verified on a Windows machine.
echo    Please report any issues at: https://github.com/wobufetmaster/choral/issues
echo.

setlocal

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [✗] node_modules directory not found
    echo.
    echo Please run the installation script first:
    echo   install.bat
    echo.
    pause
    exit /b 1
)

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [✗] Node.js is not installed
    echo Please run install.bat to check dependencies
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [✗] npm is not installed
    echo Please run install.bat to check dependencies
    pause
    exit /b 1
)

REM Kill any existing node processes running the server
echo Checking for existing server processes...
taskkill /f /im node.exe >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [⚠]  Stopped existing node processes
    timeout /t 2 /nobreak >nul
)

REM Kill processes on port 3000 (Windows doesn't have lsof, so we use netstat)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo [⚠]  Port 3000 is in use, killing process...
    taskkill /f /pid %%a >nul 2>&1
    timeout /t 1 /nobreak >nul
)

REM Clear Vite cache to ensure fresh builds
if exist "node_modules\.vite\" (
    echo Clearing Vite cache...
    rmdir /s /q "node_modules\.vite" 2>nul
)

REM Check if config.json exists
if not exist "config.json" (
    echo [⚠]  config.json not found, server will use defaults
)

echo.
echo [✓] Starting Choral server...
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo Server will be available at:
echo   http://localhost:3000
echo.
echo Press Ctrl+C to stop
echo.

REM Start the server
call npm run dev

if %ERRORLEVEL% neq 0 (
    echo.
    echo [❌] Server failed to start!
    echo Please check the error messages above.
    pause
    exit /b 1
)
