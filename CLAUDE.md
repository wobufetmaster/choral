# Choral - Development Summary

A lightweight, drop-in replacement for SillyTavern built with Vue 3 + Vite frontend and Express backend.

## Project Structure

```
choral/
├── server/                      # Express backend
│   ├── index.js                # Main server with all API routes
│   ├── characterCard.js        # PNG character card V3 reader/writer
│   ├── openrouter.js           # OpenRouter API integration (streaming + non-streaming)
│   ├── macros.js               # Macro/CBS processing (server-side)
│   ├── presets.js              # Preset management and PixiJB conversion
│   ├── promptProcessor.js      # Prompt post-processing (6 modes)
│   └── logger.js               # API request/response logging
│
├── src/                        # Vue frontend
│   ├── main.js                 # Vue app entry point
│   ├── App.vue                 # Root component with theming
│   ├── components/
│   │   ├── CharacterList.vue   # Character browser with search
│   │   ├── ChatView.vue        # Main chat interface with streaming
│   │   └── PresetSelector.vue  # Preset manager and editor
│   └── utils/
│       └── macros.js           # Macro/CBS processing (client-side)
│
├── data/                       # User data storage
│   ├── characters/             # Character card PNG files
│   ├── chats/                  # Chat history JSON files
│   ├── lorebooks/              # Lorebook JSON files
│   ├── personas/               # Persona JSON files
│   └── presets/                # Preset JSON files
│
├── logs/                       # Debug logs
│   └── api-requests.log        # JSON-formatted API logs (VSCode collapsible)
│
├── config.json                 # Server configuration
├── icon.png                    # Browser favicon
├── vite.config.js             # Vite configuration
├── package.json               # Dependencies and scripts
└── README.md                  # User documentation
```

## ✅ Completed Features

### Core Infrastructure
- **Express Backend**: REST API with file-based storage
- **Vue 3 Frontend**: Reactive UI with Vue Router
- **Vite Dev Server**: Hot module replacement, proxies API to backend
- **Concurrent Dev Mode**: `npm run dev` runs both servers simultaneously
- **Configuration**: JSON-based config with environment variable support

### Character Management
- **Character Card V3 Support**: Full spec compliance
  - PNG reading/writing with proper tEXt chunk extraction
  - V2 backward compatibility (chara chunk)
  - Automatic unique filename generation for duplicates
- **Character Import**: Drag-and-drop or file picker
- **Character Browser**: Grid view with search by name/tags
- **Character Storage**: PNG files in `data/characters/`

### Chat System
- **OpenRouter Integration**:
  - Streaming chat completions (SSE)
  - Non-streaming option
  - Configurable model and parameters
- **Chat Interface**:
  - Real-time streaming display
  - Message editing and deletion
  - HTML rendering with DOMPurify sanitization
  - User/assistant message distinction
- **Chat Persistence**: Save/load chats as JSON
- **Context Building**: System prompt + character info + message history

### Macro System (Curly Braced Syntax)
- **Supported Macros** (V3 spec compliant):
  - `{{char}}` - Character name/nickname
  - `{{user}}` - User/persona name
  - `{{random:A,B,C}}` - Random choice
  - `{{pick:A,B,C}}` - Consistent random (cached)
  - `{{roll:N}}` / `{{roll:dN}}` - Random number
  - `{{reverse:text}}` - Reverse text
  - `{{// comment}}` - Hidden comment
  - `{{hidden_key:text}}` - Hidden lorebook key
  - `{{comment: text}}` - Visible comment
- **Processing**:
  - Server-side: Before sending to AI
  - Client-side: For display in UI
  - Context-aware (character name, user name)

### Preset System
- **Preset Management**:
  - Create, edit, delete presets
  - Model settings (temperature, top_p, top_k, max_tokens, etc.)
  - System prompts array with injection order
  - Active preset auto-applies to all new chats
  - Template placeholder support ({{description}}, {{personality}}, etc.)
