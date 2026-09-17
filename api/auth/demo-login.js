import { issueToken } from '../_utils/token.js';

/**
 * The demo account.
 *
 * This used to sign in as a real vessel, named by DEMO_IMEI, and hand its
 * IMEI, boat name, community and region to whoever clicked "Try Demo Mode" —
 * the UI covered them up, but they sat in localStorage, in Sentry, and in the
 * URLs of every tracking request. The demo now replays anonymised tracks from
 * public/demo/snapshot.json (src/api/demoTracksService.ts), so it needs no real
 * account, and this identity is the same for everyone and names nobody.
 *
 * `imeis` holds a placeholder rather than nothing, because the dashboard only
 * draws tracks for an account with a device. It is not a real IMEI and must
 * never be sent to Pelagic: given an `imeis` filter that is not a real IMEI,
 * the points endpoint answers with every vessel in the fleet. The services short-circuit
 * in demo mode before any such request is made.
 */
export const DEMO_USER = Object.freeze({
  id: 'demo',
  name: 'Demo Vessel',
  imeis: ['demo'],
  role: 'demo',
  community: 'Demo Community',
  region: 'Demo Region',
  hasImei: true,
  isDemoMode: true
});

export default async function handler(req, res) {
  // Set CORS headers FIRST (before any method checks)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle preflight OPTIONS request BEFORE method validation
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests (after handling OPTIONS)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = { ...DEMO_USER, imeis: [...DEMO_USER.imeis] };
    const token = await issueToken(user);

    return res.status(200).json({ ...user, token });
  } catch (error) {
    console.error('Error during demo login:', error);
    return res.status(500).json({ error: 'Demo login failed' });
  }
}
