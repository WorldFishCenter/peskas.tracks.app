import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { startTestDatabase, stopTestDatabase, callHandler, signedInAs } from './_utils/testHarness.js';

/**
 * Two smaller features that still have to work: a fisher sending feedback,
 * and the demo account used for showing the app to people.
 */

let db;
let feedback;
let demoLogin;

const DEMO_IMEI = '869999999999999';
const DEMO_PASSWORD = 'demo-pass';

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.DEMO_IMEI = DEMO_IMEI;
  process.env.DEMO_PASSWORD = DEMO_PASSWORD;

  feedback = (await import('./feedback.js')).default;
  demoLogin = (await import('./auth/demo-login.js')).default;
});

afterAll(stopTestDatabase);

// Feedback is attributed to whoever is signed in, so the sender must exist.
const withDevice = new ObjectId();
const withoutDevice = new ObjectId();

beforeEach(async () => {
  await db.collection('feedback').deleteMany({});
  await db.collection('users').deleteMany({});
  await db.collection('users').insertMany([
    { _id: withDevice, IMEI: '861508035295419', Boat: 'Mashaallah' },
    { _id: withoutDevice, username: 'kito', IMEI: null },
  ]);
});

describe('sending feedback', () => {
  const send = async (callerId, body) =>
    callHandler(feedback, { method: 'POST', body, headers: await signedInAs(callerId) });

  it('stores what the fisher wrote', async () => {
    const result = await send(withDevice, {
      type: 'problem',
      message: 'The map does not load on my phone',
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
    const result = await send(withoutDevice, { type: 'suggestion', message: 'Add Kiswahili numbers' });

    expect(result.status).toBe(201);
    expect(await db.collection('feedback').countDocuments({ username: 'kito' })).toBe(1);
  });

  it('refuses feedback with no message', async () => {
    const result = await send(withDevice, { type: 'problem' });

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
  it('signs in with the configured credentials and is marked as demo', async () => {
    await db.collection('users').insertOne({
      IMEI: DEMO_IMEI,
      Boat: 'Demo Vessel',
      password: DEMO_PASSWORD,
      Community: 'Demo Community',
    });

    const result = await callHandler(demoLogin, { method: 'POST', body: {} });

    expect(result.status).toBe(200);
    expect(result.body.imeis).toEqual([DEMO_IMEI]);
    expect(JSON.stringify(result.body)).not.toContain(DEMO_PASSWORD);
  });

  it('fails clearly when the demo account is missing from the database', async () => {
    const result = await callHandler(demoLogin, { method: 'POST', body: {} });

    expect(result.status).toBe(401);
  });

  it('refuses anything but POST', async () => {
    const result = await callHandler(demoLogin, { method: 'GET' });

    expect(result.status).toBe(405);
  });
});
