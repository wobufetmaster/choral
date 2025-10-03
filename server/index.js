const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { readCharacterCard, writeCharacterCard, validateCharacterCard } = require('./characterCard');
const { streamChatCompletion, chatCompletion } = require('./openrouter');
const { processMacros, processMessagesWithMacros } = require('./macros');
const { DEFAULT_PRESET, convertPixiJBToPreset, validatePreset } = require('./presets');
const { logRequest, logResponse, logStreamChunk } = require('./logger');
const { processPrompt, MODES } = require('./promptProcessor');

// Load config
const config = require('../config.json');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const DATA_DIR = path.resolve(config.dataDir);
const CHARACTERS_DIR = path.join(DATA_DIR, 'characters');
const CHATS_DIR = path.join(DATA_DIR, 'chats');
const LOREBOOKS_DIR = path.join(DATA_DIR, 'lorebooks');
const PERSONAS_DIR = path.join(DATA_DIR, 'personas');
const PRESETS_DIR = path.join(DATA_DIR, 'presets');

// Ensure data directories exist
async function ensureDirectories() {
  await fs.mkdir(CHARACTERS_DIR, { recursive: true });
  await fs.mkdir(CHATS_DIR, { recursive: true });
  await fs.mkdir(LOREBOOKS_DIR, { recursive: true });
  await fs.mkdir(PERSONAS_DIR, { recursive: true });
  await fs.mkdir(PRESETS_DIR, { recursive: true });

  // Create default preset if none exist
  try {
    const files = await fs.readdir(PRESETS_DIR);
    if (files.filter(f => f.endsWith('.json')).length === 0) {
      await fs.writeFile(
        path.join(PRESETS_DIR, 'default.json'),
        JSON.stringify(DEFAULT_PRESET, null, 2)
      );
    }
  } catch (err) {
    console.error('Error creating default preset:', err);
  }

  // Create default persona if none exist
  try {
    const files = await fs.readdir(PERSONAS_DIR);
    if (files.filter(f => f.endsWith('.json')).length === 0) {
      const defaultPersona = {
        name: 'User',
        avatar: null,
        description: '',
        characterBindings: [] // Array of character filenames
      };
      await fs.writeFile(
        path.join(PERSONAS_DIR, 'default.json'),
        JSON.stringify(defaultPersona, null, 2)
      );
    }
  } catch (err) {
    console.error('Error creating default persona:', err);
  }
}

// ===== Character Routes =====

