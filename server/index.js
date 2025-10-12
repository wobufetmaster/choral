const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const multer = require('multer');
const { readCharacterCard, writeCharacterCard, validateCharacterCard, convertV2ToV3 } = require('./characterCard');
const { streamChatCompletion, chatCompletion } = require('./openrouter');
const { processMacros, processMessagesWithMacros } = require('./macros');
const { DEFAULT_PRESET, convertPixiJBToPreset, validatePreset } = require('./presets');
const { logRequest, logResponse, logStreamChunk } = require('./logger');
const { processPrompt, MODES } = require('./promptProcessor');
const { processLorebook, injectEntries } = require('./lorebook');

// Load config safely, creating if it doesn't exist
function loadConfig() {
  const configPath = path.join(__dirname, '../config.json');
  const examplePath = path.join(__dirname, '../config.example.json');

  try {
    if (require('fs').existsSync(configPath)) {
      return require(configPath);
    } else if (require('fs').existsSync(examplePath)) {
      // Copy example config to config.json
      const exampleConfig = require('fs').readFileSync(examplePath, 'utf-8');
      require('fs').writeFileSync(configPath, exampleConfig);
      console.log('Created config.json from config.example.json');
      return JSON.parse(exampleConfig);
    } else {
      // Create minimal default config
      const defaultConfig = {
        port: 3000,
        dataDir: './data',
        openRouterApiKey: '',
        activePreset: 'default.json'
      };
      require('fs').writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      console.log('Created default config.json');
      return defaultConfig;
    }
  } catch (error) {
    console.error('Error loading config:', error);
    // Return defaults if all else fails
    return {
      port: 3000,
      dataDir: './data',
      openRouterApiKey: '',
      activePreset: 'default.json'
    };
  }
}

const config = loadConfig();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve documentation
app.use('/docs', express.static(path.join(__dirname, '../docs')));

const DATA_DIR = path.resolve(config.dataDir || './data');
const CHARACTERS_DIR = path.join(DATA_DIR, 'characters');
const CHATS_DIR = path.join(DATA_DIR, 'chats');
const LOREBOOKS_DIR = path.join(DATA_DIR, 'lorebooks');
const PERSONAS_DIR = path.join(DATA_DIR, 'personas');
const PRESETS_DIR = path.join(DATA_DIR, 'presets');
const GROUP_CHATS_DIR = path.join(DATA_DIR, 'group_chats');
const TAGS_FILE = path.join(DATA_DIR, 'tags.json');
const CORE_TAGS_FILE = path.join(DATA_DIR, 'core-tags.json');
const BOOKKEEPING_SETTINGS_FILE = path.join(DATA_DIR, 'bookkeeping-settings.json');
const TOOL_SETTINGS_FILE = path.join(DATA_DIR, 'tool-settings.json');

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

