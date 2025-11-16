/**
 * Chat management routes
 *
 * Handles:
 * - List and filter chats
 * - Save/load chat history
 * - Auto-naming with AI
 * - Chat branching (tree-based conversations)
 * - Summarize and continue (context compression)
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');

/**
 * Create chat router with dependencies injected
 * @param {Object} deps - Dependencies
 * @param {string} deps.CHATS_DIR - Path to chats directory
 * @param {Function} deps.chatCompletion - OpenRouter chat completion function
 * @param {Function} deps.processMacros - Macro processing function
 * @returns {express.Router} Express router
 */
function createChatRouter(deps) {
  const router = express.Router();
  const { CHATS_DIR, chatCompletion, processMacros } = deps;

  // GET /api/chats - List all chats
  router.get('/', async (req, res, next) => {
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
          } catch (error) {
            console.error(`Error reading chat ${file}:`, error.message);
            return null;
          }
        })
      );

      res.json(chats.filter(c => c !== null));
    } catch (error) {
      next(error);
    }
  });

  // GET /api/chats/character/:characterFilename - Get chats for specific character
  router.get('/character/:characterFilename', async (req, res, next) => {
    try {
      const files = await fs.readdir(CHATS_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      const chats = await Promise.all(
        jsonFiles.map(async (file) => {
          try {
            const filePath = path.join(CHATS_DIR, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const chat = JSON.parse(content);

            if (chat.character === req.params.characterFilename) {
              return {
                filename: file,
                ...chat
              };
            }
            return null;
          } catch (error) {
            console.error(`Error reading chat ${file}:`, error.message);
            return null;
          }
        })
      );

      res.json(chats.filter(c => c !== null));
    } catch (error) {
      next(error);
    }
  });

  // GET /api/chats/:filename - Get specific chat
  router.get('/:filename', async (req, res, next) => {
    try {
      const filePath = path.join(CHATS_DIR, req.params.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const chat = JSON.parse(content);
      res.json(chat);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Chat not found' });
      }
      next(error);
    }
  });

  // POST /api/chats - Save chat
  router.post('/', async (req, res, next) => {
    try {
      const chat = req.body;
      const filename = chat.filename || `chat_${Date.now()}.json`;
      const filePath = path.join(CHATS_DIR, filename);

      await fs.writeFile(filePath, JSON.stringify(chat, null, 2));

      res.json({ success: true, filename });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/chats/:filename/auto-name - Auto-generate chat name
  router.post('/:filename/auto-name', async (req, res, next) => {
    try {
      const filePath = path.join(CHATS_DIR, req.params.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const chat = JSON.parse(content);

      // Build prompt for name generation
      const messagePreview = chat.messages
        .slice(0, 10)
        .map(m => {
          if (typeof m.content === 'string') {
            return `${m.role}: ${m.content.substring(0, 100)}`;
          } else if (Array.isArray(m.content)) {
            const textParts = m.content.filter(p => p.type === 'text');
            const text = textParts.map(p => p.text).join(' ').substring(0, 100);
            return `${m.role}: ${text}`;
          }
          return '';
        })
        .join('\n');

      const prompt = `Based on this conversation, suggest a short, descriptive title (2-5 words max). Return ONLY the title, nothing else.

Conversation:
${messagePreview}`;

      const response = await chatCompletion({
        messages: [{ role: 'user', content: prompt }],
        model: req.body.model || 'anthropic/claude-3.5-sonnet',
        temperature: 0.7,
        max_tokens: 50
      });

      const suggestedName = response.choices[0]?.message?.content?.trim() || 'Untitled Chat';

      // Update chat with suggested name
      chat.name = suggestedName;
      await fs.writeFile(filePath, JSON.stringify(chat, null, 2));

      res.json({ filename: req.params.filename, name: suggestedName });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/chats/:filename/branches - Create new branch
  router.post('/:filename/branches', async (req, res, next) => {
    try {
      const filePath = path.join(CHATS_DIR, req.params.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const chat = JSON.parse(content);

      const { parentMessageIndex, branchName } = req.body;

      if (typeof parentMessageIndex !== 'number') {
        return res.status(400).json({ error: 'parentMessageIndex is required' });
      }

      // Initialize branches if needed
      if (!chat.branches) {
        chat.branches = [];
      }

      // Create new branch
      const branchId = `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newBranch = {
        id: branchId,
        name: branchName || `Branch ${chat.branches.length + 1}`,
        parentMessageIndex,
        messages: chat.messages.slice(0, parentMessageIndex + 1),
        createdAt: new Date().toISOString()
      };

      chat.branches.push(newBranch);
      await fs.writeFile(filePath, JSON.stringify(chat, null, 2));

      res.json({ branch: newBranch });
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/chats/:filename/branches/:branchId - Update branch
  router.put('/:filename/branches/:branchId', async (req, res, next) => {
    try {
      const filePath = path.join(CHATS_DIR, req.params.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const chat = JSON.parse(content);

      const branchIndex = chat.branches?.findIndex(b => b.id === req.params.branchId);
      if (branchIndex === -1 || branchIndex === undefined) {
        return res.status(404).json({ error: 'Branch not found' });
      }

      // Update branch data
      chat.branches[branchIndex] = {
        ...chat.branches[branchIndex],
        ...req.body,
        id: req.params.branchId // Preserve ID
      };

      await fs.writeFile(filePath, JSON.stringify(chat, null, 2));

      res.json({ branch: chat.branches[branchIndex] });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/chats/:filename/branches/:branchId - Delete branch
  router.delete('/:filename/branches/:branchId', async (req, res, next) => {
    try {
      const filePath = path.join(CHATS_DIR, req.params.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const chat = JSON.parse(content);

      const branchIndex = chat.branches?.findIndex(b => b.id === req.params.branchId);
      if (branchIndex === -1 || branchIndex === undefined) {
        return res.status(404).json({ error: 'Branch not found' });
      }

      // Remove branch
      chat.branches.splice(branchIndex, 1);
      await fs.writeFile(filePath, JSON.stringify(chat, null, 2));

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/chats/:filename/current-branch - Switch to different branch
  router.put('/:filename/current-branch', async (req, res, next) => {
    try {
      const filePath = path.join(CHATS_DIR, req.params.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const chat = JSON.parse(content);

      const { branchId } = req.body;

      if (!branchId) {
        return res.status(400).json({ error: 'branchId is required' });
      }

      const branch = chat.branches?.find(b => b.id === branchId);
      if (!branch) {
        return res.status(404).json({ error: 'Branch not found' });
      }

      // Switch to branch by replacing main messages
      chat.messages = branch.messages;
      chat.currentBranch = branchId;

      await fs.writeFile(filePath, JSON.stringify(chat, null, 2));

      res.json({ success: true, currentBranch: branchId });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /api/chats/:filename - Delete chat
  router.delete('/:filename', async (req, res, next) => {
    try {
      const filePath = path.join(CHATS_DIR, req.params.filename);
      await fs.unlink(filePath);
      res.json({ success: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Chat not found' });
      }
      next(error);
    }
  });

  // POST /api/chat/summarize-and-continue - Summarize old messages and continue
  router.post('/summarize-and-continue', async (req, res, next) => {
    try {
      const { messages, model, summaryModel, keepRecentCount } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages array is required' });
      }

      const keepCount = keepRecentCount || 10;
      const recentMessages = messages.slice(-keepCount);
      const oldMessages = messages.slice(0, -keepCount);

      if (oldMessages.length === 0) {
        return res.json({ summarizedMessages: messages });
      }

      // Build summary prompt
      const conversationText = oldMessages
        .map(m => {
          if (typeof m.content === 'string') {
            return `${m.role}: ${m.content}`;
          } else if (Array.isArray(m.content)) {
            const textParts = m.content.filter(p => p.type === 'text');
            return `${m.role}: ${textParts.map(p => p.text).join(' ')}`;
          }
          return '';
        })
        .join('\n\n');

      const summaryPrompt = `Summarize this conversation concisely, preserving key events, character development, and important details. Keep it under 500 words.

Conversation:
${conversationText}`;

      const response = await chatCompletion({
        messages: [{ role: 'user', content: summaryPrompt }],
        model: summaryModel || model || 'anthropic/claude-3.5-sonnet',
        temperature: 0.5,
        max_tokens: 1000
      });

      const summary = response.choices[0]?.message?.content || 'Summary unavailable.';

      // Create summarized message array
      const summarizedMessages = [
        {
          role: 'system',
          content: `Previous conversation summary:\n\n${summary}`
        },
        ...recentMessages
      ];

      res.json({ summarizedMessages, summary });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createChatRouter;
