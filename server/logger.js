const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'api-requests.log');

// Ensure logs directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Failed to create logs directory:', err);
}

/**
 * Log an API request to the LLM
 * @param {Object} data - Data to log
 */
function logRequest(data) {
  const timestamp = new Date().toISOString();

  // Build structured JSON log for VSCode collapsibility
  const logEntry = {
    type: 'REQUEST',
    timestamp,
    model: data.model,
    promptProcessing: data.promptProcessing || 'none',
    streaming: data.streaming || false,
    options: data.options,
    context: data.context,
    messages: data.messages?.map((msg, i) => ({
      index: i,
      role: msg.role,
      contentLength: msg.content?.length || 0,
      content: msg.content
    }))
  };

  const logText = JSON.stringify(logEntry, null, 2) + ',\n';

  try {
    fs.appendFileSync(LOG_FILE, logText);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }

  // Also log to console for immediate visibility
  console.log('\n' + '='.repeat(80));
  console.log('API REQUEST:', timestamp);
  console.log('Model:', data.model);
  console.log('Messages:', data.messages?.length, 'messages');
  console.log('Options:', JSON.stringify(data.options, null, 2));
  if (data.context) {
    console.log('Macro Context:', JSON.stringify(data.context, null, 2));
  }
  console.log('\nFull Messages:');
  data.messages?.forEach((msg, i) => {
    console.log(`\n[${i}] ${msg.role}:`);
    console.log(msg.content.substring(0, 500) + (msg.content.length > 500 ? '...' : ''));
  });
  console.log('='.repeat(80) + '\n');
}

/**
 * Log an API response from the LLM
 * @param {Object} data - Data to log
 */
function logResponse(data) {
  const timestamp = new Date().toISOString();

  // Build structured JSON log for VSCode collapsibility
  const logEntry = {
    type: 'RESPONSE',
    timestamp,
    contentLength: data.content?.length || 0,
    content: data.content,
    error: data.error
  };

  const logText = JSON.stringify(logEntry, null, 2) + ',\n';

  try {
    fs.appendFileSync(LOG_FILE, logText);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }

  // Also log to console
  console.log('\n' + '='.repeat(80));
  console.log('API RESPONSE:', timestamp);
  console.log('Content length:', data.content?.length, 'characters');
  console.log('Content:', data.content?.substring(0, 200) + (data.content?.length > 200 ? '...' : ''));
  if (data.error) {
    console.log('ERROR:', data.error);
  }
  console.log('='.repeat(80) + '\n');
}

/**
 * Log a streaming chunk
 * @param {string} chunk - Chunk content
 */
function logStreamChunk(chunk) {
  // Disabled - too verbose for logs
  // Chunks are accumulated and logged in logResponse instead
}

/**
 * Clear the log file
 */
function clearLogs() {
  try {
    fs.writeFileSync(LOG_FILE, '');
    console.log('Log file cleared');
  } catch (err) {
    console.error('Failed to clear log file:', err);
  }
}

module.exports = {
  logRequest,
  logResponse,
  logStreamChunk,
  clearLogs
};
