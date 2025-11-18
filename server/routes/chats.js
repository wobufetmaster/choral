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
 * @param {Function} deps.streamChatCompletion - OpenRouter streaming chat completion function
 * @param {Function} deps.processMacros - Macro processing function
 * @returns {express.Router} Express router
 */
function createChatRouter(deps) {
  const router = express.Router();
  const { CHATS_DIR, chatCompletion, streamChatCompletion, processMacros } = deps;

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

      // Get messages from current branch or fallback to direct messages array
      const messages = chat.branches?.['branch-main']?.messages || chat.messages || [];

      if (messages.length === 0) {
        return res.status(400).json({ error: 'No messages to generate name from' });
      }

      // Build prompt for name generation
      const messagePreview = messages
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

      // chatCompletion returns just the content string, not the full response object
      const suggestedName = response?.trim() || 'Untitled Chat';

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

  // POST /api/chat/summarize-and-continue - Summarize old messages and continue with streaming
  router.post('/summarize-and-continue', async (req, res, next) => {
    try {
      const { messages, chatTitle, preset, context, isGroupChat, characterFilenames, characterFilename } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'messages array is required' });
      }

      const model = preset?.model || 'anthropic/claude-3.5-sonnet';
      const keepCount = 10; // Keep last 10 messages
      const oldMessages = messages.slice(0, -keepCount);

      if (oldMessages.length === 0) {
        return res.status(400).json({ error: 'Not enough messages to summarize' });
      }

      // Build summary prompt from old messages
      const conversationText = oldMessages
        .map(m => {
          const charName = m.character || m.role;
          if (typeof m.content === 'string') {
            return `${charName}: ${m.content}`;
          } else if (Array.isArray(m.content)) {
            const textParts = m.content.filter(p => p.type === 'text');
            return `${charName}: ${textParts.map(p => p.text).join(' ')}`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n\n');

      const summaryPrompt = `You are a narrator for a chat story. Summarize this conversation concisely but engagingly, preserving key events, character development, and important details. Keep it under 500 words. Write in a narrative style.

Conversation:
${conversationText}`;

      // Setup SSE streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Create narrator character
      const narrator = {
        name: 'Narrator',
        avatar: 'characters/Narrator.png'
      };

      // Create new chat data
      const newChatData = {
        title: `${chatTitle} (Continued)`,
        characterFilenames: isGroupChat ? characterFilenames : [characterFilename],
        timestamp: Date.now()
      };

      // Send init event
      res.write(`data: ${JSON.stringify({
        type: 'init',
        chatData: newChatData,
        narrator: narrator
      })}\n\n`);

      let fullSummary = '';

      // Stream the summary generation
      streamChatCompletion({
        messages: [{ role: 'user', content: summaryPrompt }],
        model: model,
        options: {
          temperature: 0.7,
          max_tokens: 1000
        },
        onChunk: (content) => {
          fullSummary += content;
          res.write(`data: ${JSON.stringify({
            type: 'chunk',
            content: content
          })}\n\n`);
        },
        onComplete: () => {
          // Send complete event with final message
          res.write(`data: ${JSON.stringify({
            type: 'complete',
            message: {
              content: fullSummary,
              swipes: [fullSummary]
            }
          })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        },
        onError: (error) => {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error.message
          })}\n\n`);
          res.end();
        }
      });

    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createChatRouter;
