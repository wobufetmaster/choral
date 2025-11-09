import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readCharacterCard, writeCharacterCard, validateCharacterCard, convertV2ToV3 } from '../../../server/characterCard.js';
import path from 'path';
import fs from 'fs';

const FIXTURES_DIR = path.join(process.cwd(), 'tests/fixtures/characters');
const TEST_OUTPUT_DIR = path.join(process.cwd(), 'data-test');

describe('Character Card Processing', () => {
  // Ensure test output directory exists
  beforeAll(() => {
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  // Clean up test files after all tests
  afterAll(() => {
    const testFile = path.join(TEST_OUTPUT_DIR, 'test-output.png');
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  });

  describe('readCharacterCard', () => {
    it('should read V3 character card', async () => {
      const cardPath = path.join(FIXTURES_DIR, 'test-character-v3.png');
      const card = await readCharacterCard(cardPath);

      expect(card).toBeDefined();
      expect(card.data).toBeDefined();
      expect(card.spec).toBe('chara_card_v3');
      expect(card.spec_version).toBe('3.0');
      expect(card.data.name).toBeDefined();
      expect(typeof card.data.name).toBe('string');
    });

    it('should read V2 character card', async () => {
      const cardPath = path.join(FIXTURES_DIR, 'test-character-v2.png');
      const card = await readCharacterCard(cardPath);

      expect(card).toBeDefined();
      expect(card.data).toBeDefined();
      // Note: Both fixtures are V3 format currently (see tests/fixtures/characters/README.md)
      // When a true V2 fixture is available, this test will verify V2 compatibility
    });

    it('should throw error for invalid character card', async () => {
      const cardPath = path.join(FIXTURES_DIR, 'invalid-character.png');
      await expect(readCharacterCard(cardPath)).rejects.toThrow();
    });

    it('should throw error for non-existent file', async () => {
      await expect(readCharacterCard('nonexistent.png')).rejects.toThrow();
    });
  });

  describe('validateCharacterCard', () => {
    it('should validate correct V3 card', () => {
      const card = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test Character',
          description: 'A test character',
          personality: 'Friendly',
          scenario: 'Test scenario',
          first_mes: 'Hello!',
          mes_example: 'Example dialogue'
        }
      };

      expect(validateCharacterCard(card)).toBe(true);
    });

    it('should reject card without spec', () => {
      const card = {
        spec_version: '3.0',
        data: {
          name: 'Test'
        }
      };

      expect(validateCharacterCard(card)).toBe(false);
    });

    it('should reject card with wrong spec', () => {
      const card = {
        spec: 'invalid_spec',
        spec_version: '3.0',
        data: {
          name: 'Test'
        }
      };

      expect(validateCharacterCard(card)).toBe(false);
    });

    it('should reject card without spec_version', () => {
      const card = {
        spec: 'chara_card_v3',
        data: {
          name: 'Test'
        }
      };

      expect(validateCharacterCard(card)).toBe(false);
    });

    it('should reject card without data object', () => {
      const card = {
        spec: 'chara_card_v3',
        spec_version: '3.0'
      };

      expect(validateCharacterCard(card)).toBe(false);
    });

    it('should reject card without name in data', () => {
      const card = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          description: 'A test character'
        }
      };

      expect(validateCharacterCard(card)).toBe(false);
    });

    it('should reject null or undefined input', () => {
      expect(validateCharacterCard(null)).toBe(false);
      expect(validateCharacterCard(undefined)).toBe(false);
    });

    it('should reject non-object input', () => {
      expect(validateCharacterCard('string')).toBe(false);
      expect(validateCharacterCard(123)).toBe(false);
      expect(validateCharacterCard([])).toBe(false);
    });
  });

  describe('convertV2ToV3', () => {
    it('should convert V2 card to V3 format', () => {
      const v2Card = {
        name: 'Test Character',
        description: 'A test character',
        personality: 'Friendly',
        scenario: 'Test scenario',
        first_mes: 'Hello!',
        mes_example: 'Example dialogue'
      };

      const v3Card = convertV2ToV3(v2Card);

      expect(v3Card.spec).toBe('chara_card_v3');
      expect(v3Card.spec_version).toBe('3.0');
      expect(v3Card.data.name).toBe('Test Character');
      expect(v3Card.data.description).toBe('A test character');
      expect(v3Card.data.personality).toBe('Friendly');
      expect(v3Card.data.scenario).toBe('Test scenario');
      expect(v3Card.data.first_mes).toBe('Hello!');
      expect(v3Card.data.mes_example).toBe('Example dialogue');
    });

    it('should handle V2 card with data wrapper', () => {
      const v2Card = {
        data: {
          name: 'Wrapped Character',
          description: 'In data wrapper',
          personality: 'Quirky'
        }
      };

      const v3Card = convertV2ToV3(v2Card);

      expect(v3Card.spec).toBe('chara_card_v3');
      expect(v3Card.data.name).toBe('Wrapped Character');
      expect(v3Card.data.description).toBe('In data wrapper');
      expect(v3Card.data.personality).toBe('Quirky');
    });

    it('should return V3 card as-is if already V3', () => {
      const v3Card = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Already V3',
          description: 'This is already V3'
        }
      };

      const result = convertV2ToV3(v3Card);

      expect(result).toEqual(v3Card);
      expect(result.spec).toBe('chara_card_v3');
    });

    it('should use defaults for missing fields', () => {
      const v2Card = {
        name: 'Minimal Character'
      };

      const v3Card = convertV2ToV3(v2Card);

      expect(v3Card.data.name).toBe('Minimal Character');
      expect(v3Card.data.description).toBe('');
      expect(v3Card.data.personality).toBe('');
      expect(v3Card.data.scenario).toBe('');
      expect(v3Card.data.tags).toEqual([]);
      expect(v3Card.data.alternate_greetings).toEqual([]);
      expect(v3Card.data.extensions).toEqual({});
    });

    it('should preserve all V2 fields in conversion', () => {
      const v2Card = {
        name: 'Complete Character',
        description: 'Full description',
        personality: 'Complex personality',
        scenario: 'Detailed scenario',
        first_mes: 'First message',
        mes_example: 'Message examples',
        creator_notes: 'Creator notes',
        system_prompt: 'System prompt',
        post_history_instructions: 'Post history',
        tags: ['tag1', 'tag2'],
        creator: 'Test Creator',
        character_version: '2.0',
        alternate_greetings: ['Alt greeting 1', 'Alt greeting 2'],
        extensions: { custom: 'data' }
      };

      const v3Card = convertV2ToV3(v2Card);

      expect(v3Card.data.name).toBe('Complete Character');
      expect(v3Card.data.description).toBe('Full description');
      expect(v3Card.data.personality).toBe('Complex personality');
      expect(v3Card.data.scenario).toBe('Detailed scenario');
      expect(v3Card.data.first_mes).toBe('First message');
      expect(v3Card.data.mes_example).toBe('Message examples');
      expect(v3Card.data.creator_notes).toBe('Creator notes');
      expect(v3Card.data.system_prompt).toBe('System prompt');
      expect(v3Card.data.post_history_instructions).toBe('Post history');
      expect(v3Card.data.tags).toEqual(['tag1', 'tag2']);
      expect(v3Card.data.creator).toBe('Test Creator');
      expect(v3Card.data.character_version).toBe('2.0');
      expect(v3Card.data.alternate_greetings).toEqual(['Alt greeting 1', 'Alt greeting 2']);
      expect(v3Card.data.extensions).toEqual({ custom: 'data' });
    });
  });

  describe('writeCharacterCard', () => {
    it('should write character card to PNG and read it back', async () => {
      // Ensure directory exists
      if (!fs.existsSync(TEST_OUTPUT_DIR)) {
        fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
      }

      const outputPath = path.join(TEST_OUTPUT_DIR, 'test-output.png');
      const card = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        data: {
          name: 'Test Character',
          description: 'A test character',
          personality: 'Friendly',
          scenario: 'Test scenario',
          first_mes: 'Hello!',
          mes_example: 'Example dialogue'
        }
      };

      // Use existing test image as base
      const basePngPath = path.join(FIXTURES_DIR, 'test-character-v3.png');
      const basePng = await fs.promises.readFile(basePngPath);

      await writeCharacterCard(outputPath, card, basePng);

      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify we can read it back
      const readCard = await readCharacterCard(outputPath);
      expect(readCard.data.name).toBe('Test Character');
      expect(readCard.data.description).toBe('A test character');
      expect(readCard.spec).toBe('chara_card_v3');
    });
  });
});
