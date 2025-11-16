/**
 * Group chat management routes
 *
 * Handles:
 * - List and filter group chats
 * - Save/load group chat history
 * - Auto-naming with AI
 * - Delete group chats
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

/**
 * Create group chat router with dependencies injected
 * @param {Object} deps - Dependencies
 * @param {string} deps.GROUP_CHATS_DIR - Path to group chats directory
 * @param {Function} deps.loadBookkeepingSettings - Function to load bookkeeping settings
 * @param {Object} deps.config - Server configuration
 * @returns {express.Router} Express router
 */
function createGroupChatRouter(deps) {
  const router = express.Router();
  const { GROUP_CHATS_DIR, loadBookkeepingSettings, config } = deps;

  // GET /api/group-chats - List all group chats
  router.get('/', async (req, res, next) => {
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
      next(error);
    }
  });

  // GET /api/group-chats/:filename - Get specific group chat
  router.get('/:filename', async (req, res, next) => {
    try {
      const filePath = path.join(GROUP_CHATS_DIR, req.params.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const groupChat = JSON.parse(content);
      res.json(groupChat);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Group chat not found' });
      }
      next(error);
    }
  });

  // POST /api/group-chats - Create/update group chat
  router.post('/', async (req, res, next) => {
    try {
      const groupChat = req.body;
      const filename = groupChat.filename || `group_chat_${Date.now()}.json`;
      const filePath = path.join(GROUP_CHATS_DIR, filename);

      await fs.writeFile(filePath, JSON.stringify(groupChat, null, 2));
      res.json({ success: true, filename });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/group-chats/:filename/auto-name - Auto-generate group chat title
  router.post('/:filename/auto-name', async (req, res, next) => {
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
      next(error);
    }
  });

  // DELETE /api/group-chats/:filename - Delete group chat
  router.delete('/:filename', async (req, res, next) => {
    try {
      const filePath = path.join(GROUP_CHATS_DIR, req.params.filename);
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Group chat not found' });
      }
      next(error);
    }
  });

  return router;
}

module.exports = createGroupChatRouter;
