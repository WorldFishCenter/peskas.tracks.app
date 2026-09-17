import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDatabase, stopTestDatabase, callHandler } from './_utils/testHarness.js';

/**
 * Two smaller features that still have to work: a fisher sending feedback,
 * and the demo account used for showing the app to people.
 */

let db;
let feedback;
let demoLogin;

beforeAll(async () => {
  db = await startTestDatabase();

  feedback = (await import('./feedback.js')).default;
  demoLogin = (await import('./auth/demo-login.js')).default;
});

afterAll(stopTestDatabase);

beforeEach(async () => {
  await db.collection('feedback').deleteMany({});
  await db.collection('users').deleteMany({});
});

describe('sending feedback', () => {
  const send = (body) => callHandler(feedback, { method: 'POST', body });

  it('stores what the fisher wrote', async () => {
    const result = await send({
      type: 'problem',
      message: 'The map does not load on my phone',
      imei: '861508035295419',
    });

    expect(result.status).toBe(201);

    const [stored] = await db.collection('feedback').find({}).toArray();
    expect(stored).toMatchObject({
      type: 'problem',
      message: 'The map does not load on my phone',
      imei: '861508035295419',
    });
  });

  it('accepts feedback from a fisher who has no tracking device', async () => {
    const result = await send({ type: 'suggestion', message: 'Add Kiswahili numbers', username: 'kito' });

    expect(result.status).toBe(201);
    expect(await db.collection('feedback').countDocuments({ username: 'kito' })).toBe(1);
  });

  it('refuses feedback with no message', async () => {
    const result = await send({ type: 'problem', imei: '861508035295419' });

    expect(result.status).toBe(400);
    expect(await db.collection('feedback').countDocuments()).toBe(0);
  });

  it('refuses a type outside the recorded vocabulary', async () => {
    const result = await send({ type: 'bug', message: 'Something', imei: '861508035295419' });

    expect(result.status).toBe(400);
    expect(await db.collection('feedback').countDocuments()).toBe(0);
  });

  it('refuses feedback with no type', async () => {
    const result = await send({ message: 'Something', imei: '861508035295419' });

    expect(result.status).toBe(400);
    expect(await db.collection('feedback').countDocuments()).toBe(0);
  });

  // Without an identifier the report cannot be traced back to anyone, which
  // makes it useless to act on.
  it('refuses feedback from nobody in particular', async () => {
    const result = await send({ type: 'problem', message: 'Something' });

    expect(result.status).toBe(400);
    expect(await db.collection('feedback').countDocuments()).toBe(0);
  });
});

describe('the demo account', () => {
  it('signs in without any account in the database, and is marked as demo', async () => {
    const result = await callHandler(demoLogin, { method: 'POST', body: {} });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ role: 'demo', isDemoMode: true, hasImei: true });
    expect(result.body.imeis).toHaveLength(1);
  });

  // The demo used to sign in as a real vessel, and everything it returned
  // reached a stranger's browser. Nothing in a real users document may leak
  // into it, even when one exists that the old code would have picked.
  it('carries nothing from a real vessel', async () => {
    await db.collection('users').insertOne({
      IMEI: '869999999999999',
      Boat: 'Mashaallah',
      password: 'secret',
      Community: 'Fuji',
      Region: 'Pemba'
    });
    process.env.DEMO_IMEI = '869999999999999';
    process.env.DEMO_PASSWORD = 'secret';

    try {
      const result = await callHandler(demoLogin, { method: 'POST', body: {} });
      const body = JSON.stringify(result.body);

      for (const real of ['869999999999999', 'Mashaallah', 'secret', 'Fuji', 'Pemba']) {
        expect(body).not.toContain(real);
      }
    } finally {
      delete process.env.DEMO_IMEI;
      delete process.env.DEMO_PASSWORD;
    }
  });

  it('never gives the demo a real IMEI to ask Pelagic about', async () => {
    const result = await callHandler(demoLogin, { method: 'POST', body: {} });

    // Pelagic answers an imeis filter that is not a real IMEI with the whole
    // fleet, so the placeholder must never be mistaken for a real one.
    for (const imei of result.body.imeis) {
      expect(imei).not.toMatch(/^\d+$/);
    }
  });

  it('refuses anything but POST', async () => {
    const result = await callHandler(demoLogin, { method: 'GET' });

    expect(result.status).toBe(405);
  });
});
