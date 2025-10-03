const https = require('https');
const config = require('../config.json');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Get API key from config or environment
 */
function getApiKey() {
  return process.env.OPENROUTER_API_KEY || config.openRouterApiKey;
}

/**
 * Send a chat completion request to OpenRouter with streaming
 * @param {Object} params
 * @param {Array} params.messages - Array of message objects
 * @param {string} params.model - Model name
 * @param {Object} params.options - Additional options (temperature, max_tokens, etc.)
 * @param {Function} params.onChunk - Callback for each chunk of streamed data
 * @param {Function} params.onComplete - Callback when streaming is complete
 * @param {Function} params.onError - Callback for errors
 */
function streamChatCompletion({ messages, model, options = {}, onChunk, onComplete, onError }) {
  const apiKey = getApiKey();

  if (!apiKey) {
    onError(new Error('No OpenRouter API key configured'));
    return;
  }

  const requestData = JSON.stringify({
    model: model || 'anthropic/claude-opus-4',
    messages,
    stream: true,
    temperature: options.temperature ?? 1.0,
    max_tokens: options.max_tokens ?? 4096,
    top_p: options.top_p ?? 0.92,
    frequency_penalty: options.frequency_penalty ?? 0,
    presence_penalty: options.presence_penalty ?? 0,
    ...options
  });

  const url = new URL(OPENROUTER_API_URL);

  const req = https.request({
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/choral',
      'X-Title': 'Choral',
      'Content-Length': Buffer.byteLength(requestData)
    }
  }, (res) => {
    if (res.statusCode !== 200) {
      let errorData = '';
      res.on('data', (chunk) => {
        errorData += chunk;
      });
      res.on('end', () => {
        onError(new Error(`OpenRouter API error: ${res.statusCode} - ${errorData}`));
      });
      return;
    }

    let buffer = '';

    res.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');

      // Process all complete lines
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();

        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            onComplete();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;

            if (content) {
              onChunk(content);
            }
          } catch (err) {
            // Ignore parse errors for incomplete JSON
          }
        }
      }

      // Keep the last incomplete line in the buffer
      buffer = lines[lines.length - 1];
    });

    res.on('end', () => {
      onComplete();
    });

    res.on('error', onError);
  });

  req.on('error', onError);
  req.write(requestData);
  req.end();
}

/**
 * Send a non-streaming chat completion request
 * @param {Object} params - Same as streamChatCompletion but without streaming callbacks
 * @returns {Promise<string>} - The complete response text
 */
function chatCompletion({ messages, model, options = {} }) {
  return new Promise((resolve, reject) => {
    const apiKey = getApiKey();

    if (!apiKey) {
      reject(new Error('No OpenRouter API key configured'));
      return;
    }

    const requestData = JSON.stringify({
      model: model || 'anthropic/claude-opus-4',
      messages,
      stream: false,
      temperature: options.temperature ?? 1.0,
      max_tokens: options.max_tokens ?? 4096,
      top_p: options.top_p ?? 0.92,
      frequency_penalty: options.frequency_penalty ?? 0,
      presence_penalty: options.presence_penalty ?? 0,
      ...options
    });

    const url = new URL(OPENROUTER_API_URL);

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/choral',
        'X-Title': 'Choral',
        'Content-Length': Buffer.byteLength(requestData)
      }
    }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`OpenRouter API error: ${res.statusCode} - ${data}`));
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.message?.content || '';
          resolve(content);
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(requestData);
    req.end();
  });
}

module.exports = {
  streamChatCompletion,
  chatCompletion
};
