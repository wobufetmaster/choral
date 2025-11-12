// Backup configuration defaults and validation

const VALID_INTERVALS = ['15m', '1h', '6h', '12h', '24h'];

const DEFAULT_CONFIG = {
  enabled: false,
  interval: '6h',
  retention: 10,
  directory: './backups',
  encrypt: false,
  password: ''
};

/**
 * Validate backup configuration
 * @param {Object} config - Backup config object
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateBackupConfig(config) {
  const errors = [];

  if (config.retention < 1 || config.retention > 100) {
    errors.push('Retention must be between 1 and 100');
  }

  if (!VALID_INTERVALS.includes(config.interval)) {
    errors.push(`Interval must be one of: ${VALID_INTERVALS.join(', ')}`);
  }

  if (config.encrypt && (!config.password || config.password.length < 8)) {
    errors.push('Password must be at least 8 characters when encryption is enabled');
  }

  // Check for path traversal attempts
  if (config.directory.includes('../')) {
    errors.push('Directory path cannot contain ../');
  }

  // Check if path is inside data directory
  const path = require('path');
  const resolvedDir = path.resolve(config.directory);
  const dataDir = path.resolve('./data');
  if (resolvedDir.startsWith(dataDir)) {
    errors.push('Cannot backup into data directory');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Convert interval string to cron expression
 * @param {string} interval - Interval string (15m, 1h, etc.)
 * @returns {string} Cron expression
 */
function intervalToCron(interval) {
  const cronMap = {
    '15m': '*/15 * * * *',
    '1h': '0 * * * *',
    '6h': '0 */6 * * *',
    '12h': '0 */12 * * *',
    '24h': '0 0 * * *'
  };
  return cronMap[interval] || cronMap['6h'];
}

module.exports = {
  DEFAULT_CONFIG,
  VALID_INTERVALS,
  validateBackupConfig,
  intervalToCron
};
