import { requireFisher, callerAccount, mayActFor } from '../../_utils/requireFisher.js';
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

  const caller = await requireFisher(req, res);
  if (!caller) return;

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { identifier } = req.query;

  try {
    const db = await getDatabase();
    const catchEventsCollection = db.collection('catch-events');

    // The identifier still names whose events these are, because an
    // administrator reviewing a vessel needs to name it. What has changed is
    // that naming one you do not own is no longer enough to be given it.
    const { identities } = await callerAccount(caller, db.collection('users'));
    if (!mayActFor(caller, identifier, identities)) {
      return res.status(403).json({ error: 'Not yours to read' });
    }

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
