import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { AgentToolsService } from './agent-tools.service.js';
import { AgentService } from './agent.service.js';
import { OllamaClient } from './ollama.client.js';

describe('AgentService', () => {
  let service: AgentService;

  const ollamaMock = {
    chat: vi.fn(),
  };
  const toolsMock = {
    listTools: vi.fn(),
    getTool: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: OllamaClient, useValue: ollamaMock },
        { provide: AgentToolsService, useValue: toolsMock },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    vi.resetAllMocks();
    toolsMock.listTools.mockReturnValue([
      {
        name: 'getTouristContext',
        description: 'Get tourist context.',
        inputSchema: {
          type: 'object',
          properties: { accessToken: { type: 'string' } },
          required: ['accessToken'],
          additionalProperties: false,
        },
      },
    ]);
  });

  it('returns a direct Ollama response', async () => {
    ollamaMock.chat.mockResolvedValue({
      message: { role: 'assistant', content: 'Stay with your group.' },
    });

    await expect(service.respond('raw-token', 'What should I do?')).resolves.toBe('Stay with your group.');
    expect(ollamaMock.chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'What should I do?' }),
      ]),
      expect.objectContaining({ tools: [
        expect.objectContaining({
          type: 'function',
          function: expect.objectContaining({ name: 'getTouristContext' }),
        }),
      ] }),
    );
  });

  it('maps unexpected Ollama failures to a safe unavailable error', async () => {
    ollamaMock.chat.mockRejectedValue(new Error('internal model host details'));

    await expect(service.respond('raw-token', 'What should I do?'))
      .rejects.toThrow(ServiceUnavailableException);
    await expect(service.respond('raw-token', 'What should I do?'))
      .rejects.not.toThrow('internal model host details');
  });

  it('executes one authorized tool call and sends its result back to Ollama', async () => {
    ollamaMock.chat
      .mockResolvedValueOnce({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{
            function: {
              name: 'getTouristContext',
              arguments: {},
            },
          }],
        },
      })
      .mockResolvedValueOnce({
        message: { role: 'assistant', content: 'Your tour starts at 8:00 AM.' },
      });
    toolsMock.getTool.mockReturnValue({
      execute: vi.fn().mockResolvedValue({ tour: { name: 'City Tour' } }),
    });

    await expect(service.respond('raw-token', 'When does my tour start?'))
      .resolves.toBe('Your tour starts at 8:00 AM.');
    expect(toolsMock.getTool).toHaveBeenCalledWith('getTouristContext');
    expect(toolsMock.getTool('getTouristContext').execute).toHaveBeenCalledWith({
      accessToken: 'raw-token',
    });
    expect(ollamaMock.chat).toHaveBeenCalledTimes(2);
  });

  it('returns a safe tool error when model arguments are malformed', async () => {
    ollamaMock.chat
      .mockResolvedValueOnce({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{
            function: { name: 'getTouristContext', arguments: '{invalid-json' },
          }],
        },
      })
      .mockResolvedValueOnce({ message: { role: 'assistant', content: 'I could not retrieve that.' } });

    await expect(service.respond('raw-token', 'Show my tour.')).resolves.toBe('I could not retrieve that.');
    expect(ollamaMock.chat.mock.calls[1][0]).toContainEqual({
      role: 'tool',
      content: JSON.stringify({ error: 'Unable to complete the requested action.' }),
    });
  });

  it('returns a safe tool error when a tool fails', async () => {
    ollamaMock.chat
      .mockResolvedValueOnce({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{
            function: { name: 'getTouristContext', arguments: {} },
          }],
        },
      })
      .mockResolvedValueOnce({ message: { role: 'assistant', content: 'I could not retrieve that.' } });
    toolsMock.getTool.mockReturnValue({
      execute: vi.fn().mockRejectedValue(new Error('sensitive database detail')),
    });

    await expect(service.respond('raw-token', 'Show my tour.')).resolves.toBe('I could not retrieve that.');
    const toolMessage = ollamaMock.chat.mock.calls[1][0].find((message: { role: string }) => message.role === 'tool');
    expect(toolMessage.content).toBe(JSON.stringify({ error: 'Unable to complete the requested action.' }));
    expect(toolMessage.content).not.toContain('sensitive database detail');
  });
});
