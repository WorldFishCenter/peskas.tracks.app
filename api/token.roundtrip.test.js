import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDatabase, stopTestDatabase, callHandler } from './_utils/testHarness.js';

/**
 * Session tokens: issued at sign-in, and now required.
 *
 * These were written for step 3, when a missing token was merely recorded.
 * Step 4 inverted them: what used to assert that anonymous callers still got
 * their data now asserts that they are turned away. The inversion is the
 * change, so the old expectations are kept here in the names.
 *
 * The last block is the one to read before deploying: with no signing secret,
 * every request is refused. Harmless in step 3, total in step 4.
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

  // These three succeeded in step 3 and are refused in step 4. That is the
  // whole of the change, stated three ways.
  it('is refused with no token at all', async () => {
    const result = await waypointsFor('anyone');

    expect(result.status).toBe(401);
  });

  it('is refused with a token that does not verify', async () => {
    const result = await waypointsFor('anyone', { authorization: 'Bearer not.a.token' });

    expect(result.status).toBe(401);
  });

  it('is refused with a malformed Authorization header', async () => {
    const result = await waypointsFor('anyone', { authorization: 'Basic abc123' });

    expect(result.status).toBe(401);
  });

  it('says the same thing however the caller failed', async () => {
    const missing = await waypointsFor('anyone');
    const invalid = await waypointsFor('anyone', { authorization: 'Bearer not.a.token' });

    // Telling them which part was wrong tells them what to fix next.
    expect(missing.body).toEqual(invalid.body);
  });
});

// Read this block before deploying anywhere. In step 3 a missing secret was
// survivable: no tokens were issued, nothing was required, the app behaved as
// it always had. In step 4 it locks out every caller on that deployment,
// because a token that cannot be verified is a token that is refused — and
// none can be issued either, so nobody can obtain one.
describe('when no signing secret is configured', () => {
  beforeEach(() => {
    delete process.env.AUTH_TOKEN_SECRET;
  });

  afterAll(() => {
    process.env.AUTH_TOKEN_SECRET = SECRET;
  });

  it('signs the fisher in, but hands them no token', async () => {
    const result = await signIn('861508035295419', 'correct-horse');

    expect(result.status).toBe(200);
    expect(result.body.token).toBeNull();
  });

  it('then refuses them every endpoint, because they have nothing to present', async () => {
    const result = await callHandler(listWaypoints, { method: 'GET' });

    expect(result.status).toBe(401);
  });
});
