# Choral

A lightweight, drop-in replacement for SillyTavern. Choral is a Vue 3 + Express application for chatting with AI characters using Character Card V3 format.

📖 **[Full Documentation](docs/index.html)** - Complete guides, tutorials, and API reference

## Features

### ✅ Implemented
- **Character Card V3 Support**: Full V3 spec compliance with PNG embedding and V2 backward compatibility
- **Streaming Chat**: Real-time streaming responses via Server-Sent Events
- **OpenRouter Integration**: Use any OpenRouter-compatible model
- **Preset System**: Configurable model settings, system prompts, and prompt post-processing (6 modes)
- **Macro System**: Curly-brace syntax (CBS) for dynamic text replacement
- **Chat Management**: Save, load, edit, and delete conversations
- **Lorebook System**: Import SillyTavern lorebooks with keyword/regex matching
- **Group Chats**: Multi-character conversations with character selection
- **Persona Manager**: Create and manage user personas
- **Message Editing**: Edit, delete, and regenerate messages
- **HTML Rendering**: Sandboxed DOMPurify rendering for rich content
- **Clean UI**: Responsive Vue 3 interface with theming support
- **Debug Logging**: JSON-formatted API request/response logs
- **PWA Support**: Install as a progressive web app on mobile and desktop
- **Tab System**: Multiple chat tabs (desktop)

### 🚧 Planned
- **Chat Branching**: Explore different conversation paths with tree view
- **Split View**: Side-by-side panels for chat + character editor

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Installation

**Automated Installation (Recommended):**

Choose the installation script for your platform:

**macOS/Linux/Termux:**
```bash
# Clone the repository
git clone https://github.com/wobufetmaster/choral.git
cd choral

# Run the installation script
./install.sh

# Configure your API key (edit config.json)
# OR set environment variable
export OPENROUTER_API_KEY=your_key_here

# Start the server
./run.sh
```

**Windows (UNTESTED):**
```batch
REM Clone the repository
git clone https://github.com/wobufetmaster/choral.git
cd choral

REM Run the installation script
install.bat

REM Configure your API key (edit config.json)
REM OR set environment variable: set OPENROUTER_API_KEY=your_key_here

REM Start the server
run.bat
```

⚠️ **Note:** The Windows scripts (`install.bat` and `run.bat`) are untested as we don't have a Windows machine for testing. They should work based on Windows batch scripting standards, but please report any issues on GitHub.

The installation script will:
- Check for required dependencies (Node.js, npm, etc.)
- Verify versions are compatible
- Install all npm packages
- Guide you through any issues

**Manual Installation (All Platforms):**

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

This will start:
- Express API server on http://localhost:3000
- Vite dev server on http://localhost:5173

Open http://localhost:5173 in your browser to use Choral.

📖 See [INSTALL.md](INSTALL.md) for detailed platform-specific installation instructions and troubleshooting.

### Installing as a PWA

Choral can be installed as a Progressive Web App for a native app experience:

**Desktop (Chrome/Edge):**
1. Open Choral in your browser
2. Click the install icon in the address bar (or menu → "Install Choral")
3. Confirm installation

**Android (Chrome):**
1. Open Choral in Chrome
2. Tap the menu (⋮) → "Add to Home screen" or "Install app"
3. Confirm installation

**iOS (Safari):**
1. Open Choral in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Confirm installation

Once installed, Choral will:
- Launch in its own window/app
- Work offline for previously loaded content
- Cache assets for faster loading
- Appear in your app drawer/home screen

**Note:** Firefox on Android may have issues with PWA installation. Use Chrome for best results.

### Production Build

```bash
# Build the frontend
npm run build

# Run the production server
npm run server
```

The production server serves the built frontend and API on http://localhost:3000.

## Configuration

Edit `config.json` to customize:

```json
{
  "port": 3000,
  "dataDir": "./data",
  "openRouterApiKey": "",
  "activePreset": "default.json"
}
```

## Data Storage

User data is stored in the `data/` directory:

```
data/
  characters/   # Character card PNG files
  chats/        # Chat history JSON files
  group_chats/  # Group chat JSON files
  lorebooks/    # Lorebook JSON files
  personas/     # Persona JSON files
  presets/      # Model/prompt presets
  tags.json     # Character tags
```

### Synchronizing Data with Syncthing

Choral officially supports **Syncthing** for synchronizing your data across multiple devices. This is ideal for running Choral on both desktop and Termux (Android).

**Quick Setup (Termux):**

```bash
# Install Syncthing
pkg install syncthing

# Start Syncthing (it will run in the background)
syncthing &

# Open the web UI (displayed in terminal output)
# Default: http://127.0.0.1:8384
```

**Configure Folder Sharing:**

1. Open the Syncthing web UI on both devices
2. On each device, add the `data/` folder from your Choral installation
   - Folder path: `/path/to/choral/data` (or `/data/data/com.termux/files/home/choral/data` on Termux)
   - Folder ID: `choral_data` (use the same ID on all devices)
3. In the Syncthing UI, go to "Actions" → "Show ID" to get your device ID
4. On each device, add the other device using its device ID
5. Accept the folder share request on each device

**Optional: Git Hook for Auto-Sync**

If you already have a `sync_data.sh` script, you can set it up as a git hook to ensure data is synced before/after git operations:

