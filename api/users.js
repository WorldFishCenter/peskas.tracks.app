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

export default async function handler(req, res) {
  // Set CORS headers FIRST (before any method checks)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  // Handle preflight OPTIONS request BEFORE method validation
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests (after handling OPTIONS)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    const connection = await connectToMongo();
    client = connection.client;
    const db = connection.db;

    const users = await db.collection('users')
      .find({}, { projection: { password: 0 } })
      .toArray();

    await client.close();
    return res.status(200).json(users);
  } catch (error) {
    if (client) {
      await client.close();
    }
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
