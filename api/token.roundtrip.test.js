import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDatabase, stopTestDatabase, callHandler } from './_utils/testHarness.js';

/**
 * Session tokens: issued at sign-in, accepted afterwards, and required by
 * nobody yet.
 *
 * This is step 3 of docs/API-AUTH-PLAN.md, whose whole point is that it
 * changes nothing a caller can feel. The tests that matter most here are
 * therefore the ones asserting that requests *without* a token still work —
 * if those ever start failing, the step has quietly become step 4 and
 * somebody is locked out.
 */

const SECRET = 'test-signing-secret-that-is-long-enough';
const GLOBAL_PASSWORD = 'test-global-password';

let db;
let login;
let listWaypoints;

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.AUTH_TOKEN_SECRET = SECRET;
  process.env.GLOBAL_PASSW = GLOBAL_PASSWORD;

  login = (await import('./auth/login.js')).default;
  listWaypoints = (await import('./waypoints.js')).default;
});

afterAll(stopTestDatabase);

beforeEach(async () => {
  await db.collection('users').deleteMany({});
  await db.collection('waypoints').deleteMany({});
  await db.collection('users').insertOne({
    IMEI: '861508035295419',
    Boat: 'Mashaallah',
    username: 'kito',
    password: 'correct-horse',
    Community: 'Fuji',
  });
});

const signIn = (imei, password) =>
  callHandler(login, { method: 'POST', body: { imei, password } });

describe('signing in', () => {
  it('hands back a token', async () => {
    const result = await signIn('861508035295419', 'correct-horse');

    expect(result.status).toBe(200);
    expect(typeof result.body.token).toBe('string');
    // header.payload.signature
    expect(result.body.token.split('.')).toHaveLength(3);
  });

  it('names the signed-in fisher in the token, and nothing secret', async () => {
    const { body } = await signIn('861508035295419', 'correct-horse');

    const [, payload] = body.token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());

    expect(claims.sub).toBe(body.id);
    expect(claims.role).toBe('user');
    // A signed token is readable by whoever holds it.
    expect(JSON.stringify(claims)).not.toContain('correct-horse');
    expect(JSON.stringify(claims)).not.toContain('861508035295419');
  });

  it('expires the token roughly thirty days out', async () => {
    const { body } = await signIn('861508035295419', 'correct-horse');

    const [, payload] = body.token.split('.');
    const { iat, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());

    const days = (exp - iat) / 86400;
    expect(days).toBeCloseTo(30, 1);
  });

  it('says so in the token when the caller is an administrator', async () => {
    await db.collection('users').insertOne({
      username: 'lorenzo',
      password: 'admin-own-password',
      role: 'admin',
    });

    const { body } = await signIn('lorenzo', 'admin-own-password');

    const [, payload] = body.token.split('.');
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString()).role).toBe('admin');
  });

  it('still refuses a wrong password, token or no token', async () => {
    const result = await signIn('861508035295419', 'guessing');

    expect(result.status).toBe(401);
    expect(result.body.token).toBeUndefined();
  });
});

describe('calling an endpoint', () => {
  const waypointsFor = (userId, headers) =>
    callHandler(listWaypoints, { method: 'GET', query: { userId }, headers });

  it('succeeds with a valid token', async () => {
    const { body } = await signIn('861508035295419', 'correct-horse');

    const result = await waypointsFor(body.id, { authorization: `Bearer ${body.token}` });

    expect(result.status).toBe(200);
  });

  // The three below are the heart of step 3: nothing is rejected yet.
  it('still succeeds with no token at all', async () => {
    const result = await waypointsFor('anyone');

    expect(result.status).toBe(200);
  });

  it('still succeeds with a token that does not verify', async () => {
    const result = await waypointsFor('anyone', { authorization: 'Bearer not.a.token' });

    expect(result.status).toBe(200);
  });

  it('still succeeds with a malformed Authorization header', async () => {
    const result = await waypointsFor('anyone', { authorization: 'Basic abc123' });

    expect(result.status).toBe(200);
  });
});

describe('when no signing secret is configured', () => {
  beforeEach(() => {
    delete process.env.AUTH_TOKEN_SECRET;
  });

  afterAll(() => {
    process.env.AUTH_TOKEN_SECRET = SECRET;
  });

  it('signs the fisher in anyway, without a token', async () => {
    const result = await signIn('861508035295419', 'correct-horse');

    expect(result.status).toBe(200);
    expect(result.body.name).toBe('Mashaallah');
    expect(result.body.token).toBeNull();
  });

  it('leaves the endpoints answering as they always did', async () => {
    const result = await callHandler(listWaypoints, {
      method: 'GET',
      query: { userId: 'anyone' },
    });

    expect(result.status).toBe(200);
  });
});
