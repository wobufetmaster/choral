@echo off
REM Choral Installation Script for Windows
REM Checks for required dependencies and installs npm packages

echo.
echo 🎵 Choral Installation Script (Windows)
echo ==========================================
echo.
echo ⚠️  WARNING: This script is UNTESTED on Windows
echo    It should work but has not been verified on a Windows machine.
echo    Please report any issues at: https://github.com/wobufetmaster/choral/issues
echo.

setlocal enabledelayedexpansion

REM Track if any dependencies are missing
set MISSING_DEPS=0

REM Check for Node.js
echo Checking system dependencies...
echo.

where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo [✓] Node.js is installed: !NODE_VERSION!

    REM Check if version is at least 18
    for /f "tokens=1 delims=." %%a in ("!NODE_VERSION:~1!") do set NODE_MAJOR=%%a
    if !NODE_MAJOR! lss 18 (
        echo [⚠]  Warning: Node.js 18+ is recommended (you have v!NODE_MAJOR!)
    )
) else (
    echo [✗] Node.js is not installed
    echo    Please install Node.js from: https://nodejs.org/
    echo    Or use a version manager like nvm-windows: https://github.com/coreybutler/nvm-windows
    set MISSING_DEPS=1
)

REM Check for npm
where npm >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo [✓] npm is installed: v!NPM_VERSION!
) else (
    echo [✗] npm is not installed
    echo    npm usually comes with Node.js. Please reinstall Node.js.
    set MISSING_DEPS=1
)

REM Check for git (optional but recommended)
where git >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=1,2,3" %%a in ('git --version') do echo [✓] git is installed: %%a %%b %%c
) else (
    echo [⚠]  git is not installed (optional^)
    echo    Install git from: https://git-scm.com/
)

echo.

REM Exit if critical dependencies are missing
if %MISSING_DEPS% equ 1 (
    echo [❌] Installation cannot continue due to missing dependencies.
    echo Please install the required tools and run this script again.
    pause
    exit /b 1
)

echo Installing npm dependencies...
echo.

REM Check if node_modules exists
if exist "node_modules\" (
    echo [⚠]  node_modules directory already exists
    set /p REPLY="Do you want to reinstall dependencies? (y/N): "
    if /i "!REPLY!"=="y" (
        echo Removing existing node_modules...
        rmdir /s /q node_modules 2>nul
        del /q package-lock.json 2>nul
    ) else (
        echo Skipping npm install...
        echo.
        echo [✅] Installation complete!
        echo.
        echo To start Choral, run:
        echo   run.bat
        pause
        exit /b 0
    )
)

REM Install dependencies
call npm install

if %ERRORLEVEL% neq 0 (
    echo.
    echo [❌] npm install failed!
    echo Please check the error messages above and try again.
    pause
    exit /b 1
)

echo.
echo [✅] Installation complete!
echo.
echo Next steps:
echo   1. Configure your OpenRouter API key in config.json
echo   2. Run: run.bat
echo.
echo For more information, see README.md
echo.
pause
