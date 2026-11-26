import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateLostReportTool } from './tools/create-lost-report.tool.js';
import { CreateMissingReportTool } from './tools/create-missing-report.tool.js';
import { GetGuideContactTool } from './tools/get-guide-contact.tool.js';
import { GetReportStatusTool } from './tools/get-report-status.tool.js';
import { GetTouristContextTool } from './tools/get-tourist-context.tool.js';

type JsonSchema = {
  type: 'object';
  properties: Record<string, {
    type: string;
    minLength?: number;
    minimum?: number;
    maximum?: number;
    pattern?: string;
  }>;
  required: string[];
  additionalProperties: false;
};

export interface AgentToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  execute(input: unknown): Promise<unknown>;
}

@Injectable()
export class AgentToolsService {
  constructor(
    private readonly contextTool: GetTouristContextTool,
    private readonly guideTool: GetGuideContactTool,
    private readonly lostTool: CreateLostReportTool,
    private readonly missingTool: CreateMissingReportTool,
    private readonly statusTool: GetReportStatusTool,
  ) {}

  listTools(): AgentToolDefinition[] {
    return [
      this.definition(
        'getTouristContext',
        'Get the authenticated tourist tour context.',
        this.contextTool.execute.bind(this.contextTool) as unknown as (input: unknown) => Promise<unknown>,
        ['accessToken'],
        { accessToken: { type: 'string', minLength: 1 } },
      ),
      this.definition(
        'getGuideContact',
        'Get the assigned guide contact.',
        this.guideTool.execute.bind(this.guideTool) as unknown as (input: unknown) => Promise<unknown>,
        ['accessToken'],
        { accessToken: { type: 'string', minLength: 1 } },
      ),
      this.definition(
        'createLostReport',
        'Create a lost report for the authenticated tourist.',
        this.lostTool.execute.bind(this.lostTool) as unknown as (input: unknown) => Promise<unknown>,
        ['accessToken'],
        {
          accessToken: { type: 'string', minLength: 1 },
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lng: { type: 'number', minimum: -180, maximum: 180 },
          note: { type: 'string' },
        },
      ),
      this.definition(
        'createMissingReport',
        'Create a missing report for a tourist on the same tour.',
        this.missingTool.execute.bind(this.missingTool) as unknown as (input: unknown) => Promise<unknown>,
        ['accessToken', 'missingTouristReference'],
        {
          accessToken: { type: 'string', minLength: 1 },
          missingTouristReference: { type: 'string', pattern: '^[a-f0-9]{32}$' },
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lng: { type: 'number', minimum: -180, maximum: 180 },
          note: { type: 'string' },
        },
      ),
      this.definition(
        'getReportStatus',
        'Get the authenticated tourist report status.',
        this.statusTool.execute.bind(this.statusTool) as unknown as (input: unknown) => Promise<unknown>,
        ['accessToken', 'reportReference'],
        {
          accessToken: { type: 'string', minLength: 1 },
          reportReference: { type: 'string', pattern: '^[a-f0-9]{32}$' },
        },
      ),
    ];
  }

  getTool(name: string): AgentToolDefinition {
    const tool = this.listTools().find((candidate) => candidate.name === name);
    if (!tool) {
      throw new BadRequestException('Unknown agent tool.');
    }
    return tool;
  }

  private definition(
    name: string,
    description: string,
    execute: (input: unknown) => Promise<unknown>,
    required: string[],
    properties: JsonSchema['properties'],
  ): AgentToolDefinition {
    return {
      name,
      description,
      inputSchema: {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      },
      outputSchema: this.outputSchema(name),
      execute,
    };
  }

  private outputSchema(name: string): JsonSchema {
    const schemas: Record<string, JsonSchema> = {
      getTouristContext: {
        type: 'object',
        properties: { tourist: { type: 'object' }, tour: { type: 'object' } },
        required: ['tourist', 'tour'],
        additionalProperties: false,
      },
      getGuideContact: {
        type: 'object',
        properties: { guide: { type: 'object' } },
        required: ['guide'],
        additionalProperties: false,
      },
      createLostReport: {
        type: 'object',
        properties: { report: { type: 'object' } },
        required: ['report'],
        additionalProperties: false,
      },
      createMissingReport: {
        type: 'object',
        properties: { report: { type: 'object' } },
        required: ['report'],
        additionalProperties: false,
      },
      getReportStatus: {
        type: 'object',
        properties: { report: { type: 'object' } },
        required: ['report'],
        additionalProperties: false,
      },
    };

    return schemas[name];
  }
}
