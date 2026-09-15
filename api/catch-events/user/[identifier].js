import { MongoClient } from 'mongodb';
import { resolveIdentifierCriteria } from '../../_utils/fisherIdentity.js';
import { ValidationError } from '../../_utils/errorHandler.js';

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/^"|"$/g, '')
  : '';

async function connectToMongo() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
    console.error('Invalid MongoDB URI format:', MONGODB_URI);
    throw new Error('Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://');
  }

  const client = new MongoClient(MONGODB_URI, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  return { client, db: client.db('portal-prod') };
}

// Serverless function handler for fetching user catch events
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { identifier } = req.query;

  let client;
  try {
    const connection = await connectToMongo();
    client = connection.client;
    const db = connection.db;
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

    await client.close();

    console.log(`Found ${events.length} catch events for identifier: ${identifier}`);
    return res.status(200).json(events);

  } catch (error) {
    if (client) {
      await client.close();
    }

    // A missing identifier is the caller's error, not ours: keep the 400 this
    // endpoint returned before the check moved into fisherIdentity.
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Error fetching catch events:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