// Get all characters
app.get('/api/characters', async (req, res) => {
  try {
    const files = await fs.readdir(CHARACTERS_DIR);
    const pngFiles = files.filter(f => f.endsWith('.png'));

    const characters = await Promise.all(
      pngFiles.map(async (file) => {
        try {
          const filePath = path.join(CHARACTERS_DIR, file);
          const card = await readCharacterCard(filePath);
          return {
            filename: file,
            name: card.data?.name || 'Unknown',
            tags: card.data?.tags || [],
            data: card
          };
        } catch (err) {
          console.error(`Error reading ${file}:`, err);
          return null;
        }
      })
    );

    res.json(characters.filter(c => c !== null));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific character
app.get('/api/characters/:filename', async (req, res) => {
  try {
    const filePath = path.join(CHARACTERS_DIR, req.params.filename);
    const card = await readCharacterCard(filePath);
    res.json(card);
  } catch (error) {
    res.status(404).json({ error: 'Character not found' });
  }
});

// Get character image
app.get('/api/characters/:filename/image', async (req, res) => {
  try {
    const filePath = path.join(CHARACTERS_DIR, req.params.filename);
    res.sendFile(filePath);
  } catch (error) {
    res.status(404).json({ error: 'Image not found' });
  }
});

// Helper function to generate unique filename
async function getUniqueFilename(baseFilename, directory) {
  const ext = path.extname(baseFilename);
  const nameWithoutExt = path.basename(baseFilename, ext);

  let filename = baseFilename;
  let counter = 1;

  while (true) {
    try {
      await fs.access(path.join(directory, filename));
      // File exists, try next number
      filename = `${nameWithoutExt}_${counter}${ext}`;
      counter++;
    } catch {
      // File doesn't exist, we can use this name
      return filename;
    }
  }
}

// Upload/create character
app.post('/api/characters', upload.single('file'), async (req, res) => {
  try {
    let cardData;
    let filename;

    if (req.file) {
      // Uploaded PNG file
      const uploadPath = req.file.path;
      cardData = await readCharacterCard(uploadPath);

      // Use original filename but ensure it's unique
      filename = await getUniqueFilename(req.file.originalname, CHARACTERS_DIR);

      // Move to characters directory
      const destPath = path.join(CHARACTERS_DIR, filename);
      await fs.rename(uploadPath, destPath);
    } else if (req.body.card) {
      // JSON card data
      cardData = req.body.card;

      if (!validateCharacterCard(cardData)) {
        return res.status(400).json({ error: 'Invalid character card' });
      }

      // Generate unique filename based on character name
      filename = await getUniqueFilename(`${cardData.data.name}.png`, CHARACTERS_DIR);
      const destPath = path.join(CHARACTERS_DIR, filename);

      // If image provided, use it; otherwise create blank
      const imageBuffer = req.body.image ? Buffer.from(req.body.image, 'base64') : null;
      await writeCharacterCard(destPath, cardData, imageBuffer);
    } else {
      return res.status(400).json({ error: 'No file or card data provided' });
    }

    res.json({ success: true, filename, card: cardData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete character
app.delete('/api/characters/:filename', async (req, res) => {
  try {
    const filePath = path.join(CHARACTERS_DIR, req.params.filename);
    await fs.unlink(filePath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Chat Routes =====

// Get all chats
app.get('/api/chats', async (req, res) => {
  try {
    const files = await fs.readdir(CHATS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const chats = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(CHATS_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const chat = JSON.parse(content);
          return {
            filename: file,
            ...chat
          };
        } catch (err) {
          console.error(`Error reading chat ${file}:`, err);
          return null;
        }
      })
    );

    res.json(chats.filter(c => c !== null));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get most recent chat for a character (MUST come before /:filename route)
app.get('/api/chats/character/:characterFilename', async (req, res) => {
  try {
    const files = await fs.readdir(CHATS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const chats = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(CHATS_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const chat = JSON.parse(content);
          return { filename: file, ...chat };
        } catch (err) {
          return null;
        }
      })
    );

    // Filter by character and sort by timestamp
    const characterChats = chats
      .filter(c => c && c.characterFilename === req.params.characterFilename)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (characterChats.length > 0) {
      res.json(characterChats[0]);
    } else {
      res.status(404).json({ error: 'No chats found for character' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific chat
app.get('/api/chats/:filename', async (req, res) => {
  try {
    const filePath = path.join(CHATS_DIR, req.params.filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const chat = JSON.parse(content);
    res.json(chat);
  } catch (error) {
    res.status(404).json({ error: 'Chat not found' });
  }
});

// Create/update chat
app.post('/api/chats', async (req, res) => {
  try {
    const chat = req.body;
    const filename = chat.filename || `chat_${Date.now()}.json`;
    const filePath = path.join(CHATS_DIR, filename);

    await fs.writeFile(filePath, JSON.stringify(chat, null, 2));
    res.json({ success: true, filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete chat
app.delete('/api/chats/:filename', async (req, res) => {
  try {
    const filePath = path.join(CHATS_DIR, req.params.filename);
    await fs.unlink(filePath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Persona Routes =====

// Get all personas
app.get('/api/personas', async (req, res) => {
  try {
    const files = await fs.readdir(PERSONAS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const personas = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(PERSONAS_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(content);
        } catch (err) {
          return null;
        }
      })
    );

    res.json(personas.filter(p => p !== null));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create/update persona
app.post('/api/personas', async (req, res) => {
  try {
    const persona = req.body;
    const filename = `${persona.name}.json`;
    const filePath = path.join(PERSONAS_DIR, filename);

    await fs.writeFile(filePath, JSON.stringify(persona, null, 2));
    res.json({ success: true, filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete persona
app.delete('/api/personas/:filename', async (req, res) => {
  try {
    const filePath = path.join(PERSONAS_DIR, req.params.filename);
    await fs.unlink(filePath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Lorebook Routes =====

// Get all lorebooks
app.get('/api/lorebooks', async (req, res) => {
  try {
    const files = await fs.readdir(LOREBOOKS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const lorebooks = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(LOREBOOKS_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          return JSON.parse(content);
        } catch (err) {
          return null;
        }
      })
    );

    res.json(lorebooks.filter(l => l !== null));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create/update lorebook
app.post('/api/lorebooks', async (req, res) => {
  try {
    const lorebook = req.body;
    const filename = `${lorebook.data.name || 'lorebook'}.json`;
    const filePath = path.join(LOREBOOKS_DIR, filename);

    await fs.writeFile(filePath, JSON.stringify(lorebook, null, 2));
    res.json({ success: true, filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Preset Routes =====

// Get all presets
app.get('/api/presets', async (req, res) => {
  try {
    const files = await fs.readdir(PRESETS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const presets = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(PRESETS_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const preset = JSON.parse(content);
          return {
            filename: file,
            ...preset
          };
        } catch (err) {
          return null;
        }
      })
    );

    res.json(presets.filter(p => p !== null));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific preset
app.get('/api/presets/:filename', async (req, res) => {
  try {
    const filePath = path.join(PRESETS_DIR, req.params.filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const preset = JSON.parse(content);
    res.json(preset);
  } catch (error) {
    res.status(404).json({ error: 'Preset not found' });
  }
});

// Create/update preset
app.post('/api/presets', async (req, res) => {
  try {
    const preset = req.body;

    if (!validatePreset(preset)) {
      return res.status(400).json({ error: 'Invalid preset' });
    }

    const filename = preset.filename || `${preset.name.toLowerCase().replace(/\s+/g, '_')}.json`;
    const filePath = path.join(PRESETS_DIR, filename);

    await fs.writeFile(filePath, JSON.stringify(preset, null, 2));
    res.json({ success: true, filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete preset
app.delete('/api/presets/:filename', async (req, res) => {
  try {
    const filePath = path.join(PRESETS_DIR, req.params.filename);
    await fs.unlink(filePath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import PixiJB config as preset
app.post('/api/presets/import/pixijb', async (req, res) => {
  try {
    const pixijbConfig = req.body;
    const preset = convertPixiJBToPreset(pixijbConfig);

    const filename = 'imported_pixijb.json';
    const filePath = path.join(PRESETS_DIR, filename);

    await fs.writeFile(filePath, JSON.stringify(preset, null, 2));
    res.json({ success: true, filename, preset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Config Routes =====

// Get config (without sensitive data)
app.get('/api/config', (req, res) => {
  res.json({
    port: config.port,
    hasApiKey: !!config.openRouterApiKey || !!process.env.OPENROUTER_API_KEY,
    activePreset: config.activePreset || 'default.json'
  });
});

// Set active preset
app.post('/api/config/active-preset', async (req, res) => {
  try {
    const { preset } = req.body;

    // Update config
    config.activePreset = preset;

    // Save config to disk
    const configPath = path.join(__dirname, '..', 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    res.json({ success: true, activePreset: preset });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Chat Completion Routes =====

// Stream chat completion
app.post('/api/chat/stream', (req, res) => {
  const { messages, model, options, context, promptProcessing } = req.body;

  // Process macros in messages if context provided
  let processedMessages = context
    ? processMessagesWithMacros(messages, context)
    : messages;

  // Apply prompt post-processing
  const processingMode = promptProcessing || 'merge_system';
  processedMessages = processPrompt(processedMessages, processingMode, options);

  // Log the request
  logRequest({
    model,
    messages: processedMessages,
    options,
    context,
    promptProcessing: processingMode,
    streaming: true
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullResponse = '';

  streamChatCompletion({
    messages: processedMessages,
    model,
    options,
    onChunk: (content) => {
      fullResponse += content;
      logStreamChunk(content);
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    },
    onComplete: () => {
      logResponse({ content: fullResponse });
      res.write('data: [DONE]\n\n');
      res.end();
    },
    onError: (error) => {
      logResponse({ error: error.message });
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });
});

// Non-streaming chat completion
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model, options, context, promptProcessing } = req.body;

    // Process macros in messages if context provided
    let processedMessages = context
      ? processMessagesWithMacros(messages, context)
      : messages;

    // Apply prompt post-processing
    const processingMode = promptProcessing || 'merge_system';
    processedMessages = processPrompt(processedMessages, processingMode, options);

    // Log the request
    logRequest({
      model,
      messages: processedMessages,
      options,
      context,
      promptProcessing: processingMode,
      streaming: false
    });

    const content = await chatCompletion({ messages: processedMessages, model, options });

    // Log the response
    logResponse({ content });

    res.json({ content });
  } catch (error) {
    logResponse({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Start server
ensureDirectories().then(() => {
  app.listen(config.port, () => {
    console.log(`Choral server running on port ${config.port}`);
  });
});
