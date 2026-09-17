import { identifyCaller } from '../../_utils/requireFisher.js';
import { resolveIdentifierCriteria } from '../../_utils/fisherIdentity.js';
import { ValidationError } from '../../_utils/errorHandler.js';
import { getDatabase } from '../../_utils/mongodb.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Who is calling? Recorded, not required: step 3 of
  // docs/API-AUTH-PLAN.md. Step 4 turns a null answer into a 401 and takes
  // the identity from here instead of from the query string.
  await identifyCaller(req);

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { identifier } = req.query;

  try {
    const db = await getDatabase();
    const catchEventsCollection = db.collection('catch-events');

    console.log(`Fetching catch events for user identifier: ${identifier}`);

    // One query rather than probing IMEI, then looking the identifier up as a
    // username, then querying again. The previous form only widened the search
    // beyond IMEI if a user with that username happened to exist, so a
    // self-registered fisher whose events were stored under their boat name
    // could come back empty. See api/_utils/fisherIdentity.js.
    const events = await catchEventsCollection
      .find(resolveIdentifierCriteria(identifier))
      .sort({ reportedAt: -1 })
      .toArray();


    console.log(`Found ${events.length} catch events for identifier: ${identifier}`);
    return res.status(200).json(events);

  } catch (error) {

    // A missing identifier is the caller's error, not ours: keep the 400 this
    // endpoint returned before the check moved into fisherIdentity.
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Error fetching catch events:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
