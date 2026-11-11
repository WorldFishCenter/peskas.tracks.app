import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { callHandler } from './_utils/testHarness.js';

/**
 * Live locations come from PDS through our server, which holds the PDS login.
 * PDS suspended the account once for logging in too often, so the number of
 * logins is what these tests count.
 */

const MINE = '861508035295419';
const OTHER = '862044068727895';
const HOUR = 60 * 60 * 1000;

const jwt = (expiresInMs) =>
  `x.${Buffer.from(JSON.stringify({ exp: Math.floor((Date.now() + expiresInMs) / 1000) })).toString('base64url')}.x`;

let pds;
let handler;

const logins = () => pds.mock.calls.filter(([url]) => url.endsWith('/auth/login')).length;
const ask = (imeis) => callHandler(handler, { method: 'GET', query: { imeis } });

function fakePds({ loginStatus = 200, devices = [{ imei: Number(MINE), lat: -4, lng: 39 }] } = {}) {
  pds = vi.fn(async (url) => {
    if (url.endsWith('/auth/login')) {
      return new Response(JSON.stringify({ token: jwt(HOUR) }), { status: loginStatus });
    }
    return new Response(JSON.stringify(devices), { status: 200 });
  });
  vi.stubGlobal('fetch', pds);
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  process.env.PDS_USERNAME = 'user';
  process.env.PDS_PASSWORD = 'pass';
  process.env.PDS_CUSTOMER_ID = 'customer';
  vi.resetModules();
  handler = (await import('./live-locations.js')).default;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('live locations', () => {
  it('logs in once for many requests', async () => {
    fakePds();

    await Promise.all([ask(MINE), ask(MINE)]);
    const result = await ask(MINE);

    expect(result.status).toBe(200);
    expect(logins()).toBe(1);
  });

  it('logs in again once the token has expired', async () => {
    fakePds();

    await ask(MINE);
    vi.setSystemTime(Date.now() + HOUR);
    await ask(MINE);

    expect(logins()).toBe(2);
  });

  it('returns only the vessels asked for', async () => {
    fakePds({ devices: [{ imei: Number(MINE) }, { imei: Number(OTHER) }] });

    const result = await ask(MINE);

    expect(result.body.map((device) => String(device.imei))).toEqual([MINE]);
  });

  it('refuses a request without IMEIs and does not call PDS', async () => {
    fakePds();

    expect((await ask('')).status).toBe(400);
    expect((await ask('abc')).status).toBe(400);
    expect(pds).not.toHaveBeenCalled();
  });

  it('after a refused login, waits five minutes before trying again', async () => {
    fakePds({ loginStatus: 401 });

    expect((await ask(MINE)).status).toBe(503);
    expect((await ask(MINE)).status).toBe(503);
    expect(logins()).toBe(1);

    vi.setSystemTime(Date.now() + 5 * 60 * 1000);
    await ask(MINE);
    expect(logins()).toBe(2);
  });
});
