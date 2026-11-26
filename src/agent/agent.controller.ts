import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { InMemoryRateLimitGuard } from '../security/rate-limit.guard.js';
import { AgentChatDto } from './dto/agent-chat.dto.js';
import { AgentService } from './agent.service.js';

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @UseGuards(InMemoryRateLimitGuard)
  async chat(
    @Body() dto: AgentChatDto,
    @Headers('authorization') authorization?: string,
  ) {
    const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) {
      throw new UnauthorizedException('A bearer access token is required.');
    }

    const message = await this.agentService.respond(match[1], dto.message);
    return { message };
  }
}
