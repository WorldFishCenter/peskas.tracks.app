import { MongoClient } from 'mongodb';

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

  if (!identifier) {
    return res.status(400).json({ error: 'User identifier (IMEI or username) is required' });
  }

  let client;
  try {
    const connection = await connectToMongo();
    client = connection.client;
    const db = connection.db;
    const catchEventsCollection = db.collection('catch-events');

    console.log(`Fetching catch events for user identifier: ${identifier}`);

    // First try to find events by IMEI
    let events = await catchEventsCollection
      .find({ imei: identifier })
      .sort({ reportedAt: -1 })
      .toArray();

    // If no events found by IMEI, try finding user by username and get their catch events
    // This is for non-PDS users who report catches using their username
    if (events.length === 0) {
      console.log(`No events found by IMEI, checking if identifier is a username`);

      const usersCollection = db.collection('users');
      const user = await usersCollection.findOne({ username: identifier });

      if (user) {
        console.log(`Found user with username: ${identifier}`);
        // For non-PDS users, we need to search for catch events by username
        // Since catch events might be stored with username as identifier
        events = await catchEventsCollection
          .find({
            $or: [
              { imei: identifier },
              { username: identifier },
              { boatName: identifier }
            ]
          })
          .sort({ reportedAt: -1 })
          .toArray();
      }
    }

    await client.close();

    console.log(`Found ${events.length} catch events for identifier: ${identifier}`);
    return res.status(200).json(events);

  } catch (error) {
    if (client) {
      await client.close();
    }
    console.error('Error fetching catch events:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
