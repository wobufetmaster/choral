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
const { performBackup, isBackupInProgress } = require('./backup');
const errorHandler = require('./middleware/errorHandler');
const { loadJSON, saveJSON } = require('./utils/fileService');
const createCharacterRouter = require('./routes/characters');
const createChatRouter = require('./routes/chats');
const createGroupChatRouter = require('./routes/group-chats');
const createPersonaRouter = require('./routes/personas');
const createLorebookRouter = require('./routes/lorebooks');
const createPresetRouter = require('./routes/presets');
const createConfigRouter = require('./routes/config');

/**
 * Create Express app with given configuration
 * @param {Object} config - Server configuration
 * @param {string} config.dataDir - Data directory path
 * @param {string} config.openRouterApiKey - OpenRouter API key
 * @param {string} config.activePreset - Active preset filename
 * @returns {Object} Object containing app and ensureDirectories function
 */
function createApp(config) {
  // Create defensive copy to prevent test pollution
  const localConfig = { ...config };

  const app = express();
  const upload = multer({ dest: localConfig.uploadDir || 'uploads/' });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Serve documentation
  app.use('/docs', express.static(path.join(__dirname, '../docs')));

  const configPath = localConfig.configPath || path.join(__dirname, '..', 'config.json');
  const DATA_DIR = path.resolve(localConfig.dataDir || './data');
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
const loadTags = () => loadJSON(TAGS_FILE, {});
const saveTags = (tags) => saveJSON(TAGS_FILE, tags);

// Core tags management (global tags that can't be removed from characters)
const loadCoreTags = () => loadJSON(CORE_TAGS_FILE, []);
const saveCoreTags = (coreTags) => saveJSON(CORE_TAGS_FILE, coreTags);

// Bookkeeping settings management
const loadBookkeepingSettings = () => loadJSON(BOOKKEEPING_SETTINGS_FILE, {
  enableBookkeeping: false,
  autoRenameChats: false,
  model: localConfig.bookkeepingModel || 'openai/gpt-4o-mini',
  strictMode: false
});
const saveBookkeepingSettings = (settings) => saveJSON(BOOKKEEPING_SETTINGS_FILE, settings);

// Tool settings management
const loadToolSettings = () => loadJSON(TOOL_SETTINGS_FILE, {
  enableToolCalling: true,
  characterTools: []
});
const saveToolSettings = (settings) => saveJSON(TOOL_SETTINGS_FILE, settings);

function normalizeTag(tag) {
  return tag.toLowerCase().trim();
}

// Normalize message content to array format for OpenRouter multimodal API
function normalizeMessageContent(message) {
  // If content is already an array, pass through
  if (Array.isArray(message.content)) {
    return { ...message, content: message.content };
  }

  // If string, convert to array format
  if (typeof message.content === 'string') {
    return {
      ...message,
      content: [{ type: 'text', text: message.content }],
    };
  }

  // Otherwise, pass through unchanged
  return message;
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

// Helper function to validate and sanitize character data
function validateCharacterData(char, filename) {
  if (!char) {
    console.warn(`[Character Validation] Null character for file: ${filename}`);
    return null;
  }

  // Ensure required fields exist and are valid
  const validated = {
    filename: filename || 'unknown.png',
    name: null,
    tags: [],
    data: char.data || {},
    createdAt: char.createdAt || Date.now(),
    modifiedAt: char.modifiedAt || Date.now()
  };

  // Validate and sanitize name
  if (char.name && typeof char.name === 'string') {
    validated.name = char.name.trim();
  } else if (char.data?.name && typeof char.data.name === 'string') {
    validated.name = char.data.name.trim();
  } else {
    console.warn(`[Character Validation] Invalid name for ${filename}, using filename`);
    validated.name = filename.replace('.png', '');
  }

  // Validate and sanitize tags
  if (Array.isArray(char.tags)) {
    validated.tags = char.tags
      .filter(tag => tag && typeof tag === 'string')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  } else if (char.data?.tags && Array.isArray(char.data.tags)) {
    validated.tags = char.data.tags
      .filter(tag => tag && typeof tag === 'string')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  // Ensure data object exists
  if (!validated.data || typeof validated.data !== 'object') {
    console.warn(`[Character Validation] Invalid data object for ${filename}`);
    validated.data = { name: validated.name };
  }

  return validated;
}

// Mount character routes
const characterRouter = createCharacterRouter({
  CHARACTERS_DIR,
  upload,
  loadTags,
  saveTags,
  loadCoreTags,
  normalizeTag
});
app.use('/api/characters', characterRouter);

// Mount chat routes
const chatRouter = createChatRouter({
  CHATS_DIR,
  chatCompletion,
  processMacros
});
app.use('/api/chats', chatRouter);
app.use('/api/chat', chatRouter); // For /api/chat/summarize-and-continue

// Mount group chat routes
const groupChatRouter = createGroupChatRouter({
  GROUP_CHATS_DIR,
  loadBookkeepingSettings,
  config: localConfig
});
app.use('/api/group-chats', groupChatRouter);

// Mount persona routes
const personaRouter = createPersonaRouter({
  PERSONAS_DIR
});
app.use('/api/personas', personaRouter);

// Mount lorebook routes
const lorebookRouter = createLorebookRouter({
  LOREBOOKS_DIR
});
app.use('/api/lorebooks', lorebookRouter);

// Helper function to convert SillyTavern lorebook format to Choral format
// (used by streaming/non-streaming chat routes for lorebook processing)
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

// Mount preset routes
const presetRouter = createPresetRouter({
  PRESETS_DIR,
  validatePreset,
  convertPixiJBToPreset
});
app.use('/api/presets', presetRouter);

// Mount config router (includes tags, bookkeeping, tool-settings, backup)
const configRouter = createConfigRouter({
  loadTags,
  saveTags,
  loadCoreTags,
  saveCoreTags,
  loadBookkeepingSettings,
  saveBookkeepingSettings,
  loadToolSettings,
  saveToolSettings,
  config: localConfig,
  configPath,
  performBackup,
  isBackupInProgress
});
app.use('/api', configRouter);

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
      message: `Successfully created character: ${params.name}`,
      details: `Character file: ${filename}. You must use this exact filename when referencing this character in other tool calls.`
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
      characterName: card.data.name,
      addedCount: greetings.length,
      addedGreetings: greetings,
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
      characterName: card.data.name,
      updatedFields: Object.keys(params).filter(k => k !== 'filename' && params[k] !== undefined),
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
  const { messages, model, options, context, promptProcessing, lorebookFilenames, debug, tools, stoppingStrings } = req.body;

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

  // Normalize all messages to array format for multimodal support FIRST
  // This must happen before prompt processing so the processor can handle array content
  processedMessages = processedMessages.map(normalizeMessageContent);

  // Apply prompt post-processing
  const processingMode = promptProcessing || 'merge_system';
  const normalizedMessages = processPrompt(processedMessages, processingMode, options);

  // Add processed messages to debug info
  debugInfo.processedMessages = normalizedMessages;

  // Log the request
  logRequest({
    model,
    messages: normalizedMessages,
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
    messages: normalizedMessages,
    model,
    options,
    tools: processedTools, // Pass processed tools with expanded macros
    stoppingStrings: stoppingStrings || [],
    onChunk: (content) => {
      fullResponse += content;
      logStreamChunk(content);
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    },
    onStop: (finalText) => {
      console.log('Generation stopped due to stopping string. Final text length:', finalText.length);
      res.write(`data: ${JSON.stringify({ type: 'stopped', reason: 'stopping_string' })}\n\n`);
    },
    onToolCallStart: (toolName) => {
      // Notify client as soon as we detect tool call is starting to stream
      console.log('Tool call starting:', toolName);
      res.write(`data: ${JSON.stringify({ type: 'tool_call_start', toolName })}\n\n`);
    },
    onImages: (images) => {
      // Handle AI-generated images from OpenRouter response
      console.log('AI-generated images received:', images.length);
      res.write(`data: ${JSON.stringify({ type: 'images', images })}\n\n`);
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

    // Normalize all messages to array format for multimodal support FIRST
    // This must happen before prompt processing so the processor can handle array content
    processedMessages = processedMessages.map(normalizeMessageContent);

    // Apply prompt post-processing
    const processingMode = promptProcessing || 'merge_system';
    const normalizedMessages = processPrompt(processedMessages, processingMode, options);

    // Log the request
    logRequest({
      model,
      messages: normalizedMessages,
      options,
      context,
      promptProcessing: processingMode,
      lorebooks: lorebookFilenames || [],
      streaming: false
    });

    const response = await chatCompletion({ messages: normalizedMessages, model, options, tools: processedTools });

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

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return { app, ensureDirectories };
}

module.exports = { createApp };
