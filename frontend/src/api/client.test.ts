import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';

function response(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('API client', () => {
  it('adds the API prefix and tourist bearer token', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, { status: 'ok' }));
    const client = createApiClient(fetcher);

    await client.withTouristToken('secret-token').request('/tourists/context');

    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/v1/tourists/context');
    expect(options?.headers).toBeInstanceOf(Headers);
    expect((options?.headers as Headers).get('Accept')).toBe('application/json');
    expect((options?.headers as Headers).get('Authorization')).toBe('Bearer secret-token');
  });

  it('maps backend errors to safe frontend errors', async () => {
    const client = createApiClient(vi.fn().mockResolvedValue(response(401)));

    await expect(client.request('/tourists/context')).rejects.toEqual(
      new ApiError(401, 'UNAUTHORIZED', 'Your secure session has expired. Please reopen your TourGuard link.'),
    );
  });

  it('maps network failures to an unavailable error', async () => {
    const client = createApiClient(vi.fn().mockRejectedValue(new Error('network failure')));

    await expect(client.request('/tourists/context')).rejects.toMatchObject({
      code: 'UNAVAILABLE',
      status: 0,
    });
  });
});
