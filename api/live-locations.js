import { createEndpoint, ValidationError, HttpError } from './_utils/endpoint.js';

const PDS_API = 'https://analytics.pelagicdata.com/api';

// PDS suspended the account for logging in too often, so a refused login waits before the next try.
const RETRY_LOGIN_AFTER_MS = 5 * 60 * 1000;

/** One PDS login shared by every request this instance serves. */
let session = null;

async function login() {
  const { PDS_USERNAME, PDS_PASSWORD, PDS_CUSTOMER_ID } = process.env;
  if (!PDS_USERNAME || !PDS_PASSWORD || !PDS_CUSTOMER_ID) {
    throw new Error('PDS_USERNAME, PDS_PASSWORD or PDS_CUSTOMER_ID is not set');
  }

  const response = await fetch(`${PDS_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: PDS_USERNAME, password: PDS_PASSWORD }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error(`PDS login refused: ${response.status}`);
  }

  const { token } = await response.json();
  return { token, expiresAt: tokenExpiry(token) };
}

/** A minute before the token's own expiry, or 15 minutes if it does not say. */
function tokenExpiry(token) {
  let exp;
  try {
    ({ exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()));
  } catch {
    // Not a JWT.
  }
  return Number.isFinite(exp) ? exp * 1000 - 60 * 1000 : Date.now() + 15 * 60 * 1000;
}

async function pdsToken() {
  if (!session || Date.now() >= session.expiresAt) {
    const current = { login: login(), expiresAt: Infinity };
    session = current;
    try {
      current.expiresAt = (await current.login).expiresAt;
    } catch {
      current.expiresAt = Date.now() + RETRY_LOGIN_AFTER_MS;
    }
  }
  return (await session.login).token;
}

/**
 * GET /api/live-locations?imeis=<imei>,<imei>
 *
 * The latest position PDS holds for each named vessel. The PDS login stays
 * here on the server; the browser never sees it.
 */
export default createEndpoint({ methods: ['GET'], db: false }, async (req, res) => {
  const imeis = String(req.query.imeis ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (imeis.length === 0 || !imeis.every((imei) => /^\d+$/.test(imei))) {
    throw new ValidationError('imeis is required: IMEI numbers separated by commas');
  }

  let token;
  try {
    token = await pdsToken();
  } catch (error) {
    console.error('[live-locations] no PDS login:', error.message);
    throw new HttpError(503, 'Live locations are unavailable');
  }

  try {
    const response = await fetch(`${PDS_API}/pds/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        customers: [{ entityType: 'CUSTOMER', id: process.env.PDS_CUSTOMER_ID }],
        boats: [],
        imeis: imeis.map(Number)
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (response.status === 401) {
      session = null;
    }
    if (!response.ok) {
      console.error(`[live-locations] PDS devices answered ${response.status}`);
      throw new HttpError(502, 'Live locations are unavailable');
    }

    const devices = await response.json();
    // PDS answers an IMEI it does not know with the whole fleet.
    const wanted = new Set(imeis);
    return res.status(200).json(devices.filter((device) => wanted.has(String(device.imei))));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error('[live-locations] PDS devices failed:', error.message);
    throw new HttpError(502, 'Live locations are unavailable');
  }
});
