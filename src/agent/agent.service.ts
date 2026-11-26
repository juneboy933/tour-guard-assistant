import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AgentToolsService } from './agent-tools.service.js';
import { AGENT_SYSTEM_PROMPT } from './system-prompt.js';
import { OllamaClient, OllamaMessage } from './ollama.client.js';

@Injectable()
export class AgentService {
  constructor(
    private readonly ollama: OllamaClient,
    private readonly tools: AgentToolsService,
  ) {}

  async respond(accessToken: string, userMessage: string): Promise<string> {
    if (!accessToken.trim() || !userMessage.trim()) {
      throw new BadRequestException('Access token and message are required.');
    }

    const toolDefinitions = this.tools.listTools();
    const ollamaTools = toolDefinitions.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
    const messages: OllamaMessage[] = [
      { role: 'system', content: AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ];

    const firstResponse = await this.callOllama(messages, ollamaTools);
    const toolCalls = firstResponse.message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return firstResponse.message.content;
    }

    messages.push({
      role: 'assistant',
      content: firstResponse.message.content,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      let toolResult: unknown;
      try {
        const tool = this.tools.getTool(toolCall.function.name);
        const argumentsValue = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
        if (typeof argumentsValue !== 'object' || argumentsValue === null || Array.isArray(argumentsValue)) {
          throw new Error('Invalid tool arguments.');
        }
        toolResult = await tool.execute({
          ...argumentsValue,
          accessToken,
        });
      } catch {
        toolResult = { error: 'Unable to complete the requested action.' };
      }
      messages.push({
        role: 'tool',
        content: JSON.stringify(toolResult),
      });
    }

    const finalResponse = await this.callOllama(messages, ollamaTools);
    return finalResponse.message.content;
  }

  private async callOllama(messages: OllamaMessage[], tools: unknown[]) {
    try {
      return await this.ollama.chat(messages, { tools });
    } catch {
      throw new ServiceUnavailableException('The assistant is temporarily unavailable.');
    }
  }
}
