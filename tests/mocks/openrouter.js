import { vi } from 'vitest';

export const mockStreamingResponse = async function* () {
  const chunks = [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" there"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"!"}}]}\n\n',
    'data: [DONE]\n\n'
  ];

  for (const chunk of chunks) {
    yield chunk;
  }
};

export const mockNonStreamingResponse = {
  choices: [
    {
      message: {
        role: 'assistant',
        content: 'Hello there!'
      }
    }
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15
  }
};

export const mockErrorResponse = {
  error: {
    message: 'Rate limit exceeded',
    type: 'rate_limit_error',
    code: 'rate_limit_exceeded'
  }
};

export const streamChatCompletion = vi.fn().mockImplementation(mockStreamingResponse);
export const chatCompletion = vi.fn().mockResolvedValue(mockNonStreamingResponse);
