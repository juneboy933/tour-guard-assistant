import { Test, TestingModule } from '@nestjs/testing';
import { CreateLostReportTool } from './tools/create-lost-report.tool.js';
import { CreateMissingReportTool } from './tools/create-missing-report.tool.js';
import { GetGuideContactTool } from './tools/get-guide-contact.tool.js';
import { GetReportStatusTool } from './tools/get-report-status.tool.js';
import { GetTouristContextTool } from './tools/get-tourist-context.tool.js';
import { AgentToolsService } from './agent-tools.service.js';

describe('AgentToolsService', () => {
  let service: AgentToolsService;

  const toolMocks = {
    context: { execute: vi.fn() },
    guide: { execute: vi.fn() },
    lost: { execute: vi.fn() },
    missing: { execute: vi.fn() },
    status: { execute: vi.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentToolsService,
        { provide: GetTouristContextTool, useValue: toolMocks.context },
        { provide: GetGuideContactTool, useValue: toolMocks.guide },
        { provide: CreateLostReportTool, useValue: toolMocks.lost },
        { provide: CreateMissingReportTool, useValue: toolMocks.missing },
        { provide: GetReportStatusTool, useValue: toolMocks.status },
      ],
    }).compile();

    service = module.get<AgentToolsService>(AgentToolsService);
    vi.resetAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('registers exactly the five supported tools with strict schemas', () => {
    const tools = service.listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      'getTouristContext',
      'getGuideContact',
      'createLostReport',
      'createMissingReport',
      'getReportStatus',
    ]);
    expect(tools.every((tool) => tool.description.length > 0)).toBe(true);
    expect(tools.every((tool) => tool.inputSchema.type === 'object')).toBe(true);
    expect(tools.find((tool) => tool.name === 'getTouristContext')?.inputSchema.required)
      .toEqual(['accessToken']);
    expect(tools.find((tool) => tool.name === 'createMissingReport')?.inputSchema.required)
      .toEqual(['accessToken', 'missingTouristReference']);
    expect(tools.find((tool) => tool.name === 'createMissingReport')?.inputSchema.properties.missingTouristReference.pattern)
      .toBe('^[a-f0-9]{32}$');
  });

  it('publishes strict output schemas without allowing extra fields', () => {
    const tools = service.listTools();

    expect(tools.find((tool) => tool.name === 'getTouristContext')?.outputSchema).toEqual(expect.objectContaining({
      type: 'object',
      additionalProperties: false,
    }));
    expect(tools.find((tool) => tool.name === 'getGuideContact')?.outputSchema.properties)
      .toHaveProperty('guide');
    expect(tools.find((tool) => tool.name === 'createLostReport')?.outputSchema.properties)
      .toHaveProperty('report');
    expect(tools.find((tool) => tool.name === 'getReportStatus')?.outputSchema.properties)
      .toHaveProperty('report');
  });

  it('resolves a known tool and delegates execution', async () => {
    toolMocks.context.execute.mockResolvedValue({ tourist: { name: 'Demo Tourist' } });

    const tool = service.getTool('getTouristContext');
    await expect(tool.execute({ accessToken: 'raw-token' })).resolves.toEqual({
      tourist: { name: 'Demo Tourist' },
    });
    expect(toolMocks.context.execute).toHaveBeenCalledWith({ accessToken: 'raw-token' });
  });

  it('rejects unknown tool names', () => {
    expect(() => service.getTool('readDatabase')).toThrow();
  });
});
