const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { readCharacterCard, writeCharacterCard } = require('../characterCard');

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

/**
 * Helper to get a unique filename
 * @param {string} desiredFilename
 * @param {string} directory
 * @returns {Promise<string>}
 */
async function getUniqueFilename(desiredFilename, directory) {
  let filename = desiredFilename;
  let counter = 1;
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);

  while (true) {
    try {
      await fs.access(path.join(directory, filename));
      // File exists, try next
      filename = `${name}_${counter}${ext}`;
      counter++;
    } catch {
      // File doesn't exist, use this one
      return filename;
    }
  }
}

/**
 * Create tool router
 * @param {Object} dependencies
 * @param {string} dependencies.CHARACTERS_DIR
 * @param {Function} dependencies.loadToolSettings
 * @param {Function} dependencies.loadTags
 * @param {Function} dependencies.saveTags
 * @param {Function} dependencies.loadCoreTags
 * @param {Function} dependencies.normalizeTag
 * @returns {Router}
 */
function createToolRouter({ CHARACTERS_DIR, loadToolSettings, loadTags, saveTags, loadCoreTags, normalizeTag }) {
  const router = express.Router();

  // Get all available tools (for settings UI)
  router.get('/available', (req, res) => {
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
  router.get('/schemas/:characterFilename', async (req, res) => {
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
  router.post('/create-character', async (req, res) => {
    try {
      const params = req.body;

      // Validate required fields (only name and first_mes are required)
      if (!params.name || !params.first_mes) {
        return res.status(400).json({
          error: 'Missing required fields: name and first_mes are required'
        });
      }

      // Process tags: normalize and ensure core tags are included
      const coreTags = await loadCoreTags();
      const normalizedCoreTags = coreTags.map(normalizeTag);
      const providedTags = (params.tags || []).map(normalizeTag);
      const finalTags = [...new Set([...normalizedCoreTags, ...providedTags])];

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
          tags: finalTags,
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

      // Write character card (uses default placeholder image)
      await writeCharacterCard(destPath, cardData, null);

      // Update global tag registry
      const allTags = await loadTags();
      finalTags.forEach(tag => {
        const existingData = allTags[tag];
        if (!existingData || typeof existingData === 'string') {
          allTags[tag] = {
            characters: [],
            color: typeof existingData === 'string' ? existingData : undefined
          };
        } else if (!existingData.characters) {
          allTags[tag].characters = [];
        }
        if (!allTags[tag].characters.includes(filename)) {
          allTags[tag].characters.push(filename);
        }
      });
      await saveTags(allTags);

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
  router.post('/add-greetings', async (req, res) => {
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
  router.post('/update-character', async (req, res) => {
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
      const oldTags = card.data.tags || [];

      // Update only provided fields (merge semantics)
      if (params.description !== undefined) card.data.description = params.description;
      if (params.personality !== undefined) card.data.personality = params.personality;
      if (params.scenario !== undefined) card.data.scenario = params.scenario;
      if (params.first_mes !== undefined) card.data.first_mes = params.first_mes;
      if (params.mes_example !== undefined) card.data.mes_example = params.mes_example;
      if (params.alternate_greetings !== undefined) card.data.alternate_greetings = params.alternate_greetings;
      if (params.creator_notes !== undefined) card.data.creator_notes = params.creator_notes;
      if (params.system_prompt !== undefined) card.data.system_prompt = params.system_prompt;
      if (params.post_history_instructions !== undefined) card.data.post_history_instructions = params.post_history_instructions;

      // Handle tags update with core tag enforcement
      let finalTags = oldTags;
      if (params.tags !== undefined) {
        const coreTags = await loadCoreTags();
        const normalizedCoreTags = coreTags.map(normalizeTag);
        const providedTags = params.tags.map(normalizeTag);
        finalTags = [...new Set([...normalizedCoreTags, ...providedTags])];
        card.data.tags = finalTags;

        // Update global tag registry
        const allTags = await loadTags();

        // Add character to new tags
        finalTags.forEach(tag => {
          const existingData = allTags[tag];
          if (!existingData || typeof existingData === 'string') {
            allTags[tag] = {
              characters: [],
              color: typeof existingData === 'string' ? existingData : undefined
            };
          } else if (!existingData.characters) {
            allTags[tag].characters = [];
          }
          if (!allTags[tag].characters.includes(params.filename)) {
            allTags[tag].characters.push(params.filename);
          }
        });

        // Remove character from old tags it no longer has
        for (const [tag, data] of Object.entries(allTags)) {
          if (typeof data === 'string' || !data.characters) {
            continue;
          }
          if (!finalTags.includes(tag) && data.characters.includes(params.filename)) {
            data.characters = data.characters.filter(f => f !== params.filename);
            if (data.characters.length === 0 && !normalizedCoreTags.includes(tag)) {
              delete allTags[tag];
            }
          }
        }

        await saveTags(allTags);
      }

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

  return router;
}

module.exports = createToolRouter;