// Core tags management (global tags that can't be removed from characters)
async function loadCoreTags() {
  try {
    const data = await fs.readFile(CORE_TAGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function saveCoreTags(coreTags) {
  await fs.writeFile(CORE_TAGS_FILE, JSON.stringify(coreTags, null, 2));
}

// Bookkeeping settings management
async function loadBookkeepingSettings() {
  try {
    const data = await fs.readFile(BOOKKEEPING_SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Return default settings
    return {
      enableBookkeeping: false,
      autoRenameChats: false,
      model: config.bookkeepingModel || 'openai/gpt-4o-mini',
      strictMode: false
    };
  }
}

async function saveBookkeepingSettings(settings) {
  await fs.writeFile(BOOKKEEPING_SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// Tool settings management
async function loadToolSettings() {
  try {
    const data = await fs.readFile(TOOL_SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // Return default settings
    return {
      enableToolCalling: true,
      characterTools: []
    };
  }
}

async function saveToolSettings(settings) {
  await fs.writeFile(TOOL_SETTINGS_FILE, JSON.stringify(settings, null, 2));
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
          const stats = await fs.stat(filePath);
          return {
            filename: file,
            name: card.data?.name || 'Unknown',
            tags: card.data?.tags || [],
            data: card,
            createdAt: stats.birthtime.getTime(), // Use birthtime (creation time) as milliseconds timestamp
            modifiedAt: stats.mtime.getTime() // Also include modification time
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

// Helper function to sanitize filename for cross-platform compatibility
// Removes or replaces characters that are problematic on Android/Linux filesystems
function sanitizeFilename(filename) {
  const ext = path.extname(filename);
  let nameWithoutExt = path.basename(filename, ext);

  // List of characters that are problematic on various filesystems
  // Especially important for Android/Linux compatibility with macOS/Windows
  const problematicChars = /["':<>?*|\/\\]/g;

  // Replace problematic characters with safe alternatives or remove them
  nameWithoutExt = nameWithoutExt
    .replace(/"/g, '') // Remove double quotes
    .replace(/'/g, '') // Remove single quotes
    .replace(/:/g, '-') // Replace colons with dashes
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/[?*|]/g, '') // Remove wildcards and pipes
    .replace(/[\/\\]/g, '-') // Replace slashes with dashes
    .trim();

  // Ensure the filename isn't empty after sanitization
  if (!nameWithoutExt) {
    nameWithoutExt = 'character';
  }

  return nameWithoutExt + ext;
}

// Helper function to generate unique filename
async function getUniqueFilename(baseFilename, directory) {
  // Sanitize first to ensure cross-platform compatibility
  baseFilename = sanitizeFilename(baseFilename);

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

    // Load bookkeeping settings
    const bookkeepingSettings = await loadBookkeepingSettings();

    // Check if bookkeeping is enabled
    if (!bookkeepingSettings.enableBookkeeping) {
      return res.status(400).json({ error: 'Bookkeeping features are disabled. Enable them in Bookkeeping Settings.' });
    }

    const strictMode = bookkeepingSettings.strictMode || false;
    const model = bookkeepingSettings.model || 'openai/gpt-4o-mini';

    // Load existing tag colors and core tags
    const existingTags = await loadTags();
    const coreTags = await loadCoreTags();

    // In strict mode, only use core tags. Otherwise, use all existing tags.
    const availableTags = strictMode ? coreTags : Object.keys(existingTags);

    // Build prompt for the bookkeeping model
    const characterInfo = [
      description && `Description: ${description}`,
      personality && `Personality: ${personality}`,
      scenario && `Scenario: ${scenario}`
    ].filter(Boolean).join('\n\n');

    // Get prompt template from settings or use defaults
    let promptTemplate;
    if (strictMode && availableTags.length > 0) {
      promptTemplate = bookkeepingSettings.autoTaggingPromptStrict || `Analyze this character and select the most relevant tags from the provided list. You MUST ONLY use tags from this list, do not create new tags.

Available tags:
{{availableTags}}

Character Information:
{{characterInfo}}

Select 5-10 relevant tags from the list above. For each tag, provide the tag name and assign a meaningful CSS color (hex code) that relates to the tag's meaning. Examples:
- sci-fi: #4a9eff (blue)
- fantasy: #22c55e (green)
- romance: #ec4899 (pink)
- horror: #dc2626 (red)
- comedy: #f59e0b (orange)`;

      // Replace placeholders
      prompt = promptTemplate
        .replace('{{availableTags}}', availableTags.join(', '))
        .replace('{{characterInfo}}', characterInfo);
    } else {
      // Normal mode: prefer existing tags but can create new ones
      const existingTagsSection = availableTags.length > 0
        ? `\n\nExisting tags in the system (PREFER REUSING THESE when appropriate):\n${availableTags.join(', ')}`
        : '';

      promptTemplate = bookkeepingSettings.autoTaggingPromptNormal || `Analyze this character and generate relevant tags with appropriate colors. Tags should be concise, descriptive keywords (e.g., genre, setting, personality traits, themes).

IMPORTANT: If any existing tags are relevant, YOU MUST reuse them exactly as shown. Only create new tags if none of the existing tags fit. Avoid creating similar variations (e.g., don't create "science fiction" if "sci-fi" exists, or "alien encounter" if "alien" exists).{{existingTagsSection}}

Character Information:
{{characterInfo}}

Generate 5-10 relevant tags with colors. For new tags, assign meaningful CSS colors (hex codes) that relate to the tag's meaning. Examples:
- sci-fi: #4a9eff (blue)
- fantasy: #22c55e (green)
- romance: #ec4899 (pink)
- horror: #dc2626 (red)
- comedy: #f59e0b (orange)`;

      // Replace placeholders
      prompt = promptTemplate
        .replace('{{existingTagsSection}}', existingTagsSection)
        .replace('{{characterInfo}}', characterInfo);
    }

    // Build request body
    const requestBody = {
      model: model,
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
    };

    console.log('\n========== AUTO-TAGGER REQUEST ==========');
    console.log('Model:', model);
    console.log('Strict mode:', strictMode);
    console.log('Available tags count:', availableTags.length);
    console.log('Prompt:', prompt.substring(0, 500) + '...');
    console.log('=========================================\n');

    // Call OpenRouter with structured output
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Choral'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const generatedTagsWithColors = JSON.parse(data.choices[0].message.content).tags;

    console.log('\n========== AUTO-TAGGER RESPONSE ==========');
    console.log('Raw AI response:', data.choices[0].message.content);
    console.log('Generated tags:', JSON.stringify(generatedTagsWithColors, null, 2));
    console.log('==========================================\n');

    // Process tags: validate against core tags in strict mode, use/save colors appropriately
    const processedTags = [];
    let tagsUpdated = false;

    // Normalize core tags for comparison
    const normalizedCoreTags = strictMode
      ? new Set(coreTags.map(t => normalizeTag(t)))
      : null;

    for (const tagObj of generatedTagsWithColors) {
      const normalizedTag = normalizeTag(tagObj.name);

      // In strict mode, only accept tags from the core tags list
      if (strictMode) {
        if (!normalizedCoreTags.has(normalizedTag)) {
          console.log(`Skipping tag "${tagObj.name}" - not in core tags list (strict mode)`);
          console.log(`Core tags:`, Array.from(normalizedCoreTags));
          continue;
        }
      }

      // Use existing color if available, otherwise use generated color
      const finalColor = existingTags[normalizedTag] || tagObj.color;

      processedTags.push({
        name: tagObj.name,
        color: finalColor
      });

      // Save new color to tags file if it didn't exist before (and not in strict mode, or if in strict mode and it's a core tag)
      if (!existingTags[normalizedTag]) {
        existingTags[normalizedTag] = tagObj.color;
        tagsUpdated = true;
      }
    }

    // Save updated tags if there were new colors added
    if (tagsUpdated) {
      await saveTags(existingTags);
    }

    console.log('Generated tags:', processedTags);
    console.log('Strict mode:', strictMode);
    console.log('Core tags count:', coreTags.length);

    res.json({ success: true, tags: processedTags });
  } catch (error) {
    console.error('Failed to auto-generate tags:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk remove tags from all characters
app.post('/api/characters/bulk-remove-tags', async (req, res) => {
  try {
    const files = await fs.readdir(CHARACTERS_DIR);
    const pngFiles = files.filter(f => f.endsWith('.png'));
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    console.log(`Processing ${pngFiles.length} character files...`);

    for (const file of pngFiles) {
      try {
        const filePath = path.join(CHARACTERS_DIR, file);
        console.log(`Reading ${file}...`);
        let card = await readCharacterCard(filePath);

        console.log(`${file} - Spec:`, card.spec);
        console.log(`${file} - Has data:`, !!card.data);
        console.log(`${file} - Tags:`, card.data?.tags);

        // Convert V2 to V3 if needed
        if (card.spec !== 'chara_card_v3') {
          console.log(`Converting ${file} from V2 to V3...`);
          card = convertV2ToV3(card);
        }

        // Check if character has tags (including empty arrays)
        if (card.data && Array.isArray(card.data.tags)) {
          const hadTags = card.data.tags.length > 0;
          const tagCount = card.data.tags.length;

          // Clear tags
          card.data.tags = [];

          // Read PNG buffer and write back
          console.log(`Writing ${file}...`);
          const pngBuffer = await fs.readFile(filePath);
          await writeCharacterCard(filePath, card, pngBuffer);

          // Verify the write
          const verifyCard = await readCharacterCard(filePath);
          console.log(`${file} - Verified tags after write:`, verifyCard.data?.tags);

          if (hadTags) {
            updatedCount++;
            console.log(`✓ Updated ${file} (removed ${tagCount} tags)`);
          } else {
            skippedCount++;
            console.log(`○ Skipped ${file} (no tags to remove)`);
          }
        } else {
          skippedCount++;
          console.log(`○ Skipped ${file} (no tags array)`);
        }
      } catch (err) {
        console.error(`✗ Error processing ${file}:`, err.message);
        errors.push({ file, error: err.message });
      }
    }

    console.log(`Bulk tag removal complete: ${updatedCount} updated, ${skippedCount} skipped, ${errors.length} errors`);

    res.json({
      success: true,
      updatedCount,
      skippedCount,
      totalFiles: pngFiles.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Bulk tag removal error:', error);
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

// Rename chat (update display name without changing filename)
app.patch('/api/chats/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const filePath = path.join(CHATS_DIR, filename);

    // Read the existing chat
    const content = await fs.readFile(filePath, 'utf-8');
    const chat = JSON.parse(content);

    // Update the title and mark as manually named
    chat.title = title.trim();
    chat.manuallyNamed = true;
    // Remove autoNamed flag if it exists (user is overriding auto-name)
    delete chat.autoNamed;

    // Save back to the same file (no renaming)
    await fs.writeFile(filePath, JSON.stringify(chat, null, 2));

    res.json({ success: true, filename, title: chat.title });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-generate chat title
app.post('/api/chats/:filename/auto-name', async (req, res) => {
  try {
    const filePath = path.join(CHATS_DIR, req.params.filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const chat = JSON.parse(content);

    // Check if chat has messages
    if (!chat.messages || chat.messages.length === 0) {
      return res.status(400).json({ error: 'Chat has no messages to analyze' });
    }

    // Skip if manually named by user (unless force flag is provided)
    if (chat.manuallyNamed && !req.body.force) {
      return res.json({ success: true, title: chat.title, skipped: true, reason: 'manually_named' });
    }

    // Check if already auto-named (unless force flag is provided)
    if (chat.autoNamed && !req.body.force) {
      return res.json({ success: true, title: chat.title, skipped: true, reason: 'already_auto_named' });
    }

    // Skip if chat already has a title (unless force flag is provided)
    if (chat.title && !req.body.force) {
      return res.json({ success: true, title: chat.title, skipped: true, reason: 'has_title' });
    }

    // Load bookkeeping settings
    const bookkeepingSettings = await loadBookkeepingSettings();

    // Check if bookkeeping and auto-rename are enabled
    if (!bookkeepingSettings.enableBookkeeping || !bookkeepingSettings.autoRenameChats) {
      return res.json({ success: true, skipped: true, reason: 'auto_rename_disabled' });
    }

    const model = bookkeepingSettings.model || 'openai/gpt-4o-mini';

    // Extract messages for context (limit to first 10 messages or 2000 chars)
    const messagesToAnalyze = chat.messages.slice(0, 10);
    let conversationText = messagesToAnalyze
      .map(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        const content = msg.content || (msg.swipes && msg.swipes[msg.swipeIndex || 0]) || '';
        return `${role}: ${content}`;
      })
      .join('\n\n');

    // Truncate if too long
    if (conversationText.length > 2000) {
      conversationText = conversationText.substring(0, 2000) + '...';
    }

    // Build prompt for title generation from settings or use default
    const promptTemplate = bookkeepingSettings.autoNamingPrompt || `Analyze this conversation and generate a short, descriptive title (3-6 words).
The title should capture the main topic, theme, or scenario of the conversation.
Be concise and descriptive. Use title case.

Examples of good titles:
- "Robot Girlfriend Paradox"
- "Coffee Shop Philosophy"
- "Dragon Heist Planning"
- "Late Night Confession"
- "Time Travel Paradox"

Conversation:
{{conversationText}}

Generate a short title (3-6 words) that captures the essence of this conversation.`;

    // Replace placeholders
    const prompt = promptTemplate.replace('{{conversationText}}', conversationText);

    // Build request body with structured output
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'chat_title',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Short descriptive title for the chat (3-6 words)'
              }
            },
            required: ['title'],
            additionalProperties: false
          }
        }
      }
    };

    console.log('\n========== AUTO-NAMING REQUEST ==========');
    console.log('Chat:', req.params.filename);
    console.log('Model:', model);
    console.log('Message count:', chat.messages.length);
    console.log('=========================================\n');

    // Call OpenRouter with structured output
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Choral'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    const generatedTitle = result.title;

    console.log('\n========== AUTO-NAMING RESPONSE ==========');
    console.log('Generated title:', generatedTitle);
    console.log('==========================================\n');

    // Update chat with new title and mark as auto-named
    chat.title = generatedTitle;
    chat.autoNamed = true;

    // Save updated chat
    await fs.writeFile(filePath, JSON.stringify(chat, null, 2));

    res.json({ success: true, title: generatedTitle });
  } catch (error) {
    console.error('Failed to auto-generate chat title:', error);
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

// Narrator character definition (special system character for chat summaries)
const NARRATOR_CHARACTER = {
  filename: '__narrator__',
  name: 'Narrator',
  avatar: '/api/characters/narrator.webp/image',
  data: {
    name: 'Narrator',
    description: 'A neutral narrator that provides summaries of past conversations and events.',
    personality: 'Objective, concise, and informative.',
    scenario: '',
    first_mes: '',
    mes_example: '',
    creator_notes: 'System narrator for chat continuations',
    system_prompt: '',
    post_history_instructions: '',
    tags: ['system', 'narrator'],
    creator: 'Choral System',
    character_version: '1.0',
    alternate_greetings: [],
    extensions: {}
  }
};

// Summarize chat and create new chat with summary (streaming)
app.post('/api/chat/summarize-and-continue', async (req, res) => {
  try {
    const { messages, chatTitle, preset, isGroupChat, characterFilenames, characterFilename, context } = req.body;

    console.log('\n========== SUMMARIZE AND CONTINUE ==========');
    console.log('Chat title:', chatTitle);
    console.log('Is group chat:', isGroupChat);
    console.log('Message count:', messages?.length || 0);
    console.log('Model:', preset?.model);
    console.log('Preset:', preset?.name);
    console.log('Character filenames:', characterFilenames);
    console.log('Character filename:', characterFilename);
    console.log('==========================================\n');

    // Validate input
    if (!messages || messages.length === 0) {
      return res.status(400).json({ error: 'No messages to summarize' });
    }

    if (!preset || !preset.model) {
      return res.status(400).json({ error: 'Preset with model is required' });
    }

    // Build proper message array using preset system prompts
    let summaryMessages = [];

    // Add preset system prompts
    if (preset.prompts && Array.isArray(preset.prompts)) {
      const systemPrompts = preset.prompts
        .filter(p => p.enabled && p.content && p.content.trim())
        .sort((a, b) => a.injection_position - b.injection_position)
        .map(p => ({
          role: 'system',
          content: p.content.trim()
        }));
      summaryMessages.push(...systemPrompts);
    }

    // Add all conversation history, filtering out messages with empty content
    const validMessages = messages
      .map(msg => {
        // Get content from the message (handle swipes)
        let content = msg.content;
        if (!content && msg.swipes && msg.swipes.length > 0) {
          const swipeIndex = msg.swipeIndex !== undefined ? msg.swipeIndex : 0;
          content = msg.swipes[swipeIndex];
        }

        return {
          role: msg.role,
          content: content,
          character: msg.character // Preserve character name for group chats
        };
      })
      .filter(msg => msg.content && msg.content.trim()); // Only include messages with non-empty content

    summaryMessages.push(...validMessages);

    // Add user's "request" to summarize
    summaryMessages.push({
      role: 'user',
      content: 'Please provide a concise summary of this story so far from a neutral narrator\'s perspective. Focus on key events, decisions, character dynamics, and the current situation. Write in third person, past tense. Keep it to 2-4 paragraphs. This summary will be used to continue the story in a new chapter.'
    });

    // Process macros if context provided
    if (context) {
      summaryMessages = processMessagesWithMacros(summaryMessages, context);
    }

    // Apply preset's prompt processing mode
    const processingMode = preset.promptProcessing || 'merge_system';
    const processedMessages = processPrompt(summaryMessages, processingMode, preset);

    console.log('Generating summary with preset:', preset.name);
    console.log('Using model:', preset.model);
    console.log('Message count:', processedMessages.length);

    // Set up SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create new chat metadata (before we have the summary)
    const newTitle = `${chatTitle || 'Chat'} - Continued`;
    const timestamp = Date.now();

    // Keep only the original characters, don't add narrator permanently
    let newCharacterFilenames;
    if (isGroupChat && characterFilenames) {
      // Group chat: keep existing characters only
      newCharacterFilenames = [...characterFilenames];
    } else if (characterFilename) {
      // Single chat: keep as single character (narrator only appears for first message)
      newCharacterFilenames = [characterFilename];
    } else {
      // Fallback: empty (narrator will just appear for the first message)
      newCharacterFilenames = [];
    }

    console.log('New character filenames:', newCharacterFilenames);

    // Send initial chat data with narrator info for the message
    const initialChatData = {
      characterFilenames: newCharacterFilenames,
      messages: [],
      title: newTitle,
      timestamp: timestamp,
      presetFilename: null,
      isGroupChat: isGroupChat || (characterFilenames && characterFilenames.length > 1)
    };

    res.write(`data: ${JSON.stringify({
      type: 'init',
      chatData: initialChatData,
      narrator: NARRATOR_CHARACTER
    })}\n\n`);

    // Stream the summary
    let fullSummary = '';

    const options = {
      temperature: preset.temperature,
      max_tokens: preset.max_tokens,
      top_p: preset.top_p,
      top_k: preset.top_k,
      frequency_penalty: preset.frequency_penalty,
      presence_penalty: preset.presence_penalty,
      repetition_penalty: preset.repetition_penalty
    };

    streamChatCompletion({
      messages: processedMessages,
      model: preset.model,
      options: options,
      onChunk: (content) => {
        fullSummary += content;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content })}\n\n`);
      },
      onComplete: () => {
        console.log('\n========== GENERATED SUMMARY ==========');
        console.log(fullSummary.substring(0, 200) + '...');
        console.log('======================================\n');

        // Send final message with complete summary
        const finalMessage = {
          role: 'assistant',
          character: NARRATOR_CHARACTER.name,
          content: fullSummary,
          timestamp: timestamp,
          swipes: [fullSummary],
          swipeIndex: 0
        };

        res.write(`data: ${JSON.stringify({ type: 'complete', message: finalMessage })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      },
      onError: (error) => {
        console.error('Summary generation error:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      }
    });

  } catch (error) {
    console.error('Failed to summarize and continue chat:', error);
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

// Auto-generate group chat title
app.post('/api/group-chats/:filename/auto-name', async (req, res) => {
  try {
    const filePath = path.join(GROUP_CHATS_DIR, req.params.filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const groupChat = JSON.parse(content);

    // Check if chat has messages
    if (!groupChat.messages || groupChat.messages.length === 0) {
      return res.status(400).json({ error: 'Group chat has no messages to analyze' });
    }

    // Skip if manually named by user (unless force flag is provided)
    if (groupChat.manuallyNamed && !req.body.force) {
      return res.json({ success: true, title: groupChat.title, skipped: true, reason: 'manually_named' });
    }

    // Check if already auto-named (unless force flag is provided)
    if (groupChat.autoNamed && !req.body.force) {
      return res.json({ success: true, title: groupChat.title, skipped: true, reason: 'already_auto_named' });
    }

    // Skip if chat already has a title (unless force flag is provided)
    if (groupChat.title && !req.body.force) {
      return res.json({ success: true, title: groupChat.title, skipped: true, reason: 'has_title' });
    }

    // Load bookkeeping settings
    const bookkeepingSettings = await loadBookkeepingSettings();

    // Check if bookkeeping and auto-rename are enabled
    if (!bookkeepingSettings.enableBookkeeping || !bookkeepingSettings.autoRenameChats) {
      return res.json({ success: true, skipped: true, reason: 'auto_rename_disabled' });
    }

    const model = bookkeepingSettings.model || 'openai/gpt-4o-mini';

    // Extract messages for context (limit to first 10 messages or 2000 chars)
    const messagesToAnalyze = groupChat.messages.slice(0, 10);
    let conversationText = messagesToAnalyze
      .map(msg => {
        const role = msg.role === 'user' ? 'User' : msg.character || 'Assistant';
        const content = msg.content || (msg.swipes && msg.swipes[msg.swipeIndex || 0]) || '';
        return `${role}: ${content}`;
      })
      .join('\n\n');

    // Truncate if too long
    if (conversationText.length > 2000) {
      conversationText = conversationText.substring(0, 2000) + '...';
    }

    // Build prompt for title generation from settings or use default
    // Use the same prompt as regular chats (works for both individual and group chats)
    const promptTemplate = bookkeepingSettings.autoNamingPrompt || `Analyze this conversation and generate a short, descriptive title (3-6 words).
The title should capture the main topic, theme, or scenario of the conversation.
Be concise and descriptive. Use title case.

Examples of good titles:
- "Robot Girlfriend Paradox"
- "Coffee Shop Philosophy"
- "Dragon Heist Planning"
- "Late Night Confession"
- "Time Travel Paradox"

Conversation:
{{conversationText}}

Generate a short title (3-6 words) that captures the essence of this conversation.`;

    // Replace placeholders
    const prompt = promptTemplate.replace('{{conversationText}}', conversationText);

    // Build request body with structured output
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'chat_title',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Short descriptive title for the group chat (3-6 words)'
              }
            },
            required: ['title'],
            additionalProperties: false
          }
        }
      }
    };

    console.log('\n========== AUTO-NAMING REQUEST (GROUP) ==========');
    console.log('Group chat:', req.params.filename);
    console.log('Model:', model);
    console.log('Message count:', groupChat.messages.length);
    console.log('=================================================\n');

    // Call OpenRouter with structured output
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || config.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Choral'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    const generatedTitle = result.title;

    console.log('\n========== AUTO-NAMING RESPONSE (GROUP) ==========');
    console.log('Generated title:', generatedTitle);
    console.log('==================================================\n');

    // Update chat with new title and mark as auto-named
    groupChat.title = generatedTitle;
    groupChat.autoNamed = true;

    // Save updated chat
    await fs.writeFile(filePath, JSON.stringify(groupChat, null, 2));

    res.json({ success: true, title: generatedTitle });
  } catch (error) {
    console.error('Failed to auto-generate group chat title:', error);
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
          const persona = JSON.parse(content);
          // Return persona data along with the actual filename
          return {
            ...persona,
            _filename: file
          };
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

    // Use nickname as the unique identifier for filenames
    // If no nickname, fall back to name for backward compatibility
    const identifier = persona.nickname || persona.name;

    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ error: 'Persona must have a nickname or name' });
    }

    const filename = `${identifier}.json`;
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

// Helper function to convert SillyTavern lorebook format to Choral format
function convertSillyTavernLorebook(lorebook) {
  // If entries is already an array, it's in Choral format
  if (Array.isArray(lorebook.entries)) {
    return lorebook;
  }

  // Convert SillyTavern format (entries as object) to Choral format (entries as array)
  const entries = [];
  if (lorebook.entries && typeof lorebook.entries === 'object') {
    for (const key in lorebook.entries) {
      const entry = lorebook.entries[key];
      const choralEntry = {
        name: entry.comment || entry.key?.[0] || 'Entry',
        enabled: !entry.disable,
        constant: entry.constant || false,
        keys: Array.isArray(entry.key) ? entry.key : [],
        keysInput: Array.isArray(entry.key) ? entry.key.join(', ') : '',
        regex: entry.regex || '',
        content: entry.content || '',
        priority: entry.order || entry.priority || 0
      };
      entries.push(choralEntry);
    }
  }

  // Extract name and scan depth from various locations
  const name = lorebook.originalData?.name || lorebook.name || 'Unnamed Lorebook';
  const scanDepth = lorebook.originalData?.scan_depth || lorebook.scanDepth || lorebook.scan_depth || 0;

  return {
    name: name,
    autoSelect: lorebook.autoSelect || false,
    matchTags: lorebook.matchTags || '',
    scanDepth: scanDepth,
    entries: entries
  };
}

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
          let lorebook = JSON.parse(content);

          // Auto-convert SillyTavern format to Choral format
          lorebook = convertSillyTavernLorebook(lorebook);

          return {
            filename: file,
            ...lorebook
          };
        } catch (err) {
          console.error(`Error loading lorebook ${file}:`, err);
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
    let lorebook = JSON.parse(content);

    // Auto-convert SillyTavern format to Choral format
    lorebook = convertSillyTavernLorebook(lorebook);

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

// Import lorebook
app.post('/api/lorebooks/import', async (req, res) => {
  try {
    const importedLorebook = req.body;

    // Extract name from various possible locations (prioritize originalData)
    const lorebookName =
      importedLorebook.originalData?.name ||
      importedLorebook.name ||
      'Imported Lorebook';

    // Extract scan depth from various locations
    const scanDepth =
      importedLorebook.originalData?.scan_depth ||
      importedLorebook.scanDepth ||
      importedLorebook.scan_depth ||
      0;

    // Convert entries object to Choral entries array
    const entries = [];
    if (importedLorebook.entries) {
      const entriesObj = importedLorebook.entries;
      for (const key in entriesObj) {
        const entry = entriesObj[key];

        // Map to Choral fields, keep only supported ones
        const choralEntry = {
          name: entry.comment || entry.key?.[0] || 'Entry',
          enabled: !entry.disable,
          constant: entry.constant || false,
          keys: Array.isArray(entry.key) ? entry.key : [],
          keysInput: Array.isArray(entry.key) ? entry.key.join(', ') : '',
          regex: entry.regex || '',
          content: entry.content || '',
          priority: entry.order || entry.priority || 0
        };

        entries.push(choralEntry);
      }
    }

    // Create Choral lorebook format
    const choralLorebook = {
      name: lorebookName,
      autoSelect: importedLorebook.autoSelect || false,
      matchTags: importedLorebook.matchTags || '',
      scanDepth: scanDepth,
      entries: entries
    };

    // Generate unique filename
    let baseFilename = choralLorebook.name.replace(/[^a-zA-Z0-9 ]/g, '_');
    let filename = `${baseFilename}.json`;
    let filePath = path.join(LOREBOOKS_DIR, filename);
    let counter = 1;

    // Check for existing files and add counter if needed
    while (await fs.access(filePath).then(() => true).catch(() => false)) {
      filename = `${baseFilename}_${counter}.json`;
      filePath = path.join(LOREBOOKS_DIR, filename);
      counter++;
    }

    await fs.writeFile(filePath, JSON.stringify(choralLorebook, null, 2));
    res.json({ success: true, filename, lorebook: choralLorebook });
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

// ===== Core Tags Routes =====

// Get core tags
app.get('/api/core-tags', async (req, res) => {
  try {
    const coreTags = await loadCoreTags();
    res.json(coreTags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save core tags
app.post('/api/core-tags', async (req, res) => {
  try {
    const coreTags = req.body;
    await saveCoreTags(coreTags);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Bookkeeping Settings Routes =====

// Get bookkeeping settings
app.get('/api/bookkeeping-settings', async (req, res) => {
  try {
    const settings = await loadBookkeepingSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save bookkeeping settings
app.post('/api/bookkeeping-settings', async (req, res) => {
  try {
    const settings = req.body;
    await saveBookkeepingSettings(settings);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Config Routes =====

app.get('/api/config', (req, res) => {
  res.json({
    port: config.port || 3000,
    hasApiKey: !!(config.openRouterApiKey || process.env.OPENROUTER_API_KEY),
    activePreset: config.activePreset || 'default.json',
    defaultPersona: config.defaultPersona || null
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

// Set default persona
app.post('/api/config/default-persona', async (req, res) => {
  try {
    const { persona } = req.body;

    // Update config
    config.defaultPersona = persona;

    // Save config to disk
    const configPath = path.join(__dirname, '..', 'config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    res.json({ success: true, defaultPersona: persona });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Tool Settings Routes =====

// Get tool settings
app.get('/api/tool-settings', async (req, res) => {
  try {
    const settings = await loadToolSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save tool settings
app.post('/api/tool-settings', async (req, res) => {
  try {
    const settings = req.body;
    await saveToolSettings(settings);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Tool Calling Routes =====

// Tool schema definition for create_character_card
const CREATE_CHARACTER_TOOL_SCHEMA = {
  type: 'function',
  function: {
    name: 'create_character_card',
    description: 'Creates a new character card. You can create a minimal card with just a name and greeting, then use update_character_card to add details later. This allows iterative character creation.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The character\'s name (required)'
        },
        description: {
          type: 'string',
          description: 'Detailed character description (physical appearance, personality, background, motivations, etc.). Can be added later via update.'
        },
        personality: {
          type: 'string',
          description: 'Brief personality summary or traits. Can be added later via update.'
        },
        scenario: {
          type: 'string',
          description: 'The setting or scenario for interactions. Can be added later via update.'
        },
        first_mes: {
          type: 'string',
          description: 'The character\'s first greeting message. Can use a placeholder like "Hello..." and update later.'
        },
        mes_example: {
          type: 'string',
          description: 'Example dialogue formatted as: <START>\\n{{user}}: question\\n{{char}}: *narration* and dialogue response. Can be added later via update.'
        },
        alternate_greetings: {
          type: 'array',
          items: { type: 'string' },
          description: 'Alternative greeting messages. Can be added later via update.'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Character tags (genre, setting, personality traits, themes). Can be added later via update.'
        },
        creator_notes: {
          type: 'string',
          description: 'Notes for users about how to use the character. Can be added later via update.'
        },
        system_prompt: {
          type: 'string',
          description: 'System-level instructions for the AI. Can be added later via update.'
        },
        post_history_instructions: {
          type: 'string',
          description: 'Instructions that appear after chat history. Can be added later via update.'
        },
        image_prompt: {
          type: 'string',
          description: 'Comma-separated tags for generating character image (e.g., "woman,long hair,blue eyes,fantasy,elegant"). Can be added later via update.'
        }
      },
      required: ['name', 'first_mes']
    }
  }
};

// Tool schema for add_greetings
const ADD_GREETINGS_TOOL_SCHEMA = {
  type: 'function',
  function: {
    name: 'add_greetings',
    description: 'Adds one or more alternate greeting messages to an existing character card. New greetings are appended to the existing alternate_greetings array.\n\nAvailable characters in this chat:\n{{characters_list}}',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The character filename (e.g., "Alice.png") - see available characters list above'
        },
        greetings: {
          type: 'array',
          items: { type: 'string' },
          description: 'One or more new greeting messages to add to the character\'s alternate greetings'
        }
      },
      required: ['filename', 'greetings']
    }
  }
};

// Tool schema for update_character_card
const UPDATE_CHARACTER_TOOL_SCHEMA = {
  type: 'function',
  function: {
    name: 'update_character_card',
    description: 'Updates an existing character card. Only provided fields will be updated; existing data is preserved.\n\nAvailable characters in this chat:\n{{characters_list}}',
    parameters: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The character filename (e.g., "Alice.png") - see available characters list above'
        },
        description: {
          type: 'string',
          description: 'Updated character description'
        },
        personality: {
          type: 'string',
          description: 'Updated personality summary'
        },
        scenario: {
          type: 'string',
          description: 'Updated scenario'
        },
        first_mes: {
          type: 'string',
          description: 'Updated first greeting'
        },
        mes_example: {
          type: 'string',
          description: 'Updated example dialogue'
        },
        alternate_greetings: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated alternative greetings (replaces existing array)'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated tags (replaces existing array)'
        },
        creator_notes: {
          type: 'string',
          description: 'Updated creator notes'
        },
        system_prompt: {
          type: 'string',
          description: 'Updated system prompt'
        },
        post_history_instructions: {
          type: 'string',
          description: 'Updated post-history instructions'
        },
        image_prompt: {
          type: 'string',
          description: 'Comma-separated tags for generating new character image'
        }
      },
      required: ['filename']
    }
  }
};

// Get all available tools (for settings UI)
app.get('/api/tools/available', (req, res) => {
  res.json({
    tools: [
      {
        id: 'create_character_card',
        name: 'Create Character Card',
        description: 'Allows the character to create new character cards',
        schema: CREATE_CHARACTER_TOOL_SCHEMA
      },
      {
        id: 'update_character_card',
        name: 'Update Character Card',
        description: 'Allows the character to update existing character cards',
        schema: UPDATE_CHARACTER_TOOL_SCHEMA
      },
      {
        id: 'add_greetings',
        name: 'Add Greetings',
        description: 'Allows the character to add alternate greetings to existing character cards',
        schema: ADD_GREETINGS_TOOL_SCHEMA
      }
    ]
  });
});

// Get tool schemas for a specific character (used during chat)
app.get('/api/tools/schemas/:characterFilename', async (req, res) => {
  try {
    const characterFilename = req.params.characterFilename;
    const toolSettings = await loadToolSettings();

    console.log('\n========== TOOL SCHEMA REQUEST ==========');
    console.log('Character filename:', characterFilename);
    console.log('Tool calling enabled:', toolSettings.enableToolCalling);
    console.log('Character tools config:', JSON.stringify(toolSettings.characterTools, null, 2));

    if (!toolSettings.enableToolCalling) {
      console.log('Tool calling is disabled globally');
      return res.json({ tools: [] });
    }

    // Find character's allowed tools
    const charConfig = toolSettings.characterTools.find(
      ct => ct.characterFilename === characterFilename
    );

    console.log('Found character config:', charConfig);

    if (!charConfig || !charConfig.tools || charConfig.tools.length === 0) {
      console.log('No tools configured for this character');
      return res.json({ tools: [] });
    }

    // Build tool schemas for allowed tools
    // Note: We return raw schemas with {{characters_list}} placeholder
    // The macro will be expanded by the chat routes when they have context
    const tools = [];
    if (charConfig.tools.includes('create_character_card')) {
      tools.push(CREATE_CHARACTER_TOOL_SCHEMA);
      console.log('Added create_character_card tool');
    }
    if (charConfig.tools.includes('update_character_card')) {
      tools.push(UPDATE_CHARACTER_TOOL_SCHEMA);
      console.log('Added update_character_card tool');
    }
    if (charConfig.tools.includes('add_greetings')) {
      tools.push(ADD_GREETINGS_TOOL_SCHEMA);
      console.log('Added add_greetings tool');
    }

    console.log('Returning tools:', tools.map(t => t.function.name));
    console.log('Note: {{characters_list}} macro will be expanded by chat routes with context');
    console.log('=========================================\n');

    res.json({ tools });
  } catch (error) {
    console.error('Error getting tool schemas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute create_character_card tool
app.post('/api/tools/create-character', async (req, res) => {
  try {
    const params = req.body;

    // Validate required fields (only name and first_mes are required)
    if (!params.name || !params.first_mes) {
      return res.status(400).json({
        error: 'Missing required fields: name and first_mes are required'
      });
    }

    // Build Character Card V3 object
    const cardData = {
      spec: 'chara_card_v3',
      spec_version: '3.0',
      data: {
        name: params.name,
        description: params.description || '',
        personality: params.personality || '',
        scenario: params.scenario || '',
        first_mes: params.first_mes,
        mes_example: params.mes_example || '<START>',
        creator_notes: params.creator_notes || '',
        system_prompt: params.system_prompt || '',
        post_history_instructions: params.post_history_instructions || '',
        tags: params.tags || [],
        creator: 'Character Card Builder',
        character_version: '1.0',
        alternate_greetings: params.alternate_greetings || [],
        extensions: {},
        group_only_greetings: []
      }
    };

    // Generate unique filename
    const filename = await getUniqueFilename(`${params.name}.png`, CHARACTERS_DIR);
    const destPath = path.join(CHARACTERS_DIR, filename);

    // Handle character image
    let imageBuffer = null;
    if (params.image_prompt) {
      try {
        console.log(`Generating character image with prompt: ${params.image_prompt}`);
        const imageUrl = `http://192.168.1.100:3000/generate/character/${encodeURIComponent(params.image_prompt)}`;
        const imageResponse = await fetch(imageUrl);

        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
          console.log('Character image generated successfully');
        } else {
          console.warn('Failed to generate character image, using default');
        }
      } catch (err) {
        console.error('Error generating character image:', err);
        // Continue with default image
      }
    }

    // Write character card
    await writeCharacterCard(destPath, cardData, imageBuffer);

    console.log(`Created character card: ${filename}`);

    res.json({
      success: true,
      filename,
      name: params.name,
      message: `Successfully created character: ${params.name}`
    });
  } catch (error) {
    console.error('Error creating character:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute add_greetings tool
app.post('/api/tools/add-greetings', async (req, res) => {
  try {
    const { filename, greetings } = req.body;

    if (!filename) {
      return res.status(400).json({
        error: 'Missing required field: filename'
      });
    }

    if (!Array.isArray(greetings) || greetings.length === 0) {
      return res.status(400).json({
        error: 'Missing required field: greetings must be a non-empty array'
      });
    }

    const filePath = path.join(CHARACTERS_DIR, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        error: `Character not found: ${filename}`
      });
    }

    // Read existing character card
    const card = await readCharacterCard(filePath);

    // Ensure alternate_greetings array exists
    if (!Array.isArray(card.data.alternate_greetings)) {
      card.data.alternate_greetings = [];
    }

    // Append new greetings
    card.data.alternate_greetings.push(...greetings);

    // Read existing PNG buffer
    const imageBuffer = await fs.readFile(filePath);

    // Write updated character card
    await writeCharacterCard(filePath, card, imageBuffer);

    console.log(`Added ${greetings.length} greeting(s) to character: ${filename}`);

    res.json({
      success: true,
      filename,
      addedCount: greetings.length,
      totalGreetings: card.data.alternate_greetings.length,
      message: `Successfully added ${greetings.length} greeting(s) to ${card.data.name}`
    });
  } catch (error) {
    console.error('Error adding greetings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute update_character_card tool
app.post('/api/tools/update-character', async (req, res) => {
  try {
    const params = req.body;

    if (!params.filename) {
      return res.status(400).json({
        error: 'Missing required field: filename'
      });
    }

    const filePath = path.join(CHARACTERS_DIR, params.filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        error: `Character not found: ${params.filename}`
      });
    }

    // Read existing character card
    const card = await readCharacterCard(filePath);

    // Update only provided fields (merge semantics)
    if (params.description !== undefined) card.data.description = params.description;
    if (params.personality !== undefined) card.data.personality = params.personality;
    if (params.scenario !== undefined) card.data.scenario = params.scenario;
    if (params.first_mes !== undefined) card.data.first_mes = params.first_mes;
    if (params.mes_example !== undefined) card.data.mes_example = params.mes_example;
    if (params.alternate_greetings !== undefined) card.data.alternate_greetings = params.alternate_greetings;
    if (params.tags !== undefined) card.data.tags = params.tags;
    if (params.creator_notes !== undefined) card.data.creator_notes = params.creator_notes;
    if (params.system_prompt !== undefined) card.data.system_prompt = params.system_prompt;
    if (params.post_history_instructions !== undefined) card.data.post_history_instructions = params.post_history_instructions;

    // Handle image update if requested
    let imageBuffer = null;
    if (params.image_prompt) {
      try {
        console.log(`Generating updated character image with prompt: ${params.image_prompt}`);
        const imageUrl = `http://192.168.1.100:3000/generate/character/${encodeURIComponent(params.image_prompt)}`;
        const imageResponse = await fetch(imageUrl);

        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
          console.log('Updated character image generated successfully');
        } else {
          console.warn('Failed to generate updated character image, keeping existing');
        }
      } catch (err) {
        console.error('Error generating updated character image:', err);
        // Continue with existing image
      }
    }

    // If no new image, read existing PNG buffer
    if (!imageBuffer) {
      imageBuffer = await fs.readFile(filePath);
    }

    // Write updated character card
    await writeCharacterCard(filePath, card, imageBuffer);

    console.log(`Updated character card: ${params.filename}`);

    res.json({
      success: true,
      filename: params.filename,
      message: `Successfully updated character: ${card.data.name}`
    });
  } catch (error) {
    console.error('Error updating character:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== Chat Completion Routes =====

// Stream chat completion
app.post('/api/chat/stream', async (req, res) => {
  const { messages, model, options, context, promptProcessing, lorebookFilenames, debug, tools } = req.body;

  // Process macros in messages if context provided
  let processedMessages = context
    ? processMessagesWithMacros(messages, context)
    : messages;

  // Process macros in tool descriptions if tools and context provided
  let processedTools = tools;
  if (tools && context) {
    processedTools = tools.map(tool => {
      const processedTool = JSON.parse(JSON.stringify(tool)); // Deep clone
      processedTool.function.description = processMacros(
        processedTool.function.description,
        context,
        false // Don't remove comments for tool descriptions
      );
      return processedTool;
    });
    console.log('Processed {{characters_list}} macro in tool descriptions');
  }

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
          let lorebook = JSON.parse(lorebookContent);

          // Auto-convert SillyTavern format to Choral format
          lorebook = convertSillyTavernLorebook(lorebook);

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
    tools: processedTools, // Pass processed tools with expanded macros
    onChunk: (content) => {
      fullResponse += content;
      logStreamChunk(content);
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    },
    onToolCall: async (toolCall) => {
      try {
        console.log('Tool call detected:', JSON.stringify(toolCall, null, 2));

        // Send tool call notification to client
        res.write(`data: ${JSON.stringify({ type: 'tool_call', toolCall })}\n\n`);

        // Determine which tool endpoint to call
        let toolEndpoint;
        if (toolCall.function.name === 'create_character_card') {
          toolEndpoint = 'http://localhost:3000/api/tools/create-character';
        } else if (toolCall.function.name === 'update_character_card') {
          toolEndpoint = 'http://localhost:3000/api/tools/update-character';
        } else if (toolCall.function.name === 'add_greetings') {
          toolEndpoint = 'http://localhost:3000/api/tools/add-greetings';
        }

        if (toolEndpoint) {
          const params = JSON.parse(toolCall.function.arguments);

          // Call the tool endpoint
          const toolResponse = await fetch(toolEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });

          const result = await toolResponse.json();

          console.log('Tool execution result:', result);

          // Send tool result to client
          res.write(`data: ${JSON.stringify({
            type: 'tool_result',
            toolCallId: toolCall.id,
            result: result
          })}\n\n`);
        }
      } catch (error) {
        console.error('Tool execution error:', error);
        res.write(`data: ${JSON.stringify({
          type: 'tool_error',
          error: error.message
        })}\n\n`);
      }
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
    const { messages, model, options, context, promptProcessing, lorebookFilenames, tools } = req.body;

    // Process macros in messages if context provided
    let processedMessages = context
      ? processMessagesWithMacros(messages, context)
      : messages;

    // Process macros in tool descriptions if tools and context provided
    let processedTools = tools;
    if (tools && context) {
      processedTools = tools.map(tool => {
        const processedTool = JSON.parse(JSON.stringify(tool)); // Deep clone
        processedTool.function.description = processMacros(
          processedTool.function.description,
          context,
          false // Don't remove comments for tool descriptions
        );
        return processedTool;
      });
      console.log('Processed {{characters_list}} macro in tool descriptions');
    }

    // Process lorebooks if provided
    if (lorebookFilenames && Array.isArray(lorebookFilenames) && lorebookFilenames.length > 0) {
      try {
        let allMatchedEntries = [];

        // Process each lorebook
        for (const lorebookFilename of lorebookFilenames) {
          try {
            const lorebookPath = path.join(LOREBOOKS_DIR, lorebookFilename);
            const lorebookContent = await fs.readFile(lorebookPath, 'utf-8');
            let lorebook = JSON.parse(lorebookContent);

            // Auto-convert SillyTavern format to Choral format
            lorebook = convertSillyTavernLorebook(lorebook);

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

    const response = await chatCompletion({ messages: processedMessages, model, options, tools: processedTools });

    // Check if response contains tool calls
    if (typeof response === 'object' && response.tool_calls) {
      const toolCall = response.tool_calls[0];

      console.log('Tool call detected:', JSON.stringify(toolCall, null, 2));

      // Determine which tool endpoint to call
      let toolEndpoint;
      if (toolCall.function.name === 'create_character_card') {
        toolEndpoint = 'http://localhost:3000/api/tools/create-character';
      } else if (toolCall.function.name === 'update_character_card') {
        toolEndpoint = 'http://localhost:3000/api/tools/update-character';
      } else if (toolCall.function.name === 'add_greetings') {
        toolEndpoint = 'http://localhost:3000/api/tools/add-greetings';
      }

      if (toolEndpoint) {
        try {
          const params = JSON.parse(toolCall.function.arguments);

          // Call the tool endpoint
          const toolResponse = await fetch(toolEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });

          const result = await toolResponse.json();

          console.log('Tool execution result:', result);

          // Log and return the result
          logResponse({ tool_call: toolCall, tool_result: result });

          res.json({
            type: 'tool_call',
            toolCall: toolCall,
            result: result
          });
        } catch (error) {
          console.error('Tool execution error:', error);
          logResponse({ error: error.message });
          res.status(500).json({ error: error.message });
        }
      }
    } else {
      // Normal text response
      const content = typeof response === 'string' ? response : response.content;

      // Log the response
      logResponse({ content });

      res.json({ content });
    }
  } catch (error) {
    logResponse({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = config.port || process.env.PORT || 3000;
ensureDirectories().then(() => {
  app.listen(PORT, () => {
    console.log(`Choral server running on port ${PORT}`);
    if (!config.openRouterApiKey && !process.env.OPENROUTER_API_KEY) {
      console.warn('\nWARNING: No OpenRouter API key configured!');
      console.warn('Set OPENROUTER_API_KEY environment variable or add it to config.json\n');
    }
  });
});
