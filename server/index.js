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
const { processLorebook, injectEntries } = require('./lorebook');

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
const GROUP_CHATS_DIR = path.join(DATA_DIR, 'group_chats');
const TAGS_FILE = path.join(DATA_DIR, 'tags.json');

// Tag management helpers
async function loadTags() {
  try {
    const data = await fs.readFile(TAGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveTags(tags) {
  await fs.writeFile(TAGS_FILE, JSON.stringify(tags, null, 2));
}

function normalizeTag(tag) {
  return tag.toLowerCase().trim();
}

// Ensure data directories exist
async function ensureDirectories() {
  await fs.mkdir(CHARACTERS_DIR, { recursive: true });
  await fs.mkdir(CHATS_DIR, { recursive: true });
  await fs.mkdir(LOREBOOKS_DIR, { recursive: true });
  await fs.mkdir(PERSONAS_DIR, { recursive: true });
  await fs.mkdir(PRESETS_DIR, { recursive: true });
  await fs.mkdir(GROUP_CHATS_DIR, { recursive: true });

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

  // Ensure tags file exists
  try {
    await fs.access(TAGS_FILE);
  } catch {
    await fs.writeFile(TAGS_FILE, '{}');
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

    if (req.file && !req.body.card) {
      // Uploaded PNG file (import)
      const uploadPath = req.file.path;
      cardData = await readCharacterCard(uploadPath);

      // Use original filename but ensure it's unique
      filename = await getUniqueFilename(req.file.originalname, CHARACTERS_DIR);

      // Move to characters directory
      const destPath = path.join(CHARACTERS_DIR, filename);
      await fs.rename(uploadPath, destPath);
    } else if (req.body.card) {
      // JSON card data (create/edit)
      cardData = typeof req.body.card === 'string' ? JSON.parse(req.body.card) : req.body.card;

      if (!validateCharacterCard(cardData)) {
        return res.status(400).json({ error: 'Invalid character card' });
      }

      // Generate unique filename based on character name
      filename = await getUniqueFilename(`${cardData.data.name}.png`, CHARACTERS_DIR);
      const destPath = path.join(CHARACTERS_DIR, filename);

      // Handle image
      let imageBuffer = null;
      if (req.file) {
        // Image uploaded as file
        imageBuffer = await fs.readFile(req.file.path);
        await fs.unlink(req.file.path); // Clean up temp file
      } else if (req.body.image) {
        // Image provided as base64
        const base64Data = req.body.image.includes(',')
          ? req.body.image.split(',')[1]
          : req.body.image;
        imageBuffer = Buffer.from(base64Data, 'base64');
      }

      await writeCharacterCard(destPath, cardData, imageBuffer);
    } else {
      return res.status(400).json({ error: 'No file or card data provided' });
    }

    res.json({ success: true, filename, card: cardData });
  } catch (error) {
    console.error('Error creating character:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update character
app.put('/api/characters/:filename', upload.single('file'), async (req, res) => {
  try {
    const oldFilename = req.params.filename;
    const oldFilePath = path.join(CHARACTERS_DIR, oldFilename);

    let cardData;
    let imageBuffer;

    // Get card data from request (parse if string)
    cardData = req.body.card
      ? (typeof req.body.card === 'string' ? JSON.parse(req.body.card) : req.body.card)
      : req.body;

    if (!validateCharacterCard(cardData)) {
      return res.status(400).json({ error: 'Invalid character card' });
    }

    // Handle image
    if (req.file) {
      // New image uploaded as file
      const uploadPath = req.file.path;
      imageBuffer = await fs.readFile(uploadPath);
      await fs.unlink(uploadPath); // Clean up upload temp file
    } else if (req.body.image) {
      // Image provided as base64
      const base64Data = req.body.image.includes(',')
        ? req.body.image.split(',')[1]
        : req.body.image;
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // No new image, keep existing
      imageBuffer = await fs.readFile(oldFilePath);
    }

    // Generate new filename based on character name
    const newBasename = `${cardData.data.name}.png`;
    let newFilename = newBasename;

    // If name changed, ensure unique filename and delete old file
    if (newBasename !== oldFilename) {
      newFilename = await getUniqueFilename(newBasename, CHARACTERS_DIR);
      const newFilePath = path.join(CHARACTERS_DIR, newFilename);

      // Write to new location
      await writeCharacterCard(newFilePath, cardData, imageBuffer);

      // Delete old file
      try {
        await fs.unlink(oldFilePath);
      } catch (err) {
        console.error('Error deleting old character file:', err);
      }
    } else {
      // Same filename, overwrite
      await writeCharacterCard(oldFilePath, cardData, imageBuffer);
    }

    res.json({ success: true, filename: newFilename, card: cardData });
  } catch (error) {
    console.error('Error updating character:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update character tags
app.put('/api/characters/:filename/tags', async (req, res) => {
  try {
    const filePath = path.join(CHARACTERS_DIR, req.params.filename);
    const { tags } = req.body;

    console.log('Updating tags for:', req.params.filename);
    console.log('New tags:', tags);

    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'Tags must be an array' });
    }

    // Read the character card
    const card = await readCharacterCard(filePath);
    console.log('Current card tags:', card.data?.tags);

    // Ensure card.data exists
    if (!card.data) {
      card.data = {};
    }

    // Update tags
    card.data.tags = tags;
    console.log('Updated card tags:', card.data.tags);

    // Read the existing PNG file buffer
    const pngBuffer = await fs.readFile(filePath);

    // Write updated card back to PNG
    await writeCharacterCard(filePath, card, pngBuffer);
    console.log('Tags saved successfully');

    // Verify by reading back
    const verifyCard = await readCharacterCard(filePath);
    console.log('Verified tags:', verifyCard.data?.tags);

    res.json({ success: true, tags: verifyCard.data?.tags || [] });
  } catch (error) {
    console.error('Failed to update tags:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Auto-generate tags for a character
app.post('/api/characters/:filename/auto-tag', async (req, res) => {
  try {
    const filePath = path.join(CHARACTERS_DIR, req.params.filename);
    const card = await readCharacterCard(filePath);

    const description = card.data?.description || '';
    const personality = card.data?.personality || '';
    const scenario = card.data?.scenario || '';

    if (!description && !personality && !scenario) {
      return res.status(400).json({ error: 'Character has no description to analyze' });
    }

    // Load existing tag colors
    const existingTags = await loadTags();
    const existingTagNames = Object.keys(existingTags);

    // Build prompt for the bookkeeping model
    const characterInfo = [
      description && `Description: ${description}`,
      personality && `Personality: ${personality}`,
      scenario && `Scenario: ${scenario}`
    ].filter(Boolean).join('\n\n');

    const existingTagsSection = existingTagNames.length > 0
      ? `\n\nExisting tags in the system (PREFER REUSING THESE when appropriate):\n${existingTagNames.join(', ')}`
      : '';

    const prompt = `Analyze this character and generate relevant tags with appropriate colors. Tags should be concise, descriptive keywords (e.g., genre, setting, personality traits, themes).

IMPORTANT: If any existing tags are relevant, YOU MUST reuse them exactly as shown. Only create new tags if none of the existing tags fit. Avoid creating similar variations (e.g., don't create "science fiction" if "sci-fi" exists, or "alien encounter" if "alien" exists).${existingTagsSection}

Character Information:
${characterInfo}

Generate 5-10 relevant tags with colors. For new tags, assign meaningful CSS colors (hex codes) that relate to the tag's meaning. Examples:
- sci-fi: #4a9eff (blue)
- fantasy: #22c55e (green)
- romance: #ec4899 (pink)
- horror: #dc2626 (red)
- comedy: #f59e0b (orange)`;

    // Call OpenRouter with structured output
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Choral'
      },
      body: JSON.stringify({
        model: config.bookkeepingModel || 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'character_tags',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                tags: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', description: 'Tag name' },
                      color: { type: 'string', description: 'CSS color (hex code or named color)' }
                    },
                    required: ['name', 'color'],
                    additionalProperties: false
                  },
                  description: 'Array of tags with colors'
                }
              },
              required: ['tags'],
              additionalProperties: false
            }
          }
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const generatedTagsWithColors = JSON.parse(data.choices[0].message.content).tags;

    // Process tags: use existing colors if tag already exists (case-insensitive), otherwise save new color
    const processedTags = [];
    let tagsUpdated = false;

    for (const tagObj of generatedTagsWithColors) {
      const normalizedTag = normalizeTag(tagObj.name);

      if (existingTags[normalizedTag]) {
        // Tag exists, use existing color
        processedTags.push({
          name: tagObj.name,
          color: existingTags[normalizedTag]
        });
      } else {
        // New tag, save the color
        existingTags[normalizedTag] = tagObj.color;
        processedTags.push(tagObj);
        tagsUpdated = true;
      }
    }

    // Save updated tags if there were new ones
    if (tagsUpdated) {
      await saveTags(existingTags);
    }

    console.log('Generated tags:', processedTags);

    res.json({ success: true, tags: processedTags });
  } catch (error) {
    console.error('Failed to auto-generate tags:', error);
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

// ===== Group Chat Routes =====

// Get all group chats
app.get('/api/group-chats', async (req, res) => {
  try {
    const files = await fs.readdir(GROUP_CHATS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    const groupChats = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(GROUP_CHATS_DIR, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const groupChat = JSON.parse(content);
          return {
            filename: file,
            ...groupChat
          };
        } catch (err) {
          console.error(`Error reading group chat ${file}:`, err);
          return null;
        }
      })
    );

    res.json(groupChats.filter(gc => gc !== null));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific group chat
app.get('/api/group-chats/:filename', async (req, res) => {
  try {
    const filePath = path.join(GROUP_CHATS_DIR, req.params.filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const groupChat = JSON.parse(content);
    res.json(groupChat);
  } catch (error) {
    res.status(404).json({ error: 'Group chat not found' });
  }
});

// Create/update group chat
app.post('/api/group-chats', async (req, res) => {
  try {
    const groupChat = req.body;
    const filename = groupChat.filename || `group_chat_${Date.now()}.json`;
    const filePath = path.join(GROUP_CHATS_DIR, filename);

    await fs.writeFile(filePath, JSON.stringify(groupChat, null, 2));
    res.json({ success: true, filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete group chat
app.delete('/api/group-chats/:filename', async (req, res) => {
  try {
    const filePath = path.join(GROUP_CHATS_DIR, req.params.filename);
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
          const lorebook = JSON.parse(content);
          return {
            filename: file,
            ...lorebook
          };
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

// Get specific lorebook
app.get('/api/lorebooks/:filename', async (req, res) => {
  try {
    const filePath = path.join(LOREBOOKS_DIR, req.params.filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const lorebook = JSON.parse(content);
    res.json(lorebook);
  } catch (error) {
    res.status(404).json({ error: 'Lorebook not found' });
  }
});

// Create/update lorebook
app.post('/api/lorebooks', async (req, res) => {
  try {
    const lorebook = req.body;
    const filename = lorebook.filename || `${lorebook.name || 'lorebook'}.json`;
    const filePath = path.join(LOREBOOKS_DIR, filename);

    // Create a copy without the filename property for storage
    const { filename: _, ...lorebookData } = lorebook;

    await fs.writeFile(filePath, JSON.stringify(lorebookData, null, 2));
    res.json({ success: true, filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete lorebook
app.delete('/api/lorebooks/:filename', async (req, res) => {
  try {
    const filePath = path.join(LOREBOOKS_DIR, req.params.filename);
    await fs.unlink(filePath);
    res.json({ success: true });
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
// ===== Tag Routes =====

// Get all tag colors
app.get('/api/tags', async (req, res) => {
  try {
    const tags = await loadTags();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save tag colors
app.post('/api/tags', async (req, res) => {
  try {
    const tags = req.body;
    await saveTags(tags);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Config Routes =====

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
app.post('/api/chat/stream', async (req, res) => {
  const { messages, model, options, context, promptProcessing, lorebookFilenames, debug } = req.body;

  // Process macros in messages if context provided
  let processedMessages = context
    ? processMessagesWithMacros(messages, context)
    : messages;

  // Debug info to track matched entries
  const debugInfo = {
    matchedEntriesByLorebook: {}
  };

  // Process lorebooks if provided
  if (lorebookFilenames && Array.isArray(lorebookFilenames) && lorebookFilenames.length > 0) {
    try {
      let allMatchedEntries = [];

      // Process each lorebook
      for (const lorebookFilename of lorebookFilenames) {
        try {
          const lorebookPath = path.join(LOREBOOKS_DIR, lorebookFilename);
          const lorebookContent = await fs.readFile(lorebookPath, 'utf-8');
          const lorebook = JSON.parse(lorebookContent);

          const matchedEntries = processLorebook(lorebook, processedMessages);

          // Store debug info
          if (debug) {
            debugInfo.matchedEntriesByLorebook[lorebookFilename] = matchedEntries;
          }

          allMatchedEntries = allMatchedEntries.concat(matchedEntries);
        } catch (err) {
          console.error(`Error processing lorebook ${lorebookFilename}:`, err);
        }
      }

      // Sort all entries by priority
      allMatchedEntries.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      if (allMatchedEntries.length > 0) {
        // Inject at the beginning (after system prompts if any)
        const systemCount = processedMessages.filter(m => m.role === 'system').length;
        processedMessages = injectEntries(processedMessages, allMatchedEntries, 'before', systemCount);
      }
    } catch (err) {
      console.error('Error processing lorebooks:', err);
    }
  }

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
    lorebooks: lorebookFilenames || [],
    streaming: true
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send debug info first if requested
  if (debug) {
    console.log('Sending debug info:', JSON.stringify(debugInfo, null, 2));
    res.write(`data: ${JSON.stringify({ type: 'debug', debug: debugInfo })}\n\n`);
  }

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
    const { messages, model, options, context, promptProcessing, lorebookFilenames } = req.body;

    // Process macros in messages if context provided
    let processedMessages = context
      ? processMessagesWithMacros(messages, context)
      : messages;

    // Process lorebooks if provided
    if (lorebookFilenames && Array.isArray(lorebookFilenames) && lorebookFilenames.length > 0) {
      try {
        let allMatchedEntries = [];

        // Process each lorebook
        for (const lorebookFilename of lorebookFilenames) {
          try {
            const lorebookPath = path.join(LOREBOOKS_DIR, lorebookFilename);
            const lorebookContent = await fs.readFile(lorebookPath, 'utf-8');
            const lorebook = JSON.parse(lorebookContent);

            const matchedEntries = processLorebook(lorebook, processedMessages);
            allMatchedEntries = allMatchedEntries.concat(matchedEntries);
          } catch (err) {
            console.error(`Error processing lorebook ${lorebookFilename}:`, err);
          }
        }

        // Sort all entries by priority
        allMatchedEntries.sort((a, b) => (b.priority || 0) - (a.priority || 0));

        if (allMatchedEntries.length > 0) {
          // Inject at the beginning (after system prompts if any)
          const systemCount = processedMessages.filter(m => m.role === 'system').length;
          processedMessages = injectEntries(processedMessages, allMatchedEntries, 'before', systemCount);
        }
      } catch (err) {
        console.error('Error processing lorebooks:', err);
      }
    }

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
      lorebooks: lorebookFilenames || [],
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
