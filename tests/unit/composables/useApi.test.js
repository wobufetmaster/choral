import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useApi } from '../../../src/composables/useApi.js';

describe('useApi', () => {
  let api;
  let fetchMock;

  beforeEach(() => {
    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    api = useApi();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Character API', () => {
    it('should fetch characters list with GET /api/characters', async () => {
      const mockCharacters = [{ filename: 'test.png', name: 'Test' }];
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockCharacters)
      });

      const result = await api.getCharacters();

      expect(fetchMock).toHaveBeenCalledWith('/api/characters', {
        headers: { 'Content-Type': 'application/json' },
        method: 'GET'
      });
      expect(result).toEqual(mockCharacters);
    });

    it('should save character with POST /api/characters and FormData', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.png');

      const mockCharacter = { filename: 'test.png', name: 'Test' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockCharacter)
      });

      const result = await api.saveCharacter(formData);

      // Should NOT have Content-Type header (browser sets it)
      expect(fetchMock).toHaveBeenCalledWith('/api/characters', {
        headers: {},
        method: 'POST',
        body: formData
      });
      expect(result).toEqual(mockCharacter);
    });

    it('should delete character with DELETE /api/characters/:filename', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => ''  // DELETE returns empty response
      });

      const result = await api.deleteCharacter('test.png');

      expect(fetchMock).toHaveBeenCalledWith('/api/characters/test.png', {
        headers: { 'Content-Type': 'application/json' },
        method: 'DELETE'
      });
      expect(result).toBeNull();
    });
  });

  describe('Preset API', () => {
    it('should fetch presets with GET /api/presets', async () => {
      const mockPresets = [{ filename: 'default.json', name: 'Default' }];
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockPresets)
      });

      const result = await api.getPresets();
      expect(result).toEqual(mockPresets);
    });

    it('should save preset with POST /api/presets', async () => {
      const preset = { name: 'Test', temperature: 0.7 };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(preset)
      });

      const result = await api.savePreset(preset);
      expect(result).toEqual(preset);
    });
  });

  describe('Backup API', () => {
    it('should create backup with POST /api/backup/trigger', async () => {
      const mockResponse = { filename: 'backup.zip', message: 'Success' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockResponse)
      });

      const result = await api.createBackup(false);

      expect(fetchMock).toHaveBeenCalledWith('/api/backup/trigger', {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify({ encrypted: false })
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Config API', () => {
    it('should fetch config with GET /api/config', async () => {
      const mockConfig = { port: 3000 };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockConfig)
      });

      const result = await api.getConfig();

      expect(fetchMock).toHaveBeenCalledWith('/api/config', {
        headers: { 'Content-Type': 'application/json' },
        method: 'GET'
      });
      expect(result).toEqual(mockConfig);
    });

    it('should set active preset with POST /api/config/active-preset', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ success: true })
      });

      const result = await api.setActivePreset('default.json');

      expect(fetchMock).toHaveBeenCalledWith('/api/config/active-preset', {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: JSON.stringify({ preset: 'default.json' })
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('Error Handling', () => {
    it('should throw on network failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.getCharacters()).rejects.toThrow('Network error');
    });

    it('should parse error response JSON', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Character not found' })
      });

      await expect(api.getCharacter('missing.png')).rejects.toThrow('Character not found');
    });

    it('should fallback to HTTP status on malformed error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON'); }
      });

      await expect(api.getCharacters()).rejects.toThrow('HTTP 500');
    });

    it('should log errors with context', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.getCharacters()).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Error [GET /api/characters]'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Response Parsing', () => {
    it('should parse JSON responses', async () => {
      const mockData = { test: 'data' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockData)
      });

      const result = await api.getCharacters();
      expect(result).toEqual(mockData);
    });

    it('should handle empty responses (DELETE endpoints)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => ''
      });

      const result = await api.deleteCharacter('test.png');
      expect(result).toBeNull();
    });
  });
});
