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

### UI/UX
- **Theming**: Dark theme (light theme ready)
- **Responsive Design**: CSS variables for easy theming
- **Settings Panel**: Model and parameter configuration
- **Router**: Navigation between character list and chat
- **Clean Interface**: Minimalist, focused on functionality
- **Favicon**: Custom icon.png displayed in browser tab

## 🚧 TODO: Features to Implement

### High Priority
1. **Lorebook System**:
   - SillyTavern format compatibility
   - Entry scanning with keys/regex
   - Scan depth and token budget
   - Recursive scanning
   - Integration with chat context
   - V3 decorators support

2. **Chat Branching**:
   - Tree view for conversation branches
   - Branch creation from any message
   - Branch navigation/switching
   - Visual tree representation

3. **Persona Management**:
   - Persona creation UI
   - Persona selection in chat
   - Replace `{{user}}` with persona name
   - Persona-specific settings

### Medium Priority
4. **Group Chats**:
   - Multiple characters in one chat
   - Character selection for next response
   - Random character selection option
   - Merge vs. individual character descriptions
   - Group-specific greetings

5. **Tab-Based UI** (Desktop):
   - Multiple chat tabs
   - Tab reordering
   - Tab persistence
   - Keyboard shortcuts

6. **Character Tag Management**:
   - Tag editor in character view
   - Tag-based filtering
   - Tag autocomplete
   - Embedded tags in card metadata

7. **PWA Support**:
   - Service worker
   - Manifest file
   - Offline functionality
   - Install prompts

### Lower Priority
8. **Advanced Features**:
   - Character builder with tool calling (Anthropic)
   - Image/vision API support (if needed)
   - Export/import full chat archives
   - Search within chats
   - Message bookmarking

9. **Mobile Optimization**:
    - Touch-friendly controls
    - Bottom navigation
    - Gesture support
    - Termux compatibility testing

10. **Quality of Life**:
    - Keyboard shortcuts
    - Message search
    - Auto-save chats
    - Draft messages
    - Character templates
    - Bulk character operations

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

## Current Project Status

### ✅ Recently Completed
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
1. **Lorebook System**: Entry scanning, token budgets, V3 decorators
2. **Chat Branching**: Tree-based conversation navigation
3. **Persona Management**: User persona creation and selection

---

*Last Updated: 2025-10-03*


