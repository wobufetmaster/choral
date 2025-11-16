import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs/promises';
import { setupTestDataDir, cleanupTestDataDir, createTestConfig } from './setup.js';
import { createApp } from '../../server/app.js';

describe('Lorebook API Integration', () => {
  let app;
  let testDataDir;
  let ensureDirectories;

  beforeEach(async () => {
    testDataDir = setupTestDataDir();
    const config = createTestConfig(testDataDir);
    const appContext = createApp(config);
    app = appContext.app;
    ensureDirectories = appContext.ensureDirectories;
    await ensureDirectories();

    // Create test lorebooks
    const lorebook1 = {
      name: 'Test Lorebook 1',
      entries: [
        {
          name: 'Dragon Entry',
          keys: ['dragon', 'wyrm'],
          content: 'Dragons are powerful reptilian creatures.',
          priority: 100,
          enabled: true
        },
        {
          name: 'Constant Entry',
          constant: true,
          content: 'This entry is always included.',
          priority: 50
        }
      ]
    };

    const lorebook2 = {
      name: 'Test Lorebook 2',
      entries: [
        {
          name: 'Castle Entry',
          keys: ['castle', 'fortress'],
          content: 'Castles are medieval fortifications.',
          priority: 75,
          enabled: true
        },
        {
          name: 'Knight Entry',
          keys: ['knight'],
          content: 'Knights are armored warriors.',
          priority: 60,
          enabled: true
        }
      ]
    };

    await fs.writeFile(
      path.join(testDataDir, 'lorebooks/test1.json'),
      JSON.stringify(lorebook1, null, 2)
    );

    await fs.writeFile(
      path.join(testDataDir, 'lorebooks/test2.json'),
      JSON.stringify(lorebook2, null, 2)
    );
  });

  afterEach(async () => {
    await cleanupTestDataDir();
  });

  describe('GET /api/lorebooks', () => {
    it('should list all lorebooks', async () => {
      const response = await request(app).get('/api/lorebooks');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);

      const test1 = response.body.find(l => l.filename === 'test1.json');
      expect(test1).toBeDefined();
      expect(test1.name).toBe('Test Lorebook 1');
    });
  });

  describe('POST /api/chat/stream with single lorebook', () => {
    it('should inject lorebook entries when keywords match', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'I see a dragon!' }
        ],
        model: 'test-model',
        options: {},
        context: {
          charName: 'TestChar',
          userName: 'TestUser'
        },
        promptProcessing: 'none',
        lorebookFilenames: ['test1.json'],
        debug: true
      };

      const response = await request(app)
        .post('/api/chat/stream')
        .send(requestBody);

      // Parse SSE stream
      const lines = response.text.split('\n').filter(l => l.startsWith('data: '));
      const debugLine = lines.find(l => l.includes('matchedEntriesByLorebook'));

      // Debug: log what we got
      if (!debugLine) {
        console.log('Available lines:', lines.slice(0, 5));
      }

      expect(debugLine).toBeDefined();
      const debugData = JSON.parse(debugLine.replace(/^data: /, ''));

      const matchedEntries = debugData.debug.matchedEntriesByLorebook['test1.json'];
      expect(matchedEntries.length).toBe(2); // Dragon Entry + Constant Entry

      const dragonEntry = matchedEntries.find(e => e.name === 'Dragon Entry');
      expect(dragonEntry).toBeDefined();
      expect(dragonEntry.matchedKeys).toContain('dragon');

      const constantEntry = matchedEntries.find(e => e.name === 'Constant Entry');
      expect(constantEntry).toBeDefined();
      expect(constantEntry.matchType).toBe('constant');
    });

    it('should not inject entries when keywords do not match', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'I see a tree!' }
        ],
        model: 'test-model',
        options: {},
        lorebookFilenames: ['test1.json'],
        debug: true
      };

      const response = await request(app)
        .post('/api/chat/stream')
        .send(requestBody);

      const lines = response.text.split('\n').filter(l => l.startsWith('data: '));
      const debugLine = lines.find(l => l.includes('matchedEntriesByLorebook'));
      const debugData = JSON.parse(debugLine.replace('data: ', ''));

      const matchedEntries = debugData.debug.matchedEntriesByLorebook['test1.json'];
      // Only constant entry should match (no dragon keyword)
      expect(matchedEntries.length).toBe(1);
      expect(matchedEntries[0].name).toBe('Constant Entry');
    });
  });

  describe('POST /api/chat/stream with multiple lorebooks', () => {
    it('should inject entries from multiple lorebooks', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'The knight guards the dragon at the castle!' }
        ],
        model: 'test-model',
        options: {},
        promptProcessing: 'none',
        lorebookFilenames: ['test1.json', 'test2.json'],
        debug: true
      };

      const response = await request(app)
        .post('/api/chat/stream')
        .send(requestBody);

      const lines = response.text.split('\n').filter(l => l.startsWith('data: '));
      const debugLine = lines.find(l => l.includes('matchedEntriesByLorebook'));
      const debugData = JSON.parse(debugLine.replace('data: ', ''));

      // Check entries from first lorebook
      const entries1 = debugData.debug.matchedEntriesByLorebook['test1.json'];
      expect(entries1.length).toBe(2); // Dragon + Constant
      expect(entries1.some(e => e.name === 'Dragon Entry')).toBe(true);
      expect(entries1.some(e => e.name === 'Constant Entry')).toBe(true);

      // Check entries from second lorebook
      const entries2 = debugData.debug.matchedEntriesByLorebook['test2.json'];
      expect(entries2.length).toBe(2); // Castle + Knight
      expect(entries2.some(e => e.name === 'Castle Entry')).toBe(true);
      expect(entries2.some(e => e.name === 'Knight Entry')).toBe(true);
    });

    it('should respect priority sorting across multiple lorebooks', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'The knight and dragon meet at the castle!' }
        ],
        model: 'test-model',
        options: {},
        promptProcessing: 'none',
        lorebookFilenames: ['test1.json', 'test2.json'],
        debug: true
      };

      const response = await request(app)
        .post('/api/chat/stream')
        .send(requestBody);

      const lines = response.text.split('\n').filter(l => l.startsWith('data: '));
      const debugLine = lines.find(l => l.includes('processedMessages'));
      const debugData = JSON.parse(debugLine.replace('data: ', ''));

      const messages = debugData.debug.processedMessages;
      const systemMessages = messages.filter(m => m.role === 'system');

      // Verify entries are injected in priority order
      // Dragon (100) > Castle (75) > Knight (60) > Constant (50)
      const contents = systemMessages.map(m => {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) {
          return m.content.find(p => p.type === 'text')?.text || '';
        }
        return '';
      });

      const dragonIndex = contents.findIndex(c => c.includes('Dragons are powerful'));
      const castleIndex = contents.findIndex(c => c.includes('Castles are medieval'));
      const knightIndex = contents.findIndex(c => c.includes('Knights are armored'));
      const constantIndex = contents.findIndex(c => c.includes('This entry is always'));

      expect(dragonIndex).toBeLessThan(castleIndex);
      expect(castleIndex).toBeLessThan(knightIndex);
      expect(knightIndex).toBeLessThan(constantIndex);
    });
  });

  describe('Lorebook with merge_system processing', () => {
    it('should merge lorebook entries with system messages', async () => {
      const requestBody = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Tell me about the dragon!' }
        ],
        model: 'test-model',
        options: {},
        promptProcessing: 'merge_system',
        lorebookFilenames: ['test1.json'],
        debug: true
      };

      const response = await request(app)
        .post('/api/chat/stream')
        .send(requestBody);

      const lines = response.text.split('\n').filter(l => l.startsWith('data: '));
      const debugLine = lines.find(l => l.includes('processedMessages'));
      const debugData = JSON.parse(debugLine.replace('data: ', ''));

      const messages = debugData.debug.processedMessages;

      // With merge_system, all system messages should be merged into one
      const systemMessages = messages.filter(m => m.role === 'system');
      expect(systemMessages.length).toBe(1);

      // The merged system message should contain both the original system prompt
      // and the lorebook entries
      const systemContent = typeof systemMessages[0].content === 'string'
        ? systemMessages[0].content
        : systemMessages[0].content.find(p => p.type === 'text')?.text || '';

      expect(systemContent).toContain('You are a helpful assistant');
      expect(systemContent).toContain('Dragons are powerful');
      expect(systemContent).toContain('This entry is always');
    });
  });
});
