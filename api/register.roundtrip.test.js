import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDatabase, stopTestDatabase, callHandler } from './_utils/testHarness.js';

/**
 * A fisher signing themselves up without a tracking device.
 *
 * The account they create has to be one they can then sign in with, and it has
 * to be marked as having no device — the app keys several decisions off that,
 * and a self-registered fisher whose account looks device-tracked ends up
 * staring at an empty map.
 */

let db;
let register;
let login;

beforeAll(async () => {
  db = await startTestDatabase();
  register = (await import('./auth/register.js')).default;
  login = (await import('./auth/login.js')).default;
});

afterAll(stopTestDatabase);

beforeEach(async () => {
  await db.collection('users').deleteMany({});
});

const anApplication = (overrides = {}) => ({
  username: 'kito',
  phoneNumber: '+255700000000',
  country: 'Tanzania',
  vesselType: 'Canoe',
  mainGearType: 'Handline',
  boatName: 'Mashaallah',
  password: 'correct-horse',
  ...overrides,
});

const signUp = (body) => callHandler(register, { method: 'POST', body });

describe('signing up', () => {
  it('creates the account', async () => {
    const result = await signUp(anApplication());

    expect(result.status).toBe(201);
    expect(result.body.userId).toBeTruthy();

    const stored = await db.collection('users').findOne({ username: 'kito' });
    expect(stored).toMatchObject({
      username: 'kito',
      Boat: 'Mashaallah',
      registrationType: 'self-registered',
    });
  });

  it('marks the fisher as having no tracking device', async () => {
    await signUp(anApplication());

    const stored = await db.collection('users').findOne({ username: 'kito' });
    expect(stored.IMEI).toBeNull();
    expect(stored.hasImei).toBe(false);
  });

  it('leaves the fisher able to sign in straight away', async () => {
    await signUp(anApplication());

    const signedIn = await callHandler(login, {
      method: 'POST',
      body: { imei: 'kito', password: 'correct-horse' },
    });

    expect(signedIn.status).toBe(200);
    expect(signedIn.body.hasImei).toBe(false);
  });

  it('never echoes the password back', async () => {
    const result = await signUp(anApplication());

    expect(JSON.stringify(result.body)).not.toContain('correct-horse');
  });
});

describe('refusing to sign up', () => {
  it('refuses a username already taken', async () => {
    await signUp(anApplication());
    const second = await signUp(anApplication({ password: 'different-one' }));

    expect(second.status).toBe(409);
    expect(await db.collection('users').countDocuments({ username: 'kito' })).toBe(1);
  });

  // Sign-in matches the username without regard to case, so sign-up has to
  // refuse the same way. Otherwise two accounts exist that both answer to the
  // same name and only one of them can ever be signed into.
  it('refuses a username that differs only by case', async () => {
    await signUp(anApplication());
    const second = await signUp(anApplication({ username: 'KITO' }));

    expect(second.status).toBe(409);
    expect(await db.collection('users').countDocuments()).toBe(1);
  });

  it('refuses a password shorter than six characters', async () => {
    const result = await signUp(anApplication({ password: 'short' }));

    expect(result.status).toBe(400);
    expect(await db.collection('users').countDocuments()).toBe(0);
  });

  it('refuses an application with no password', async () => {
    const result = await signUp(anApplication({ password: undefined }));

    expect(result.status).toBe(400);
    expect(await db.collection('users').countDocuments()).toBe(0);
  });

  it('refuses a vessel that needs a name and has none', async () => {
    const result = await signUp(anApplication({ boatName: undefined }));

    expect(result.status).toBe(400);
    expect(await db.collection('users').countDocuments()).toBe(0);
  });

  it('refuses anything but POST', async () => {
    const result = await callHandler(register, { method: 'GET' });

    expect(result.status).toBe(405);
  });
});
