const https = require('https');
const fs = require('fs');
const path = require('path');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Load config.json safely (returns empty object if not found)
 */
function loadConfig() {
  try {
    const configPath = path.join(__dirname, '../config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (error) {
    console.warn('Could not load config.json:', error.message);
  }
  return {};
}

const config = loadConfig();

/**
 * Get API key from config or environment
 */
function getApiKey() {
  return process.env.OPENROUTER_API_KEY || config.openRouterApiKey || '';
}

/**
 * Send a chat completion request to OpenRouter with streaming
 * @param {Object} params
 * @param {Array} params.messages - Array of message objects
 * @param {string} params.model - Model name
 * @param {Object} params.options - Additional options (temperature, max_tokens, etc.)
 * @param {Array} params.tools - Optional tool definitions for tool calling
 * @param {Array} params.stoppingStrings - Optional array of strings that stop generation
 * @param {Function} params.onChunk - Callback for each chunk of streamed data
 * @param {Function} params.onToolCall - Callback when a tool call is detected
 * @param {Function} params.onImages - Callback when AI-generated images are received
 * @param {Function} params.onComplete - Callback when streaming is complete
 * @param {Function} params.onError - Callback for errors
 * @param {Function} params.onStop - Callback when a stopping string is detected
 */
function streamChatCompletion({ messages, model, options = {}, tools, stoppingStrings, onChunk, onToolCall, onToolCallStart, onImages, onComplete, onError, onStop }) {
  const apiKey = getApiKey();

  if (!apiKey) {
    onError(new Error('No OpenRouter API key configured'));
    return;
  }

  const requestBody = {
    model: model || 'anthropic/claude-opus-4',
    messages,
    stream: true,
    temperature: options.temperature ?? 1.0,
    max_tokens: options.max_tokens ?? 4096,
    top_p: options.top_p ?? 0.92,
    frequency_penalty: options.frequency_penalty ?? 0,
    presence_penalty: options.presence_penalty ?? 0,
    ...options
  };

  // Add tools if provided
  if (tools && tools.length > 0) {
    requestBody.tools = tools;
  }

  const requestData = JSON.stringify(requestBody);

  const url = new URL(OPENROUTER_API_URL);

  const req = https.request({
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/wobufetmaster/choral',
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
    let toolCallBuffer = null; // For accumulating tool call data
    let pendingToolCall = null; // Promise for async tool execution
    let toolCallStartNotified = false; // Track if we've notified client about tool call start
    let completed = false; // Track if onComplete has been called
    let accumulatedText = ''; // For stopping string detection
    let stopped = false; // Track if we've stopped due to stopping string

    res.on('data', (chunk) => {
      if (stopped) return; // Don't process more data if we've stopped
      buffer += chunk.toString();
      const lines = buffer.split('\n');

      // Process all complete lines
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();

        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            // If we have a tool call, send it before completing
            if (toolCallBuffer && onToolCall) {
              pendingToolCall = Promise.resolve(onToolCall(toolCallBuffer));
            }

            // Wait for any pending tool call to complete before calling onComplete
            if (pendingToolCall) {
              pendingToolCall.then(() => {
                if (!completed) {
                  completed = true;
                  onComplete();
                }
              }).catch((err) => {
                console.error('Tool call error:', err);
                if (!completed) {
                  completed = true;
                  onComplete();
                }
              });
            } else {
              if (!completed) {
                completed = true;
                onComplete();
              }
            }
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            // Handle text content
            if (delta?.content) {
              accumulatedText += delta.content;

              // Check for stopping strings
              let contentToSend = delta.content;
              let shouldStop = false;

              if (stoppingStrings && stoppingStrings.length > 0) {
                for (const stopString of stoppingStrings) {
                  const stopIndex = accumulatedText.indexOf(stopString);
                  if (stopIndex !== -1) {
                    // Found a stopping string - truncate content
                    const previousLength = accumulatedText.length - delta.content.length;
                    if (stopIndex >= previousLength) {
                      // Stopping string is in current chunk
                      const relativeIndex = stopIndex - previousLength;
                      contentToSend = delta.content.substring(0, relativeIndex);
                    }
                    shouldStop = true;
                    break;
                  }
                }
              }

              // Send content if there's any to send
              if (contentToSend) {
                onChunk(contentToSend);
              }

              // Stop if we found a stopping string
              if (shouldStop) {
                stopped = true;
                if (onStop) {
                  onStop(accumulatedText.substring(0, accumulatedText.indexOf(stoppingStrings.find(s => accumulatedText.includes(s)))));
                }
                if (!completed) {
                  completed = true;
                  onComplete();
                }
                // Abort the request
                req.destroy();
                return;
              }
            }

            // Handle images in the response (AI-generated images)
            if (parsed.choices?.[0]?.message?.images && onImages) {
              const images = parsed.choices[0].message.images;
              onImages(images);
            }

            // Handle tool calls
            if (delta?.tool_calls) {
              const toolCall = delta.tool_calls[0];

              if (!toolCallBuffer) {
                // Initialize tool call buffer
                toolCallBuffer = {
                  id: toolCall.id || 'call_' + Date.now(),
                  type: toolCall.type || 'function',
                  function: {
                    name: toolCall.function?.name || '',
                    arguments: toolCall.function?.arguments || ''
                  }
                };

                // Notify client immediately when tool call starts streaming
                if (!toolCallStartNotified && onToolCallStart && toolCallBuffer.function.name) {
                  try {
                    onToolCallStart(toolCallBuffer.function.name);
                    toolCallStartNotified = true;
                  } catch (err) {
                    console.error('Error in onToolCallStart:', err);
                  }
                }
              } else {
                // Accumulate arguments
                if (toolCall.function?.arguments) {
                  toolCallBuffer.function.arguments += toolCall.function.arguments;
                }
                if (toolCall.function?.name) {
                  toolCallBuffer.function.name += toolCall.function.name;

                  // If we just got the name, notify now
                  if (!toolCallStartNotified && onToolCallStart) {
                    try {
                      onToolCallStart(toolCallBuffer.function.name);
                      toolCallStartNotified = true;
                    } catch (err) {
                      console.error('Error in onToolCallStart:', err);
                    }
                  }
                }
              }
            }

            // Check for finish reason to send tool call
            if (parsed.choices?.[0]?.finish_reason === 'tool_calls' && toolCallBuffer && onToolCall) {
              pendingToolCall = Promise.resolve(onToolCall(toolCallBuffer));
              toolCallBuffer = null;
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
      // Wait for any pending tool call before completing
      if (pendingToolCall) {
        pendingToolCall.then(() => {
          if (!completed) {
            completed = true;
            onComplete();
          }
        }).catch((err) => {
          console.error('Tool call error:', err);
          if (!completed) {
            completed = true;
            onComplete();
          }
        });
      } else {
        if (!completed) {
          completed = true;
          onComplete();
        }
      }
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
 * @param {Array} params.tools - Optional tool definitions for tool calling
 * @returns {Promise<string|Object>} - The complete response text, or full message object if tool calls present
 */
function chatCompletion({ messages, model, options = {}, tools }) {
  return new Promise((resolve, reject) => {
    const apiKey = getApiKey();

    if (!apiKey) {
      reject(new Error('No OpenRouter API key configured'));
      return;
    }

    const requestBody = {
      model: model || 'anthropic/claude-opus-4',
      messages,
      stream: false,
      temperature: options.temperature ?? 1.0,
      max_tokens: options.max_tokens ?? 4096,
      top_p: options.top_p ?? 0.92,
      frequency_penalty: options.frequency_penalty ?? 0,
      presence_penalty: options.presence_penalty ?? 0,
      ...options
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
    }

    const requestData = JSON.stringify(requestBody);

    const url = new URL(OPENROUTER_API_URL);

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/wobufetmaster/choral',
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
          const message = parsed.choices?.[0]?.message;

          // If tool calls are present, return the full message object
          if (message?.tool_calls && message.tool_calls.length > 0) {
            resolve({
              content: message.content || '',
              tool_calls: message.tool_calls
            });
          } else {
            // Otherwise, return just the content for backward compatibility
            resolve(message?.content || '');
          }
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
