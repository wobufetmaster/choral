/**
 * API Service Composable
 *
 * Centralized API layer for all HTTP requests. Provides promise-based
 * methods for all resource types with consistent error handling.
 *
 * Usage:
 *   const api = useApi();
 *   const characters = await api.getCharacters();
 */
export function useApi() {
  const baseURL = '';  // Vite proxies /api/* to backend

  /**
   * Core request wrapper with error handling
   * @param {string} endpoint - API endpoint (e.g., '/api/characters')
   * @param {object} options - Fetch options
   * @returns {Promise} - Parsed response or null for empty responses
   */
  async function request(endpoint, options = {}) {
    const url = `${baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Remove Content-Type for FormData (browser sets it with boundary)
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: `HTTP ${response.status}`
        }));
        throw new Error(error.error || error.message);
      }

      // Handle empty responses (DELETE endpoints)
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.error(`API Error [${options.method || 'GET'} ${endpoint}]:`, error);
      throw error;
    }
  }

  // Helper methods
  const get = (endpoint) => request(endpoint, { method: 'GET' });
  const post = (endpoint, body) => request(endpoint, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body)
  });
  const put = (endpoint, body) => request(endpoint, {
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body)
  });
  const del = (endpoint) => request(endpoint, { method: 'DELETE' });

  // Return API interface
  return {
    // Characters
    getCharacters: () => get('/api/characters'),
    getCharacter: (filename) => get(`/api/characters/${filename}`),
    saveCharacter: (formData) => post('/api/characters', formData),
    updateCharacter: (filename, formData) => put(`/api/characters/${filename}`, formData),
    deleteCharacter: (filename) => del(`/api/characters/${filename}`),
    updateCharacterTags: (filename, tags) => put(`/api/characters/${filename}/tags`, { tags }),
    autoGenerateCharacterTags: (filename) => post(`/api/characters/${filename}/auto-tag`),

    // Chats
    getChats: () => get('/api/chats'),
    getChat: (filename) => get(`/api/chats/${filename}`),
    saveChat: (data) => post('/api/chats', data),
    deleteChat: (filename) => del(`/api/chats/${filename}`),

    // Group Chats
    getGroupChats: () => get('/api/group-chats'),
    getGroupChat: (filename) => get(`/api/group-chats/${filename}`),
    saveGroupChat: (data) => post('/api/group-chats', data),
    deleteGroupChat: (filename) => del(`/api/group-chats/${filename}`),
    getGroupChatHistory: (filename) => get(`/api/group-chats/${filename}/history`),

    // Personas
    getPersonas: () => get('/api/personas'),
    savePersona: (data) => post('/api/personas', data),

    // Lorebooks
    getLorebooks: () => get('/api/lorebooks'),
    getLorebook: (filename) => get(`/api/lorebooks/${filename}`),
    saveLorebook: (data) => post('/api/lorebooks', data),
    deleteLorebook: (filename) => del(`/api/lorebooks/${filename}`),
    importLorebook: (formData) => post('/api/lorebooks/import', formData),

    // Presets
    getPresets: () => get('/api/presets'),
    getPreset: (filename) => get(`/api/presets/${filename}`),
    savePreset: (data) => post('/api/presets', data),
    deletePreset: (filename) => del(`/api/presets/${filename}`),
    importChatCompletionPreset: (data) => post('/api/presets/import/pixijb', data),

    // Tags
    getTags: () => get('/api/tags'),
    saveTags: (tags) => post('/api/tags', tags),
    getCoreTags: () => get('/api/core-tags'),
    saveCoreTags: (tags) => post('/api/core-tags', { tags }),

    // Config
    getConfig: () => get('/api/config'),
    setActivePreset: (preset) => post('/api/config/active-preset', { preset }),
    setDefaultPersona: (persona) => post('/api/config/default-persona', { persona }),
    getBookkeepingSettings: () => get('/api/bookkeeping-settings'),
    saveBookkeepingSettings: (data) => post('/api/bookkeeping-settings', data),
    getToolSettings: () => get('/api/tool-settings'),
    saveToolSettings: (data) => post('/api/tool-settings', data),

    // Backup
    createBackup: (encrypted) => post('/api/backup/trigger', { encrypted }),
    getBackupConfig: () => get('/api/config/backup'),
    saveBackupConfig: (data) => post('/api/config/backup', data),
    validateBackupPath: (path) => post('/api/backup/validate-path', { path }),
    chooseBackupDirectory: () => get('/api/backup/choose-directory'),

    // Auto-functions
    autoNameChat: (messages) => post('/api/chat/auto-name', { messages }),
    autoTagCharacter: (character) => post('/api/characters/auto-tag', { character }),

    // Tools
    getCharacterTools: (filename) => get(`/api/tools/character/${filename}`),
    callTool: (toolName, args) => post('/api/tools/call', { toolName, args }),
  };
}
