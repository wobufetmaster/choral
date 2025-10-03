# Choral

A lightweight, drop-in replacement for SillyTavern. Choral is a Vue + Express application for chatting with AI characters using Character Card V3 format.

## Features

- ✅ **Character Card V3 Support**: Full support for V3 spec with PNG embedding
- ✅ **Streaming Chat**: Real-time streaming responses from AI models
- ✅ **OpenRouter Integration**: Use any OpenRouter-compatible model
- ✅ **Clean UI**: Simple, fast interface with tab support (desktop)
- ✅ **Chat Management**: Save, load, and manage multiple conversations
- ✅ **Message Editing**: Edit and delete messages easily
- ✅ **HTML Rendering**: Sandboxed HTML rendering in chat messages
- ✅ **Persona System**: Create and manage user personas
- 🚧 **Lorebooks**: SillyTavern-compatible lorebook support
- 🚧 **Group Chats**: Multi-character conversations
- 🚧 **Branching**: Explore different conversation paths
- 🚧 **PWA Support**: Install as a progressive web app

## Quick Start

### Prerequisites

- Node.js 16+
- npm

### Installation

\`\`\`bash
# Install dependencies
npm install

# Configure your API key
# Option 1: Set environment variable
export OPENROUTER_API_KEY=your_key_here

# Option 2: Edit config.json
# Edit config.json and add your API key to "openRouterApiKey"

# Start the development server
npm run dev
\`\`\`

This will start:
- Express API server on http://localhost:3000
- Vite dev server on http://localhost:5173

Open http://localhost:5173 in your browser to use Choral.

### Production Build

\`\`\`bash
# Build the frontend
npm run build

# Run the production server
npm run server
\`\`\`

## Configuration

Edit \`config.json\` to customize:

\`\`\`json
{
  "port": 3000,
  "dataDir": "./data",
  "openRouterApiKey": ""
}
\`\`\`

## Data Storage

Characters, chats, lorebooks, and personas are stored in the \`data/\` directory:

\`\`\`
data/
  characters/   # Character card PNG files
  chats/        # Chat history JSON files
  lorebooks/    # Lorebook JSON files
  personas/     # Persona JSON files
\`\`\`

You can sync this directory across devices using syncthing or similar tools.

## Character Cards

Choral supports Character Card V3 format:
- Import V3 cards via drag-and-drop or file picker
- V2 cards are supported for backwards compatibility
- Character cards are stored as PNG files with embedded JSON

The sample character "Roxanne" is included in the repository.

## Development

### Project Structure

\`\`\`
choral/
  server/           # Express backend
    index.js        # Main server
    characterCard.js # PNG card reader/writer
    openrouter.js   # OpenRouter API integration
  src/              # Vue frontend
    main.js         # Vue app entry
    App.vue         # Root component
    components/     # Vue components
  data/             # User data storage
  config.json       # Configuration
\`\`\`

### API Endpoints

- \`GET /api/characters\` - List all characters
- \`GET /api/characters/:filename\` - Get specific character
- \`POST /api/characters\` - Upload/create character
- \`DELETE /api/characters/:filename\` - Delete character
- \`GET /api/chats\` - List all chats
- \`POST /api/chats\` - Save chat
- \`POST /api/chat/stream\` - Stream chat completion

## License

ISC