```bash
# Make the script executable
chmod +x sync_data.sh

# Set up as a pre-pull hook
echo '#!/bin/bash' > .git/hooks/pre-pull
echo './sync_data.sh' >> .git/hooks/pre-pull
chmod +x .git/hooks/pre-pull

# Set up as a post-pull hook
echo '#!/bin/bash' > .git/hooks/post-checkout
echo './sync_data.sh' >> .git/hooks/post-checkout
chmod +x .git/hooks/post-checkout
```

**Important Notes:**

- The `data/` directory is excluded from git (via `.gitignore`)
- Syncthing conflict files and versioning directories are automatically ignored by git
- If you see "sync conflict" files, they can be safely deleted after reviewing which version to keep
- File versioning is handled by Syncthing's `.stversions/` directory

📖 For detailed setup instructions, troubleshooting, and advanced configuration, see [docs/syncthing.html](docs/syncthing.html)

## Character Cards

Choral supports Character Card V3 format:
- Import V3/V2 cards via drag-and-drop or file picker
- Character cards are stored as PNG files with embedded JSON
- Supports all V3 fields including lorebooks, alternate greetings, and decorators

## Lorebooks

Import SillyTavern-compatible lorebooks:
- Keyword and regex matching
- Entry priority and scan depth
- Constant entries (always included)
- Import via Lorebook Manager UI

## Presets

Presets control model behavior and prompt formatting:
- Model settings (temperature, top_p, max_tokens, etc.)
- System prompts with injection order
- Prompt post-processing modes:
  - `merge_system`: Combine all system messages (default)
  - `semi_strict`: One system message + alternating user/assistant
  - `strict`: User first, strict alternation, no system
  - `single_user`: Everything in one user message
  - `anthropic_prefill`: Semi-strict with prefill support
  - `none`: No processing
- Import PixiJB configs

## Macros

Supported macros (curly-brace syntax):
- `{{char}}` - Character name
- `{{user}}` - User/persona name
- `{{random:A,B,C}}` - Random choice
- `{{pick:A,B,C}}` - Consistent random (cached)
- `{{roll:N}}` / `{{roll:dN}}` - Random number
- `{{reverse:text}}` - Reverse text
- `{{// comment}}` - Hidden comment
- `{{hidden_key:text}}` - Hidden lorebook key
- `{{comment: text}}` - Visible comment

## Development

### Project Structure

```
choral/
  server/                # Express backend
    index.js             # Main server with all API routes
    characterCard.js     # PNG V3 card reader/writer
    openrouter.js        # OpenRouter streaming/non-streaming
    macros.js            # Macro/CBS processing
    presets.js           # Preset management & PixiJB import
    promptProcessor.js   # Prompt post-processing (6 modes)
    logger.js            # API request/response logging
  src/                   # Vue 3 frontend
    main.js              # Vue app entry
    App.vue              # Root component with theming
    components/          # Vue components
  data/                  # User data (gitignored)
  logs/                  # Debug logs (gitignored)
  config.json            # User config (gitignored)
```

### Available Scripts

```bash
npm run dev        # Run both servers concurrently
npm run dev:server # Run Express server only
npm run dev:client # Run Vite dev server only
npm run build      # Build frontend for production
npm run server     # Run production server
```

### API Endpoints

**Characters:**
- `GET /api/characters` - List all characters
- `GET /api/characters/:filename` - Get specific character
- `POST /api/characters` - Upload/create character
- `DELETE /api/characters/:filename` - Delete character

**Chats:**
- `GET /api/chats` - List all chats
- `GET /api/chats/:filename` - Get specific chat
- `POST /api/chats` - Save chat
- `DELETE /api/chats/:filename` - Delete chat

**Group Chats:**
- `GET /api/group-chats` - List all group chats
- `GET /api/group-chats/:filename` - Get specific group chat
- `POST /api/group-chats` - Save group chat
- `DELETE /api/group-chats/:filename` - Delete group chat

**Lorebooks:**
- `GET /api/lorebooks` - List all lorebooks
- `GET /api/lorebooks/:filename` - Get specific lorebook
- `POST /api/lorebooks` - Save lorebook
- `POST /api/lorebooks/import` - Import lorebook
- `DELETE /api/lorebooks/:filename` - Delete lorebook

**Presets:**
- `GET /api/presets` - List all presets
- `GET /api/presets/:filename` - Get specific preset
- `POST /api/presets` - Save preset
- `POST /api/presets/import/pixijb` - Import PixiJB config
- `DELETE /api/presets/:filename` - Delete preset

**Chat:**
- `POST /api/chat/stream` - Streaming chat (SSE)
- `POST /api/chat` - Non-streaming chat

**Config:**
- `GET /api/config` - Get sanitized config
- `POST /api/config/active-preset` - Set active preset

## Testing

Choral has comprehensive test coverage across unit, integration, and end-to-end tests.

### Quick Start
```bash
npm test              # Run unit + integration tests
npm run test:e2e     # Run E2E tests
npm run test:all     # Run everything
```

See [docs/testing.md](docs/testing.md) for detailed testing documentation.

### Pre-commit Hooks
Tests automatically run before each commit to prevent regressions.

## License

MIT License - see [LICENSE](LICENSE) for details
