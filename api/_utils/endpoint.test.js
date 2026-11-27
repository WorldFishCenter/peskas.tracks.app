import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { callHandler } from './testHarness.js';
import {
  createEndpoint,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  HttpError
} from './endpoint.js';
import { issueToken } from './token.js';
import { clearRateLimit } from './rateLimit.js';

const SECRET = 'endpoint-runner-test-secret-long-enough';

beforeAll(() => {
  process.env.AUTH_TOKEN_SECRET = SECRET;
});

afterAll(() => {
  delete process.env.AUTH_TOKEN_SECRET;
});

describe('createEndpoint', () => {
  it('handles CORS preflight OPTIONS without running the handler', async () => {
    let ran = false;
    const handler = createEndpoint({ methods: ['POST'], auth: 'public', db: false }, async (_req, res) => {
      ran = true;
      return res.status(200).json({ ok: true });
    });

    const result = await callHandler(handler, { method: 'OPTIONS' });

    expect(result.status).toBe(200);
    expect(ran).toBe(false);
  });

  it('rejects disallowed HTTP methods with 405', async () => {
    const handler = createEndpoint({ methods: ['GET'], auth: 'public', db: false }, async (_req, res) =>
      res.status(200).json({ ok: true })
    );

    const result = await callHandler(handler, { method: 'DELETE' });

    expect(result.status).toBe(405);
    expect(result.body).toEqual({ error: 'Method not allowed' });
  });

  it('passes verified caller into handler while keeping Step 3 permissive for anonymous callers', async () => {
    const seen = [];
    const handler = createEndpoint({ methods: ['GET'], db: false }, async (_req, res, { caller }) => {
      seen.push(caller);
      return res.status(200).json({ role: caller?.role ?? null });
    });

    const token = await issueToken({ id: 'fisher-1', role: 'admin' });
    const authed = await callHandler(handler, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` }
    });
    const anon = await callHandler(handler, { method: 'GET' });

    expect(authed.status).toBe(200);
    expect(authed.body).toEqual({ role: 'admin' });
    expect(anon.status).toBe(200);
    expect(anon.body).toEqual({ role: null });
    expect(seen).toEqual([{ id: 'fisher-1', role: 'admin' }, null]);
  });

  it('maps domain error types consistently and hides raw 500 error messages', async () => {
    const makeThrowing = (err) =>
      createEndpoint({ methods: ['GET'], auth: 'public', db: false }, async () => {
        throw err;
      });

    expect(await callHandler(makeThrowing(new ValidationError('bad input')), { method: 'GET' }))
      .toMatchObject({ status: 400, body: { error: 'bad input' } });
    expect(await callHandler(makeThrowing(new UnauthorizedError('wrong password')), { method: 'GET' }))
      .toMatchObject({ status: 401, body: { error: 'wrong password' } });
    expect(await callHandler(makeThrowing(new ForbiddenError('admins only')), { method: 'GET' }))
      .toMatchObject({ status: 403, body: { error: 'admins only' } });
    expect(await callHandler(makeThrowing(new NotFoundError('missing record')), { method: 'GET' }))
      .toMatchObject({ status: 404, body: { error: 'missing record' } });
    expect(await callHandler(makeThrowing(new HttpError(409, 'duplicate')), { method: 'GET' }))
      .toMatchObject({ status: 409, body: { error: 'duplicate' } });

    const crash = await callHandler(
      makeThrowing(new Error('mongodb://secret:password@internal-host')),
      { method: 'GET' }
    );
    expect(crash.status).toBe(500);
    expect(crash.body).toEqual({ error: 'Internal server error' });
  });

  it('enforces per-method rate limits when configured', async () => {
    const ip = '198.51.100.42';
    clearRateLimit(ip);

    const handler = createEndpoint(
      {
        methods: ['POST'],
        auth: 'public',
        db: false,
        rateLimit: { POST: { maxRequests: 1, windowMs: 60_000, message: 'Slow down' } }
      },
      async (_req, res) => res.status(200).json({ ok: true })
    );

    const first = await callHandler(handler, { method: 'POST', headers: { 'x-forwarded-for': ip } });
    const second = await callHandler(handler, { method: 'POST', headers: { 'x-forwarded-for': ip } });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    clearRateLimit(ip);
  });
});
