import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';

describe('AgentController', () => {
  let controller: AgentController;

  const agentServiceMock = {
    respond: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentController],
      providers: [
        {
          provide: AgentService,
          useValue: agentServiceMock,
        },
      ],
    }).compile();

    controller = module.get<AgentController>(AgentController);
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('responds through the agent service using the bearer token', async () => {
    agentServiceMock.respond.mockResolvedValue('Stay with your group.');

    await expect(
      controller.chat({ message: 'What should I do?' }, 'Bearer raw-token'),
    ).resolves.toEqual({ message: 'Stay with your group.' });
    expect(agentServiceMock.respond).toHaveBeenCalledWith('raw-token', 'What should I do?');
  });

  it('rejects missing or malformed authorization headers', async () => {
    await expect(controller.chat({ message: 'Hello' }, undefined)).rejects.toThrow(UnauthorizedException);
    await expect(controller.chat({ message: 'Hello' }, 'Basic raw-token')).rejects.toThrow(UnauthorizedException);
    expect(agentServiceMock.respond).not.toHaveBeenCalled();
  });
});
