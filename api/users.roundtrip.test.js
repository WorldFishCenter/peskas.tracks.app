import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { startTestDatabase, stopTestDatabase, callHandler, signedInAs } from './_utils/testHarness.js';

/**
 * Fisher accounts: what the app is willing to say about them, and who is
 * allowed to change a password.
 *
 * Passwords are currently stored as written, so the assertions that they never
 * appear in a response are doing real work — a projection quietly dropped from
 * one of these endpoints would hand every account credential to any caller,
 * and nothing on screen would look different.
 */

let db;
let listUsers;
let userById;
let changePassword;

beforeAll(async () => {
  db = await startTestDatabase();
  listUsers = (await import('./users.js')).default;
  userById = (await import('./users/[userId].js')).default;
  changePassword = (await import('./users/[userId]/change-password.js')).default;
});

afterAll(stopTestDatabase);

const kitoId = new ObjectId();
const jumaId = new ObjectId();

beforeEach(async () => {
  await db.collection('users').deleteMany({});
  await db.collection('users').insertMany([
    {
      _id: kitoId,
      IMEI: '861508035295419',
      Boat: 'Mashaallah',
      username: 'kito',
      password: 'correct-horse',
      Community: 'Fuji',
    },
    {
      _id: jumaId,
      IMEI: '862044068727895',
      Boat: 'Welshark',
      username: 'juma',
      password: 'other-secret',
      Community: 'Shela',
    },
  ]);
});

const anAdmin = new ObjectId();

describe('listing fishers', () => {
  it('returns the accounts to an administrator', async () => {
    const result = await callHandler(listUsers, {
      method: 'GET',
      headers: await signedInAs(anAdmin, 'admin'),
    });

    expect(result.status).toBe(200);
    expect(result.body.length).toBeGreaterThanOrEqual(2);
  });

  it('never returns a password', async () => {
    const result = await callHandler(listUsers, {
      method: 'GET',
      headers: await signedInAs(anAdmin, 'admin'),
    });

    expect(JSON.stringify(result.body)).not.toContain('correct-horse');
    expect(JSON.stringify(result.body)).not.toContain('other-secret');
    for (const user of result.body) {
      expect(user).not.toHaveProperty('password');
    }
  });

  // This list is what the vessel picker draws. An administrator is a person
  // with no IMEI and no Boat, so leaving them in would put a blank,
  // unselectable row in front of every administrator who opens it.
  it('leaves administrator accounts out', async () => {
    await db.collection('users').insertOne({
      username: 'lorenzo',
      password: 'admin-own-password',
      role: 'admin',
    });

    const result = await callHandler(listUsers, {
      method: 'GET',
      headers: await signedInAs(anAdmin, 'admin'),
    });

    expect(result.body.map((user) => user.username)).not.toContain('lorenzo');
    expect(result.body.map((user) => user.Boat)).toEqual(
      expect.arrayContaining(['Mashaallah', 'Welshark'])
    );
  });
});

// The fleet is what the plan's first production URL exposed: 485 fishers with
// their IMEI, community and boat, to anyone who asked.
describe('who may list the fleet', () => {
  it('refuses a caller who has not signed in', async () => {
    const result = await callHandler(listUsers, { method: 'GET' });

    expect(result.status).toBe(401);
  });

  it('refuses an ordinary fisher', async () => {
    const result = await callHandler(listUsers, {
      method: 'GET',
      headers: await signedInAs(kitoId),
    });

    expect(result.status).toBe(403);
  });
});

describe('fetching one fisher', () => {
  it('returns the account', async () => {
    const result = await callHandler(userById, {
      method: 'GET',
      query: { userId: kitoId.toHexString() },
      headers: await signedInAs(kitoId),
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ username: 'kito', Boat: 'Mashaallah' });
  });

  it('never returns the password', async () => {
    const result = await callHandler(userById, {
      method: 'GET',
      query: { userId: kitoId.toHexString() },
      headers: await signedInAs(kitoId),
    });

    expect(result.body).not.toHaveProperty('password');
    expect(JSON.stringify(result.body)).not.toContain('correct-horse');
  });

  it('reports an unknown account as missing', async () => {
    const unknown = new ObjectId();
    const result = await callHandler(userById, {
      method: 'GET',
      query: { userId: unknown.toHexString() },
      headers: await signedInAs(unknown),
    });

    expect(result.status).toBe(404);
  });

  it('refuses a fisher asking for somebody else', async () => {
    const result = await callHandler(userById, {
      method: 'GET',
      query: { userId: jumaId.toHexString() },
      headers: await signedInAs(kitoId),
    });

    expect(result.status).toBe(403);
  });

  it('lets an administrator look at any of them', async () => {
    const result = await callHandler(userById, {
      method: 'GET',
      query: { userId: jumaId.toHexString() },
      headers: await signedInAs(anAdmin, 'admin'),
    });

    expect(result.status).toBe(200);
  });
});

describe('changing a password', () => {
  // The endpoint no longer takes a userId: it changes the password of whoever
  // is signed in, so nobody can aim it at another account.
  const change = async (userId, body) =>
    callHandler(changePassword, {
      method: 'POST',
      body,
      headers: await signedInAs(userId),
    });

  const storedPassword = async (id) =>
    (await db.collection('users').findOne({ _id: id }))?.password;

  it('changes it when the current one is right', async () => {
    const result = await change(kitoId.toHexString(), {
      currentPassword: 'correct-horse',
      newPassword: 'battery-staple',
    });

    expect(result.status).toBe(200);
    expect(await storedPassword(kitoId)).toBe('battery-staple');
  });

  it('refuses when the current one is wrong, and changes nothing', async () => {
    const result = await change(kitoId.toHexString(), {
      currentPassword: 'guessing',
      newPassword: 'battery-staple',
    });

    expect(result.status).toBe(401);
    expect(await storedPassword(kitoId)).toBe('correct-horse');
  });

  // Knowing another fisher's password must not be enough to change it on an
  // account that is not theirs.
  it('refuses another fisher password against this account', async () => {
    const result = await change(kitoId.toHexString(), {
      currentPassword: 'other-secret',
      newPassword: 'battery-staple',
    });

    expect(result.status).toBe(401);
    expect(await storedPassword(kitoId)).toBe('correct-horse');
    expect(await storedPassword(jumaId)).toBe('other-secret');
  });

  it('refuses a new password shorter than six characters', async () => {
    const result = await change(kitoId.toHexString(), {
      currentPassword: 'correct-horse',
      newPassword: 'short',
    });

    expect(result.status).toBe(400);
    expect(await storedPassword(kitoId)).toBe('correct-horse');
  });

  it('refuses when either password is missing', async () => {
    const result = await change(kitoId.toHexString(), { newPassword: 'battery-staple' });

    expect(result.status).toBe(400);
    expect(await storedPassword(kitoId)).toBe('correct-horse');
  });

  it('refuses anything but POST', async () => {
    const result = await callHandler(changePassword, {
      method: 'GET',
      headers: await signedInAs(kitoId),
    });

    expect(result.status).toBe(405);
  });

  // The whole point of the change: the fisher can sign in with the new
  // password afterwards, and not with the old one.
  it('leaves the fisher able to sign in with the new password only', async () => {
    await change(kitoId.toHexString(), {
      currentPassword: 'correct-horse',
      newPassword: 'battery-staple',
    });

    const login = (await import('./auth/login.js')).default;
    const signIn = (password) =>
      callHandler(login, { method: 'POST', body: { imei: '861508035295419', password } });

    expect((await signIn('battery-staple')).status).toBe(200);
    expect((await signIn('correct-horse')).status).toBe(401);
  });
});
