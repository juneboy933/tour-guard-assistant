import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

export class RateLimitException extends HttpException {
  constructor() {
    super('Too many requests.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

@Injectable()
export class InMemoryRateLimitGuard implements CanActivate {
  private readonly entries = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor() {
    this.maxRequests = this.readPositiveEnv('RATE_LIMIT_MAX_REQUESTS', 30);
    this.windowMs = this.readPositiveEnv('RATE_LIMIT_WINDOW_MS', 60_000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ ip?: string }>();
    const key = request.ip ?? 'unknown';
    const now = Date.now();
    const existing = this.entries.get(key);

    if (!existing || existing.resetAt <= now) {
      this.entries.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (existing.count >= this.maxRequests) {
      throw new RateLimitException();
    }

    existing.count += 1;
    return true;
  }

  private readPositiveEnv(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
