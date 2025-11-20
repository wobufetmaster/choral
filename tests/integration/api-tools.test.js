import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { setupTestDataDir, cleanupTestDataDir, createTestConfig } from './setup.js';
import { createApp } from '../../server/app.js';

describe('Tool API Endpoints', () => {
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
    });

    afterEach(async () => {
        await cleanupTestDataDir();
    });

    describe('GET /api/tools/available', () => {
        it('should return list of available tools', async () => {
            const response = await request(app).get('/api/tools/available');

            expect(response.status).toBe(200);
            expect(response.body.tools).toBeDefined();
            expect(response.body.tools.length).toBeGreaterThan(0);
            expect(response.body.tools.some(t => t.id === 'create_character_card')).toBe(true);
        });
    });

    describe('GET /api/tools/schemas/:characterFilename', () => {
        it('should return tools for configured character', async () => {
            // Setup tool settings
            const toolSettings = {
                enableToolCalling: true,
                characterTools: [
                    {
                        characterFilename: 'test.png',
                        tools: ['create_character_card']
                    }
                ]
            };
            await fs.promises.writeFile(
                path.join(testDataDir, 'tool-settings.json'),
                JSON.stringify(toolSettings)
            );

            const response = await request(app).get('/api/tools/schemas/test.png');

            expect(response.status).toBe(200);
            expect(response.body.tools).toBeDefined();
            expect(response.body.tools.length).toBe(1);
            expect(response.body.tools[0].function.name).toBe('create_character_card');
        });

        it('should return empty list if tool calling disabled', async () => {
            const toolSettings = {
                enableToolCalling: false,
                characterTools: [
                    {
                        characterFilename: 'test.png',
                        tools: ['create_character_card']
                    }
                ]
            };
            await fs.promises.writeFile(
                path.join(testDataDir, 'tool-settings.json'),
                JSON.stringify(toolSettings)
            );

            const response = await request(app).get('/api/tools/schemas/test.png');

            expect(response.status).toBe(200);
            expect(response.body.tools).toEqual([]);
        });
    });

    describe('POST /api/tools/create-character', () => {
        it('should create a new character', async () => {
            const payload = {
                name: 'New Character',
                first_mes: 'Hello there!'
            };

            const response = await request(app)
                .post('/api/tools/create-character')
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.filename).toBeDefined();

            // Verify file exists
            const filePath = path.join(testDataDir, 'characters', response.body.filename);
            expect(fs.existsSync(filePath)).toBe(true);
        });

        it('should fail if missing required fields', async () => {
            const response = await request(app)
                .post('/api/tools/create-character')
                .send({ name: 'Incomplete' });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/tools/add-greetings', () => {
        it('should add greetings to existing character', async () => {
            // Create a character first
            const createResponse = await request(app)
                .post('/api/tools/create-character')
                .send({ name: 'Greeter', first_mes: 'Hi' });

            const filename = createResponse.body.filename;

            const response = await request(app)
                .post('/api/tools/add-greetings')
                .send({
                    filename,
                    greetings: ['Hello', 'Greetings']
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.addedCount).toBe(2);
        });
    });

    describe('POST /api/tools/update-character', () => {
        it('should update character details', async () => {
            // Create a character first
            const createResponse = await request(app)
                .post('/api/tools/create-character')
                .send({ name: 'Updater', first_mes: 'Hi' });

            const filename = createResponse.body.filename;

            const response = await request(app)
                .post('/api/tools/update-character')
                .send({
                    filename,
                    description: 'Updated description'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.updatedFields).toContain('description');
        });
    });
});
