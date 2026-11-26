import {
  Injectable,
  RequestTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: Record<string, unknown> | string;
    };
  }>;
}

export interface OllamaChatOptions {
  timeoutMs?: number;
  tools?: unknown[];
}

export interface OllamaChatResult {
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaMessage['tool_calls'];
  };
}

@Injectable()
export class OllamaClient {
  async chat(
    messages: OllamaMessage[],
    options: OllamaChatOptions = {},
  ): Promise<OllamaChatResult> {
    const baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
    const model = process.env.OLLAMA_MODEL ?? 'llama3.2';
    const timeoutMs = options.timeoutMs ?? Number(process.env.OLLAMA_TIMEOUT_MS ?? 10000);
    const controller = new AbortController();
    const payload = {
      model,
      stream: false,
      messages,
      ...(options.tools ? { tools: options.tools } : {}),
    };

    const request = fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new RequestTimeoutException('Ollama request timed out.'));
      }, timeoutMs);
    });

    try {
      const response = await Promise.race([request, timeout]);
      if (!response.ok) {
        throw new ServiceUnavailableException('Ollama is unavailable.');
      }

      const body = await response.json() as {
        message?: { role?: string; content?: string; tool_calls?: OllamaMessage['tool_calls'] };
      };
      if (!body.message?.role || typeof body.message.content !== 'string') {
        throw new ServiceUnavailableException('Ollama returned an invalid response.');
      }

      return {
        message: {
          role: body.message.role,
          content: body.message.content,
          ...(body.message.tool_calls ? { tool_calls: body.message.tool_calls } : {}),
        },
      };
    } catch (error) {
      if (error instanceof RequestTimeoutException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException('Ollama is unavailable.');
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}
