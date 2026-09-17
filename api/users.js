import { identifyCaller } from './_utils/requireFisher.js';
import { getDatabase } from './_utils/mongodb.js';

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

  // Who is calling? Recorded, not required: step 3 of
  // docs/API-AUTH-PLAN.md. Step 4 turns a null answer into a 401 and takes
  // the identity from here instead of from the query string.
  await identifyCaller(req);
  
  // Only allow GET requests (after handling OPTIONS)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = await getDatabase();

    // Administrator accounts live in this collection but are not vessels, and
    // this list feeds the vessel picker. Without the filter they show up there
    // as blank rows: no Boat, no IMEI, nothing to track.
    const users = await db.collection('users')
      .find({ role: { $ne: 'admin' } }, { projection: { password: 0 } })
      .toArray();

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
