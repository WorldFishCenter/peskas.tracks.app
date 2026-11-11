import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { callHandler } from './_utils/testHarness.js';

/**
 * Trips and points come from PDS through our server, which holds the PDS
 * token and secret. Before this they were compiled into the public bundle.
 */

const MINE = '861508035295419';
const CSV = 'Trip,Time,Lat,Lng\n1,2026-11-01T06:00:00Z,-4.1,39.6\n';

let pds;
let handler;
let issueToken;

const ask = (query, headers = {}) => callHandler(handler, { method: 'GET', query, headers });
const range = 'points/2026-11-01/2026-11-08';

function fakePds(status = 200, body = CSV) {
  pds = vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': 'text/csv' } }));
  vi.stubGlobal('fetch', pds);
}

beforeEach(async () => {
  process.env.PDS_TOKEN = 'the-token';
  process.env.PDS_SECRET = 'the-secret';
  process.env.AUTH_TOKEN_SECRET = 'test-signing-secret-that-is-long-enough';
  vi.resetModules();
  handler = (await import('./pds-history.js')).default;
  ({ issueToken } = await import('./_utils/token.js'));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PDS history', () => {
  it('passes the CSV on and keeps the token and secret on the server', async () => {
    fakePds();

    const result = await ask({ path: range, imeis: MINE, deviceInfo: 'true' });

    expect(result.status).toBe(200);
    expect(result.text).toBe(CSV);
    const [url, init] = pds.mock.calls[0];
    expect(url).toBe(`https://analytics.pelagicdata.com/api/the-token/v1/${range}?imeis=${MINE}&deviceInfo=true`);
    expect(init.headers['X-API-SECRET']).toBe('the-secret');
  });

  it('refuses paths other than trips and points, without calling PDS', async () => {
    fakePds();

    for (const path of ['', '../auth/login', 'trips/2026-11-01', 'devices/2026-11-01/2026-11-08']) {
      expect((await ask({ path, imeis: MINE })).status).toBe(400);
    }
    expect((await ask({ path: range, imeis: 'abc' })).status).toBe(400);
    expect(pds).not.toHaveBeenCalled();
  });

  it('gives the whole fleet only to a signed-in administrator', async () => {
    fakePds();
    const admin = await issueToken({ id: 'a1', role: 'admin' });
    const fisher = await issueToken({ id: 'f1', role: 'user' });

    expect((await ask({ path: range })).status).toBe(403);
    expect((await ask({ path: range }, { authorization: `Bearer ${fisher}` })).status).toBe(403);
    expect((await ask({ path: range }, { authorization: `Bearer ${admin}` })).status).toBe(200);
    expect(pds).toHaveBeenCalledTimes(1);
  });

  it('passes a PDS error on without the token or secret', async () => {
    fakePds(500, 'cannot open /data/the-token/empty_api_points.csv (the-secret)');

    const result = await ask({ path: range, imeis: MINE });

    expect(result.status).toBe(500);
    expect(result.body.error).toContain('empty_api_points.csv');
    expect(result.body.error).not.toMatch(/the-token|the-secret/);
  });
});
