import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDatabase, stopTestDatabase, callHandler } from './_utils/testHarness.js';

/**
 * Who gets in, who does not, and what the app hands back when they do.
 *
 * A fisher may sign in with their device IMEI, their vessel name or their
 * username, so the tests below cover all three — and the cases where sign-in
 * must fail, which are the ones that do not announce themselves in manual
 * testing.
 */

let db;
let login;

const GLOBAL_PASSWORD = 'test-global-password';

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.GLOBAL_PASSW = GLOBAL_PASSWORD;
  login = (await import('./auth/login.js')).default;
});

afterAll(stopTestDatabase);

beforeEach(async () => {
  await db.collection('users').deleteMany({});
  await db.collection('users').insertMany([
    {
      IMEI: '861508035295419',
      Boat: 'Mashaallah',
      username: 'kito',
      password: 'correct-horse',
      Community: 'Fuji',
      Region: 'Zanzibar',
    },
    {
      IMEI: '862044068727895',
      Boat: 'Welshark',
      username: 'juma',
      password: 'other-secret',
      Community: 'Shela',
    },
  ]);
});

const signIn = (imei, password) =>
  callHandler(login, { method: 'POST', body: { imei, password } });

describe('signing in', () => {
  it('accepts the device IMEI and the right password', async () => {
    const result = await signIn('861508035295419', 'correct-horse');

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      name: 'Mashaallah',
      username: 'kito',
      imeis: ['861508035295419'],
      role: 'user',
      community: 'Fuji',
      hasImei: true,
    });
  });

  it('accepts the vessel name, whatever the casing', async () => {
    const result = await signIn('mAsHaAlLaH', 'correct-horse');

    expect(result.status).toBe(200);
    expect(result.body.imeis).toEqual(['861508035295419']);
  });

  it('accepts the username, whatever the casing', async () => {
    const result = await signIn('KITO', 'correct-horse');

    expect(result.status).toBe(200);
    expect(result.body.username).toBe('kito');
  });
});

describe('refusing to sign in', () => {
  it('rejects the wrong password', async () => {
    const result = await signIn('861508035295419', 'wrong');

    expect(result.status).toBe(401);
  });

  it('rejects another fisher password', async () => {
    const result = await signIn('861508035295419', 'other-secret');

    expect(result.status).toBe(401);
  });

  it('rejects an unknown identifier', async () => {
    const result = await signIn('000000000000000', 'correct-horse');

    expect(result.status).toBe(401);
  });

  it('rejects a missing password', async () => {
    const result = await signIn('861508035295419', '');

    expect(result.status).toBe(400);
  });

  it('refuses anything but POST', async () => {
    const result = await callHandler(login, { method: 'GET' });

    expect(result.status).toBe(405);
  });

  // The vessel-name and username lookups build a regex from user input. Left
  // unescaped, ".*" would match every vessel and sign the caller in as
  // whichever came back first.
  it('does not treat a regex as a wildcard identifier', async () => {
    const result = await signIn('.*', 'correct-horse');

    expect(result.status).toBe(401);
  });

  it('does not let an anchored regex match a real vessel', async () => {
    const result = await signIn('^Mash', 'correct-horse');

    expect(result.status).toBe(401);
  });
});

describe('what a successful sign-in hands back', () => {
  it('never includes the password', async () => {
    const result = await signIn('861508035295419', 'correct-horse');

    expect(JSON.stringify(result.body)).not.toContain('correct-horse');
    expect(result.body).not.toHaveProperty('password');
  });

  // Self-registered fishers have no tracking device, and the app keys several
  // decisions off hasImei.
  it('marks a fisher with no tracking device', async () => {
    await db.collection('users').insertOne({
      username: 'shore-only',
      password: 'pw123456',
      IMEI: null,
    });

    const result = await signIn('shore-only', 'pw123456');

    expect(result.status).toBe(200);
    expect(result.body.hasImei).toBe(false);
    expect(result.body.imeis).toEqual([]);
  });
});

describe('the global administrator password', () => {
  it('signs in as any vessel without that vessel password', async () => {
    const result = await signIn('861508035295419', GLOBAL_PASSWORD);

    expect(result.status).toBe(200);
    expect(result.body.role).toBe('admin');
  });

  it('still requires the vessel to exist', async () => {
    const result = await signIn('000000000000000', GLOBAL_PASSWORD);

    expect(result.status).toBe(401);
  });

  it('grants only the ordinary role to a fisher own password', async () => {
    const result = await signIn('861508035295419', 'correct-horse');

    expect(result.body.role).toBe('user');
  });
});
