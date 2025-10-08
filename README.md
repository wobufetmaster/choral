# Choral

A lightweight, drop-in replacement for SillyTavern. Choral is a Vue 3 + Express application for chatting with AI characters using Character Card V3 format.

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

### 🚧 Planned
- **Chat Branching**: Explore different conversation paths with tree view
- **Split View**: Side-by-side panels for chat + character editor
- **PWA Support**: Install as a progressive web app
- **Tab System**: Multiple chat tabs (desktop)

## Quick Start

### Prerequisites

- Node.js 16+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/wobufetmaster/choral.git
cd choral

# Install dependencies
npm install

# Configure your API key
# Copy the example config
cp config.example.json config.json

# Edit config.json and add your OpenRouter API key
# OR set environment variable
export OPENROUTER_API_KEY=your_key_here

# Start the development server
npm run dev
```

This will start:
- Express API server on http://localhost:3000
- Vite dev server on http://localhost:5173

Open http://localhost:5173 in your browser to use Choral.

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

You can sync this directory across devices using Syncthing, Dropbox, or similar tools.

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

## License

ISC
