#!/bin/bash

# Choral Run Script
# Starts the development server with proper checks and cleanup

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎵 Starting Choral...${NC}"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${RED}✗${NC} node_modules directory not found"
    echo ""
    echo "Please run the installation script first:"
    echo -e "  ${GREEN}./install.sh${NC}"
    echo ""
    exit 1
fi

# Check if Node.js is installed
if ! command_exists node; then
    echo -e "${RED}✗${NC} Node.js is not installed"
    echo "Please run ./install.sh to check dependencies"
    exit 1
fi

# Check if npm is installed
if ! command_exists npm; then
    echo -e "${RED}✗${NC} npm is not installed"
    echo "Please run ./install.sh to check dependencies"
    exit 1
fi

# Kill any existing node processes running the server
echo "Checking for existing server processes..."
pkill -f "node server/index.js" 2>/dev/null && echo -e "${YELLOW}⚠${NC}  Stopped existing server process" || true
pkill -f "npm run dev" 2>/dev/null && echo -e "${YELLOW}⚠${NC}  Stopped existing dev process" || true

# Wait a moment for processes to terminate
sleep 1

# Check if port 3000 is still in use and kill that process
if command_exists lsof; then
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠${NC}  Port 3000 is in use, killing process..."
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
else
    echo -e "${YELLOW}⚠${NC}  lsof not available, cannot check port 3000"
fi

# Clear Vite cache to ensure fresh builds
if [ -d "node_modules/.vite" ]; then
    echo "Clearing Vite cache..."
    rm -rf node_modules/.vite 2>/dev/null || true
fi

# Check if config.json exists
if [ ! -f "config.json" ]; then
    echo -e "${YELLOW}⚠${NC}  config.json not found, server will use defaults"
fi

echo ""
echo -e "${GREEN}✓${NC} Starting Choral server..."
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Server will be available at:"
echo -e "  ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "Press ${RED}Ctrl+C${NC} to stop"
echo ""

# Start the server
npm run dev
