import { ServiceUnavailableException, RequestTimeoutException } from '@nestjs/common';
import { OllamaClient } from './ollama.client.js';

describe('OllamaClient', () => {
  let client: OllamaClient;
  const originalBaseUrl = process.env.OLLAMA_BASE_URL;
  const originalModel = process.env.OLLAMA_MODEL;

  beforeEach(() => {
    process.env.OLLAMA_BASE_URL = 'http://ollama.test';
    process.env.OLLAMA_MODEL = 'llama3.2';
    client = new OllamaClient();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env.OLLAMA_BASE_URL = originalBaseUrl;
    process.env.OLLAMA_MODEL = originalModel;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('sends a chat request and returns the model message', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      message: { role: 'assistant', content: 'Stay with your group.' },
    }), { status: 200 }));

    await expect(client.chat([
      { role: 'user', content: 'What should I do?' },
    ])).resolves.toEqual({
      message: { role: 'assistant', content: 'Stay with your group.' },
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://ollama.test/api/chat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'llama3.2',
          stream: false,
          messages: [{ role: 'user', content: 'What should I do?' }],
        }),
      }),
    );
  });

  it('maps provider failures to a safe unavailable error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('failure', { status: 503 }));

    await expect(client.chat([])).rejects.toThrow(ServiceUnavailableException);
  });

  it('maps network failures to a safe unavailable error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('connection refused at internal host'));

    await expect(client.chat([])).rejects.toThrow(ServiceUnavailableException);
    await expect(client.chat([])).rejects.not.toThrow('connection refused');
  });

  it('maps invalid provider JSON to a safe unavailable error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not-json', { status: 200 }));

    await expect(client.chat([])).rejects.toThrow(ServiceUnavailableException);
  });

  it('times out a slow provider request', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(() => new Promise(() => undefined));

    const request = client.chat([], { timeoutMs: 50 });
    const expectation = expect(request).rejects.toThrow(RequestTimeoutException);
    await vi.advanceTimersByTimeAsync(50);

    await expectation;
  });
});
