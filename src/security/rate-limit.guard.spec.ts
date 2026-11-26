import { ExecutionContext } from '@nestjs/common';
import { InMemoryRateLimitGuard, RateLimitException } from './rate-limit.guard.js';

describe('InMemoryRateLimitGuard', () => {
  const originalMax = process.env.RATE_LIMIT_MAX_REQUESTS;
  const originalWindow = process.env.RATE_LIMIT_WINDOW_MS;
  const requestContext = (ip: string): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
    }),
  } as ExecutionContext);

  afterEach(() => {
    process.env.RATE_LIMIT_MAX_REQUESTS = originalMax;
    process.env.RATE_LIMIT_WINDOW_MS = originalWindow;
    vi.useRealTimers();
  });

  it('allows requests up to the configured limit per client', () => {
    process.env.RATE_LIMIT_MAX_REQUESTS = '2';
    process.env.RATE_LIMIT_WINDOW_MS = '1000';
    const guard = new InMemoryRateLimitGuard();

    expect(guard.canActivate(requestContext('10.0.0.1'))).toBe(true);
    expect(guard.canActivate(requestContext('10.0.0.1'))).toBe(true);
    expect(() => guard.canActivate(requestContext('10.0.0.1'))).toThrow(RateLimitException);
    expect(guard.canActivate(requestContext('10.0.0.2'))).toBe(true);
  });

  it('resets a client window after the configured duration', () => {
    vi.useFakeTimers();
    process.env.RATE_LIMIT_MAX_REQUESTS = '1';
    process.env.RATE_LIMIT_WINDOW_MS = '1000';
    const guard = new InMemoryRateLimitGuard();

    expect(guard.canActivate(requestContext('10.0.0.1'))).toBe(true);
    expect(() => guard.canActivate(requestContext('10.0.0.1'))).toThrow(RateLimitException);

    vi.advanceTimersByTime(1000);
    expect(guard.canActivate(requestContext('10.0.0.1'))).toBe(true);
  });
});
