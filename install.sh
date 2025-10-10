#!/bin/bash

# Choral Installation Script
# Checks for required dependencies and installs npm packages

set -e  # Exit on error

echo "🎵 Choral Installation Script"
echo "=============================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any dependencies are missing
MISSING_DEPS=0

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get version
get_version() {
    $1 2>&1 | head -n 1
}

echo "Checking system dependencies..."
echo ""

# Check for Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js is installed: $NODE_VERSION"

    # Check if version is at least 18
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo -e "${YELLOW}⚠${NC}  Warning: Node.js 18+ is recommended (you have v$NODE_MAJOR)"
    fi
else
    echo -e "${RED}✗${NC} Node.js is not installed"
    echo "  Please install Node.js from: https://nodejs.org/"
    echo "  Or use a version manager like nvm: https://github.com/nvm-sh/nvm"
    MISSING_DEPS=1
fi

# Check for npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓${NC} npm is installed: v$NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm is not installed"
    echo "  npm usually comes with Node.js. Please reinstall Node.js."
    MISSING_DEPS=1
fi

# Check for git (optional but recommended)
if command_exists git; then
    GIT_VERSION=$(git --version)
    echo -e "${GREEN}✓${NC} git is installed: $GIT_VERSION"
else
    echo -e "${YELLOW}⚠${NC}  git is not installed (optional)"
    echo "  Install git from: https://git-scm.com/"
fi

# Check for lsof (used by run.sh to check ports)
if command_exists lsof; then
    echo -e "${GREEN}✓${NC} lsof is installed (for port checking)"
else
    echo -e "${YELLOW}⚠${NC}  lsof is not installed (optional)"
    echo "  This is used to check if ports are in use. Install via your package manager."
fi

echo ""

# Exit if critical dependencies are missing
if [ $MISSING_DEPS -eq 1 ]; then
    echo -e "${RED}❌ Installation cannot continue due to missing dependencies.${NC}"
    echo "Please install the required tools and run this script again."
    exit 1
fi

echo "Installing npm dependencies..."
echo ""

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}⚠${NC}  node_modules directory already exists"
    read -p "Do you want to reinstall dependencies? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing existing node_modules..."
        rm -rf node_modules package-lock.json
    else
        echo "Skipping npm install..."
        echo ""
        echo -e "${GREEN}✅ Installation complete!${NC}"
        echo ""
        echo "To start Choral, run:"
        echo "  ./run.sh"
        exit 0
    fi
fi

# Install dependencies
npm install

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Configure your OpenRouter API key in config.json"
echo "  2. Run: ./run.sh"
echo ""
echo "For more information, see README.md"