- **Prompt Post-Processing**: 6 modes for API compatibility
  - `merge_system` (default): All system messages merged into one
  - `semi_strict`: One system message, then alternating user/assistant
  - `strict`: User first, strict alternation, no system messages
  - `single_user`: Everything in one giant user message
  - `anthropic_prefill`: Semi-strict with assistant prefill support
  - `none`: No processing
- **PixiJB Import**: Convert SillyTavern configs to Choral presets
- **Preset Storage**: JSON files in `data/presets/`
- **UI**:
  - Preset selector/editor modal
  - Live editing with parameter controls
  - System prompt management with injection order
  - Prompt processing mode dropdown
  - Import button for external configs

### Debug & Logging
- **API Request/Response Logger**:
  - All LLM requests logged to `logs/api-requests.log`
  - JSON format for VSCode collapsibility
  - Logs model, messages, options, context, processing mode
  - Console output with truncated preview
  - Stream chunks accumulated in final response (not logged individually)

### Image Support
- **Multimodal Messages**: Send and receive images with OpenRouter API
- **Image Attachment Modal**: Upload or paste images with preview
- **Inline Display**: Images shown at full width in chat messages
- **AI Image Generation**: Support for models that generate images
- **Base64 Storage**: Images embedded in chat JSON files
- **Format Support**: JPG, PNG, WebP, GIF
- **Backward Compatible**: Existing text-only chats work unchanged

### UI/UX
- **Theming**: Dark theme (light theme ready)
- **Responsive Design**: CSS variables for easy theming
- **Settings Panel**: Model and parameter configuration
- **Router**: Navigation between character list and chat
- **Clean Interface**: Minimalist, focused on functionality
- **Favicon**: Custom icon.png displayed in browser tab

## API Endpoints Reference

### Characters
- `GET /api/characters` - List all characters
- `GET /api/characters/:filename` - Get specific character
- `POST /api/characters` - Upload/create character (multipart or JSON)
- `DELETE /api/characters/:filename` - Delete character

### Chats
- `GET /api/chats` - List all chats
- `GET /api/chats/:filename` - Get specific chat
- `POST /api/chats` - Save chat
- `DELETE /api/chats/:filename` - Delete chat

### Personas
- `GET /api/personas` - List all personas
- `POST /api/personas` - Save persona

### Lorebooks
- `GET /api/lorebooks` - List all lorebooks
- `POST /api/lorebooks` - Save lorebook

### Presets
- `GET /api/presets` - List all presets
- `GET /api/presets/:filename` - Get specific preset
- `POST /api/presets` - Save/create preset
- `DELETE /api/presets/:filename` - Delete preset
- `POST /api/presets/import/pixijb` - Import PixiJB config

### Chat Completion
- `POST /api/chat/stream` - Streaming chat (SSE)
- `POST /api/chat` - Non-streaming chat

### Config
- `GET /api/config` - Get config (sanitized)
- `POST /api/config/active-preset` - Set active preset

## Key Implementation Notes

