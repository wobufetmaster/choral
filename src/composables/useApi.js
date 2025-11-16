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
  const del = (endpoint) => request(endpoint, { method: 'DELETE' });

  // Return API interface
  return {
    // Characters
    getCharacters: () => get('/api/characters'),
    getCharacter: (filename) => get(`/api/characters/${filename}`),
    saveCharacter: (formData) => post('/api/characters', formData),
    deleteCharacter: (filename) => del(`/api/characters/${filename}`),

    // Config
    getConfig: () => get('/api/config'),
    setActivePreset: (filename) => post('/api/config/active-preset', { filename }),
  };
}
