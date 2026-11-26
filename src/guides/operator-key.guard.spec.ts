import { ExecutionContext } from '@nestjs/common';
import { OperatorKeyGuard } from './operator-key.guard.js';

describe('OperatorKeyGuard', () => {
  const context = (headers: Record<string, string>): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as ExecutionContext);

  const originalKey = process.env.OPERATOR_API_KEY;

  afterEach(() => {
    process.env.OPERATOR_API_KEY = originalKey;
  });

  it('allows a request with the configured operator key', () => {
    process.env.OPERATOR_API_KEY = 'test-operator-key';

    expect(new OperatorKeyGuard().canActivate(context({ 'x-operator-key': 'test-operator-key' }))).toBe(true);
  });

  it('rejects a missing, invalid, or unconfigured operator key', () => {
    process.env.OPERATOR_API_KEY = 'test-operator-key';

    expect(new OperatorKeyGuard().canActivate(context({}))).toBe(false);
    expect(new OperatorKeyGuard().canActivate(context({ 'x-operator-key': 'wrong-key' }))).toBe(false);

    delete process.env.OPERATOR_API_KEY;
    expect(new OperatorKeyGuard().canActivate(context({ 'x-operator-key': 'test-operator-key' }))).toBe(false);
  });
});