### Character Card Reading
- Custom PNG tEXt chunk parser (pngjs metadata doesn't work reliably)
- Supports both `ccv3` and `chara` (V2) chunks
- Base64 UTF-8 encoding as per spec

### Macro Processing
- Two-stage: server (for AI) and client (for display)
- Pick cache maintains consistency per session
- Case-insensitive matching
- Comments shown differently in UI vs removed in prompts

### Preset System
- Separates model settings from prompt configuration
- Supports reusing prompts with different models
- Injection order controls prompt assembly
- PixiJB conversion simplifies/normalizes fields

### Streaming Implementation
- Server-Sent Events (SSE) for real-time updates
- Chunked reading with buffer management
- Graceful error handling
- Progress indication in UI

### Prompt Post-Processing
- Six processing modes in `/server/promptProcessor.js`:
  - **merge_system**: Combines all system messages into one (default)
  - **semi_strict**: One system message followed by alternating user/assistant
  - **strict**: User message first, strict alternation, no system messages
  - **single_user**: All messages combined into one user message with role labels
  - **anthropic_prefill**: Semi-strict mode with assistant prefill support
  - **none**: No processing, messages sent as-is
- Applied before sending to OpenRouter API
- Configurable per-preset via dropdown in PresetSelector

### Debug Logging
- Located in `/server/logger.js`
- Logs written to `logs/api-requests.log`
- JSON format for easy parsing and VSCode collapsibility
- Each log entry includes:
  - Request: timestamp, model, options, context, messages array, prompt processing mode
  - Response: timestamp, content length, full content, any errors
- Console output shows truncated preview for quick debugging
- Stream chunks are accumulated and logged only in final response
- Base64 image data is truncated in logs (first 50 chars) to maintain readability

### Image Support Implementation
- **Message Format**: Uses OpenRouter multimodal content array format
  - `{ type: 'text', text: '...' }` for text content
  - `{ type: 'image_url', image_url: { url: 'data:image/...' } }` for images
- **Storage**: Images stored as base64 data URLs in chat JSON
- **Normalization**: Server automatically converts legacy string content to array format
- **Macro Processing**: Only processes text parts, leaves image_url parts unchanged
- **Display**: Vue component handles both string (legacy) and array (multimodal) content
- **AI Generation**: Assistant messages can include separate `images` field for generated images
- **File Validation**: Client-side validation for supported MIME types
- **Size Warnings**: User notified if total attachment size exceeds 5MB

### Browser Debugging (MCP Extensions)

#### browser-tools MCP extension
- Available for passive frontend debugging
- Tools:
  - `getConsoleLogs` - Retrieve browser console logs
  - `getConsoleErrors` - Retrieve browser console errors
  - `getNetworkErrors` - Retrieve network errors
  - `getNetworkLogs` - Retrieve all network activity
  - `takeScreenshot` - Capture current browser state
  - `runAccessibilityAudit` - Check accessibility issues
  - `runPerformanceAudit` - Analyze performance
  - `runSEOAudit` - Check SEO compliance
  - `wipeLogs` - Clear all captured logs from memory
- Useful for debugging Vue component issues, API calls, and UI behavior

#### Playwright MCP extension
- **Interactive browser automation** for testing and debugging
- Can navigate, click, fill forms, and interact with the UI
- Core navigation tools:
  - `browser_navigate` - Navigate to a URL
  - `browser_navigate_back` - Go back to previous page
  - `browser_snapshot` - Get accessibility tree snapshot (better than screenshot for actions)
  - `browser_take_screenshot` - Take visual screenshot (PNG/JPEG)
  - `browser_close` - Close the current page/tab
- Interaction tools:
  - `browser_click` - Click elements (requires element description and ref from snapshot)
  - `browser_type` - Type text into fields
  - `browser_fill_form` - Fill multiple form fields at once
  - `browser_select_option` - Select dropdown options
  - `browser_hover` - Hover over elements
  - `browser_drag` - Drag and drop between elements
  - `browser_press_key` - Press keyboard keys
- Inspection tools:
  - `browser_evaluate` - Run JavaScript in browser context
  - `browser_console_messages` - Get console output
  - `browser_network_requests` - View all network requests
- Usage pattern:
  1. Navigate to the page: `browser_navigate(url: "http://localhost:5173")`
  2. Get page state: `browser_snapshot()` returns element refs
  3. Interact: `browser_click(element: "Settings button", ref: "e22")`
  4. Verify: `browser_evaluate()` to check DOM state or `browser_take_screenshot()`
- Screenshots saved to `.playwright-mcp/` directory
- Example workflow: Testing the theme switcher
  ```
  1. browser_navigate("http://localhost:5173")
  2. browser_snapshot() → find Settings button ref
  3. browser_click(element: "Settings", ref: "e22")
  4. browser_select_option(element: "Theme dropdown", ref: "e137", values: ["Midnight Library"])
  5. browser_take_screenshot(filename: "theme-test.png")
  ```
- **Common Issues & Solutions**:
  - **"Browser is already in use" error**: If you get an error about the browser already being in use, use `browser_close()` first, or add the `--isolated` flag to the Playwright MCP configuration to run with an in-memory profile
  - **Configuration**: Can be customized with flags in MCP config (e.g., `--isolated`, `--headless`, `--viewport-size`, `--browser chrome`)
  - **Persistent vs Isolated**: By default uses a persistent profile (saves login state). Use `--isolated` flag for ephemeral sessions
- Complements server-side logging for full-stack debugging

## Development Commands

```bash
# Install dependencies
npm install

# Development (runs both servers)
npm run dev

# Run servers separately
npm run dev:server  # Express only
npm run dev:client  # Vite only

# Production build
npm run build
npm run server
```

## Configuration

Edit `config.json`:
```json
{
  "port": 3000,
  "dataDir": "./data",
  "openRouterApiKey": "",  // or use OPENROUTER_API_KEY env var
  "activePreset": "default.json"  // auto-applies to all new chats
}
```

## Data Synchronization with Syncthing

Choral officially supports **Syncthing** as a method to synchronize user data across multiple devices. This is particularly useful for:
- Running Choral on Termux (Android) and syncing with a desktop instance
- Keeping characters, chats, lorebooks, and personas synchronized
- Automatic conflict resolution with versioning

### How It Works
- The `data/` directory contains all user-created content
- Syncthing monitors and syncs this directory across devices
- Git ignores Syncthing-specific files (`.stfolder/`, `.stversions/`, conflict files)
- A `sync_data.sh` hook script can be used to ensure sync integrity before/after git operations

### Setup on Termux
See the README.md and docs/syncthing.html for detailed setup instructions including:
- Installing Syncthing on Termux
- Configuring folder sharing between devices
- Setting up git hooks for automatic syncing
- Troubleshooting common issues

### Repository Configuration
The repository is configured to prevent conflicts between git and Syncthing:
- `.gitignore` excludes all Syncthing metadata (`.stfolder/`, `.stversions/`)
- `.gitignore` excludes sync conflict files (`*.sync-conflict-*`)
- `.gitignore` excludes user data and settings files
- Only default/example files are tracked in git (e.g., `Default-chan.png`, `default.json`)
- Git is configured to use `pull.rebase = true` for cleaner history

## Current Project Status

### ✅ Recently Completed
- **Image Support**: Full multimodal message support with upload and paste
- **AI Image Generation**: Display images generated by AI models
- **Prompt Post-Processing System**: All 6 modes implemented and tested
- **Active Preset System**: Auto-applies saved preset to new chats
- **Debug Logging**: Comprehensive JSON logging with VSCode collapsibility
- **Template Placeholders**: Presets support {{description}}, {{personality}}, etc.
- **UI Polish**: Favicon, improved preset editor with processing mode dropdown

### 🔧 Working System
The core chat system is fully functional:
- Character cards load and display correctly
- Presets apply system prompts with proper injection order
- Macros process on both server and client side
- Messages are post-processed according to selected mode
- API requests are logged for debugging
- Streaming responses work smoothly

### 🎯 Next Priorities
1. ** UI improvements**
2. **Chat Branching**: Tree-based conversation navigation


---

Note: The server can be started with ./run.sh, but the user is probably running that in another terminal, so if you need to restart the server, just ask them.

If you need images, there is a stable diffusion endpoint running on a remote server, you can access it like: http://192.168.1.100:3000/generate/background_hq/forest,lake,beautiful,autumn,leaves and it will return an image, there is also an endpoint for characters, http://192.168.1.100:3000/generate/character/ if that's something you need.



