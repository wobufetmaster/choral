/**
 * Generic JSON file I/O utilities
 *
 * Provides standardized methods for loading and saving JSON files with
 * consistent error handling and default value support.
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Load a JSON file with optional default value
 * @param {string} filepath - Absolute path to JSON file
 * @param {*} defaultValue - Value to return if file doesn't exist (default: {})
 * @returns {Promise<*>} Parsed JSON data or default value
 * @throws {Error} If file exists but cannot be read or parsed
 */
async function loadJSON(filepath, defaultValue = {}) {
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return default value
    if (error.code === 'ENOENT') {
      return defaultValue;
    }
    // Re-throw other errors (permission denied, invalid JSON, etc.)
    throw new Error(`Failed to load ${filepath}: ${error.message}`);
  }
}

/**
 * Save data to a JSON file
 * @param {string} filepath - Absolute path to JSON file
 * @param {*} data - Data to serialize and save
 * @returns {Promise<void>}
 * @throws {Error} If file cannot be written
 */
async function saveJSON(filepath, data) {
  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });

    // Write with pretty formatting
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to save ${filepath}: ${error.message}`);
  }
}

module.exports = {
  loadJSON,
  saveJSON
};
