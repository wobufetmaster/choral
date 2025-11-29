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
const createToolRouter = require('./routes/tools');

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
    streamChatCompletion,
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

  // Mount tool routes
  const toolRouter = createToolRouter({
    CHARACTERS_DIR,
    loadToolSettings
  });
  app.use('/api/tools', toolRouter);



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
          const port = process.env.PORT || 3003;
          let toolEndpoint;
          if (toolCall.function.name === 'create_character_card') {
            toolEndpoint = `http://localhost:${port}/api/tools/create-character`;
          } else if (toolCall.function.name === 'update_character_card') {
            toolEndpoint = `http://localhost:${port}/api/tools/update-character`;
          } else if (toolCall.function.name === 'add_greetings') {
            toolEndpoint = `http://localhost:${port}/api/tools/add-greetings`;
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
        const port = process.env.PORT || 3003;
        let toolEndpoint;
        if (toolCall.function.name === 'create_character_card') {
          toolEndpoint = `http://localhost:${port}/api/tools/create-character`;
        } else if (toolCall.function.name === 'update_character_card') {
          toolEndpoint = `http://localhost:${port}/api/tools/update-character`;
        } else if (toolCall.function.name === 'add_greetings') {
          toolEndpoint = `http://localhost:${port}/api/tools/add-greetings`;
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
