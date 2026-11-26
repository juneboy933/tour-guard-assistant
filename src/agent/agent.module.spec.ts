import { Test, TestingModule } from '@nestjs/testing';
import { AgentModule } from './agent.module.js';
import { AgentToolsService } from './agent-tools.service.js';

describe('AgentModule', () => {
  it('provides the agent tools facade', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AgentModule],
    }).compile();

    const tools = module.get<AgentToolsService>(AgentToolsService);
    expect(tools.listTools()).toHaveLength(5);
  });
});
