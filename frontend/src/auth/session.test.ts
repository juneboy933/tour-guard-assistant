import { describe, expect, it } from 'vitest';
import { createTouristSession, extractTouristToken } from './session';

describe('tourist session', () => {
  it('extracts a token from a secure tourist link', () => {
    expect(extractTouristToken('/tourist/abc123/')).toBe('abc123');
  });

  it('rejects paths that are not secure tourist links', () => {
    expect(extractTouristToken('/')).toBeNull();
    expect(extractTouristToken('/tourist/')).toBeNull();
    expect(extractTouristToken('/tourist/token/extra')).toBeNull();
  });

  it('keeps the token in memory and supports clearing it', () => {
    const session = createTouristSession('secret-token');

    expect(session.get()).toEqual({ accessToken: 'secret-token' });
    session.clear();
    expect(session.get()).toBeNull();
  });
});
