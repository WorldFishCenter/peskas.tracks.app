import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, externalFetch } from './httpClient';

/**
 * These pin the plumbing the service modules now rely on: where a request
 * goes, and what it carries. `fetch` is stubbed, so nothing here touches the
 * network.
 */

let calls: Array<{ url: string; init: RequestInit }>;

const store = new Map<string, string>();

beforeEach(() => {
  calls = [];
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key)
  });
  vi.stubGlobal('fetch', (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return Promise.resolve(new Response('{}', { status: 200 }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const lastCall = () => calls[calls.length - 1];

describe('apiFetch', () => {
  it('resolves paths against /api', async () => {
    await apiFetch('/waypoints');

    expect(lastCall().url).toBe('/api/waypoints');
    expect(lastCall().init.method).toBe('GET');
  });

  it('appends query parameters and encodes them', async () => {
    await apiFetch('/waypoints', { query: { userId: 'a b/c' } });

    expect(lastCall().url).toBe('/api/waypoints?userId=a+b%2Fc');
  });

  it('drops absent query parameters rather than sending empty ones', async () => {
    await apiFetch('/fisher-stats/123', {
      query: { dateFrom: '2026-01-01', dateTo: undefined, compareWith: null }
    });

    expect(lastCall().url).toBe('/api/fisher-stats/123?dateFrom=2026-01-01');
  });

  it('leaves the URL alone when every query parameter is absent', async () => {
    await apiFetch('/fisher-stats/123', { query: { dateFrom: undefined } });

    expect(lastCall().url).toBe('/api/fisher-stats/123');
  });

  it('sends an object body as JSON', async () => {
    await apiFetch('/feedback', { method: 'POST', body: { type: 'bug', message: 'hi' } });

    expect(lastCall().init.method).toBe('POST');
    expect(lastCall().init.body).toBe('{"type":"bug","message":"hi"}');
    expect(lastCall().init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('passes a string body through untouched', async () => {
    await apiFetch('/feedback', { method: 'POST', body: 'already-serialised' });

    expect(lastCall().init.body).toBe('already-serialised');
  });

  it('keeps caller headers, and lets them override the default content type', async () => {
    await apiFetch('/feedback', {
      method: 'POST',
      body: { a: 1 },
      headers: { 'Content-Type': 'text/plain', Accept: 'application/json' }
    });

    expect(lastCall().init.headers).toEqual({
      'Content-Type': 'text/plain',
      Accept: 'application/json'
    });
  });

  it('sends no body and no signal when none were asked for', async () => {
    await apiFetch('/users');

    expect(lastCall().init.body).toBeUndefined();
    expect(lastCall().init.signal).toBeUndefined();
  });
});

describe('externalFetch', () => {
  it('uses the absolute URL as given, without the /api prefix', async () => {
    await externalFetch('https://analytics.example.com/v1/trips/2026-01-01/2026-01-02');

    expect(lastCall().url).toBe('https://analytics.example.com/v1/trips/2026-01-01/2026-01-02');
  });

  it('appends query parameters after an existing query string', async () => {
    await externalFetch('https://analytics.example.com/v1/points?imeis=1,2', {
      query: { format: 'csv' }
    });

    expect(lastCall().url).toBe('https://analytics.example.com/v1/points?imeis=1,2&format=csv');
  });
});

describe('timeouts', () => {
  it('aborts the request once timeoutMs elapses', async () => {
    vi.stubGlobal('fetch', (_url: string, init: RequestInit = {}) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })
    );

    await expect(apiFetch('/users', { timeoutMs: 10 })).rejects.toMatchObject({
      name: 'TimeoutError'
    });
  });

  it("honours the caller's own signal alongside the timeout", async () => {
    vi.stubGlobal('fetch', (_url: string, init: RequestInit = {}) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })
    );

    const controller = new AbortController();
    const pending = apiFetch('/users', { timeoutMs: 30_000, signal: controller.signal });
    controller.abort(new Error('caller changed its mind'));

    await expect(pending).rejects.toThrow('caller changed its mind');
  });
});

describe('the session token', () => {
  it('rides along with our own API calls', async () => {
    store.set('authToken', 'a.signed.token');

    await apiFetch('/waypoints');

    expect(lastCall().init.headers).toMatchObject({
      Authorization: 'Bearer a.signed.token'
    });
  });

  // The point of keeping externalFetch separate. A session token sent to
  // another host is a credential handed to a stranger, and the Pelagic
  // Analytics API has no business holding ours.
  it('never leaves our own origin', async () => {
    store.set('authToken', 'a.signed.token');

    await externalFetch('https://analytics.example.com/v1/trips');

    expect(JSON.stringify(lastCall().init.headers ?? {})).not.toContain('a.signed.token');
  });

  it('is simply absent when nobody is signed in', async () => {
    await apiFetch('/users');

    expect(lastCall().init.headers).not.toHaveProperty('Authorization');
  });

  it('does not displace an Authorization header a caller set itself', async () => {
    store.set('authToken', 'a.signed.token');

    await apiFetch('/users', { headers: { Authorization: 'Bearer something-else' } });

    expect(lastCall().init.headers).toMatchObject({
      Authorization: 'Bearer something-else'
    });
  });

  it('carries on unauthenticated when localStorage refuses to answer', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('access denied'); }
    });

    await expect(apiFetch('/users')).resolves.toBeDefined();
    expect(lastCall().init.headers).not.toHaveProperty('Authorization');
  });
});
