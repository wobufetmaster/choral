# Choral Installation Guide

Complete installation guide for all platforms (macOS, Linux, Termux, and Windows).

## Prerequisites

Before installing Choral, ensure you have the following installed:

- **Node.js 18+** (https://nodejs.org/)
- **npm** (comes with Node.js)
- **git** (optional, for cloning the repository)

---

## macOS / Linux Installation

### 1. Clone or Download

```bash
# If using git:
git clone https://github.com/wobufetmaster/choral.git
cd choral

# Or download and extract the ZIP file, then cd into the directory
```

### 2. Run Installation Script

The installation script will:
- Check for required dependencies (Node.js, npm)
- Verify versions are compatible
- Install all npm packages
- Guide you through any issues

```bash
./install.sh
```

If you get a permission error, make it executable first:
```bash
chmod +x install.sh run.sh
./install.sh
```

### 3. Configure (Optional)

Edit `config.json` to set your OpenRouter API key:

```json
{
  "port": 3000,
  "dataDir": "./data",
  "openRouterApiKey": "your-api-key-here",
  "activePreset": "default.json"
}
```

Alternatively, set the `OPENROUTER_API_KEY` environment variable:
```bash
export OPENROUTER_API_KEY=your_key_here
```

### 4. Start the Server

```bash
./run.sh
```

The server will be available at http://localhost:3000

---

## Termux (Android) Installation

Termux is a Linux terminal emulator for Android. Choral works great on mobile devices!

### 1. Install Termux

Download from [F-Droid](https://f-droid.org/packages/com.termux/) (recommended) or [GitHub](https://github.com/termux/termux-app/releases).

**⚠️ Do NOT install from Google Play Store** - it's an outdated version.

### 2. Setup Termux

```bash
# Update packages
pkg update && pkg upgrade

# Install required packages
pkg install nodejs git

# Verify installation
node --version
npm --version
```

### 3. Clone and Install Choral

```bash
# Clone the repository
git clone https://github.com/wobufetmaster/choral.git
cd choral

# Run installation script
chmod +x install.sh run.sh
./install.sh
```

### 4. Configure API Key

```bash
# Edit config.json (use nano or vim)
nano config.json

# Or set environment variable
export OPENROUTER_API_KEY=your_key_here
```

### 5. Start the Server

```bash
./run.sh
```

Open http://localhost:3000 in your mobile browser!

### Termux Tips

- **Wake Lock**: Use Termux:Wake to keep Choral running in the background
- **Storage Access**: Run `termux-setup-storage` to access device storage
- **Port Already in Use**: The run script automatically kills port 3000 processes
- **Low Memory**: Termux may kill background processes. Consider using a wake lock app.

---

## Windows Installation (UNTESTED)

⚠️ **Important:** The Windows scripts are **UNTESTED** as we don't have a Windows machine for testing. They should work based on standard Windows batch scripting, but please report any issues on [GitHub](https://github.com/wobufetmaster/choral/issues).

### 1. Install Prerequisites

1. **Install Node.js**:
   - Download from https://nodejs.org/ (LTS version recommended)
   - Run the installer and follow the prompts
   - Ensure "Add to PATH" is checked

2. **Install Git** (optional):
   - Download from https://git-scm.com/download/win
   - Run the installer with default settings

### 2. Clone or Download

**Using Git:**
```batch
git clone https://github.com/wobufetmaster/choral.git
cd choral
```

**Or download ZIP:**
1. Download the ZIP from GitHub
2. Extract to a folder
3. Open Command Prompt or PowerShell
4. Navigate to the folder: `cd path\to\choral`

### 3. Run Installation Script

```batch
install.bat
```

The script will:
- Check for Node.js and npm
- Verify versions are compatible
- Install npm packages
- Guide you through any issues

### 4. Configure API Key

Edit `config.json` in a text editor:

```json
{
  "port": 3000,
  "dataDir": "./data",
  "openRouterApiKey": "your-api-key-here",
  "activePreset": "default.json"
}
```

Or set an environment variable:
```batch
set OPENROUTER_API_KEY=your_key_here
```

To make it permanent:
```batch
setx OPENROUTER_API_KEY "your_key_here"
```

### 5. Start the Server

```batch
run.bat
```

The server will be available at http://localhost:3000

### Windows Troubleshooting

**Script Execution Policy (PowerShell):**
If you get an error about script execution, run PowerShell as Administrator:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Port Already in Use:**
The run script attempts to kill processes on port 3000, but if it fails:
```batch
netstat -ano | findstr :3000
taskkill /F /PID <PID_NUMBER>
```

**Node Not Found:**
Ensure Node.js is in your PATH. Restart Command Prompt after installing Node.js.

---

## Troubleshooting (All Platforms)

### "node_modules directory not found"
Run the installation script first (`./install.sh` on macOS/Linux/Termux or `install.bat` on Windows).

### "Node.js is not installed"

**macOS/Linux:**
Install Node.js from https://nodejs.org/ or use nvm:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

**Termux:**
```bash
pkg install nodejs
```

**Windows:**
Download and install from https://nodejs.org/ (LTS version recommended)

### "Port 3000 is in use"

**macOS/Linux/Termux:**
The `run.sh` script automatically kills processes on port 3000. If issues persist:
```bash
lsof -ti:3000 | xargs kill -9
```

**Windows:**
The `run.bat` script attempts to kill port 3000 processes. If it fails:
```batch
netstat -ano | findstr :3000
taskkill /F /PID <PID_NUMBER>
```

### Permission Errors

**macOS/Linux/Termux:**
Make scripts executable:
```bash
chmod +x install.sh run.sh
```

**Windows:**
Not applicable - `.bat` files are executable by default.

---

## Manual Installation (All Platforms)

If you prefer to install manually without using the installation scripts:

```bash
# Install dependencies
npm install

# Start the server
npm run dev
```

This works identically on all platforms (macOS, Linux, Termux, and Windows).

## Development Commands

```bash
# Run both frontend and backend (recommended)
npm run dev

# Run backend only
npm run dev:server

# Run frontend only
npm run dev:client

# Build for production
npm run build

# Run production server
npm run server
```

## What Gets Installed

The installation creates:
- `node_modules/` - NPM dependencies
- `data/` - User data directory (created on first run)
  - `characters/` - Character card PNG files
  - `chats/` - Chat history JSON files
  - `lorebooks/` - Lorebook JSON files
  - `personas/` - Persona JSON files
  - `presets/` - Preset JSON files
- `logs/` - Debug logs (created on first run)

## Next Steps

After installation:
1. Import character cards via the UI
2. Configure presets for different AI models
3. Start chatting!

See [README.md](README.md) for full documentation.
