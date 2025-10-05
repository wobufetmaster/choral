#!/bin/bash

# Kill any existing node processes running the server
echo "Checking for existing server processes..."
pkill -f "node server/index.js" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null

# Wait a moment for processes to terminate
sleep 1

# Check if port 3000 is still in use and kill that process
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "Port 3000 is in use, killing process..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    sleep 1
fi

echo "Starting Choral server..."
npm run dev
