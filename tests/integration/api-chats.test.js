import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { setupTestDataDir, cleanupTestDataDir } from './setup.js';

describe('Chat API Endpoints', () => {
  let app;
  let testDataDir;

  beforeEach(() => {
    testDataDir = setupTestDataDir();
    // TODO: Initialize app with test config
  });

  afterEach(() => {
    cleanupTestDataDir();
  });

  describe('GET /api/chats', () => {
    it('should return empty array when no chats exist', async () => {
      const response = await request(app).get('/api/chats');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return list of chats', async () => {
      const chatPath = path.join(testDataDir, 'chats/test-chat.json');
      const chatData = {
        character: 'test-character.png',
        messages: [],
        created: new Date().toISOString()
      };
      await fs.promises.writeFile(chatPath, JSON.stringify(chatData));

      const response = await request(app).get('/api/chats');

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
    });
  });

  describe('POST /api/chats', () => {
    it('should save new chat', async () => {
      const chatData = {
        character: 'test-character.png',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      };

      const response = await request(app)
        .post('/api/chats')
        .send(chatData);

      expect(response.status).toBe(200);
      expect(response.body.filename).toBeDefined();
    });
  });

  describe('POST /api/chat (non-streaming)', () => {
    it('should return chat completion', async () => {
      // Mock OpenRouter API
      vi.mock('../../../server/openrouter.js', () => ({
        chatCompletion: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Test response' } }]
        })
      }));

      const response = await request(app)
        .post('/api/chat')
        .send({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'test-model'
        });

      expect(response.status).toBe(200);
      expect(response.body.choices).toBeDefined();
    });
  });
});
