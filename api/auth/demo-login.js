import { MongoClient } from 'mongodb';

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI 
  ? process.env.MONGODB_URI.replace(/^"|"$/g, '')
  : '';

// Demo credentials (must be configured via environment variables)
const DEMO_IMEI = process.env.DEMO_IMEI;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

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
  
  try {
    await client.connect();
    return { client, db: client.db('portal-prod') };
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

// Serverless function handler for demo login
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
  
  // Only allow POST requests (after handling OPTIONS)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Use the hardcoded demo credentials from backend environment
    const imei = DEMO_IMEI;
    const password = DEMO_PASSWORD;
    
    if (!imei || !password) {
      return res.status(500).json({ error: 'Demo credentials not configured on server' });
    }
    
    // Connect to MongoDB and authenticate with demo user
    let client;
    try {
      const connection = await connectToMongo();
      client = connection.client;
      const db = connection.db;
      const usersCollection = db.collection('users');
      
      // First, try to find user by IMEI
      let user = await usersCollection.findOne({ IMEI: imei, password });
      
      // If not found by IMEI, try by Boat name
      if (!user) {
        user = await usersCollection.findOne({ Boat: imei, password });
      }
      
      // Close MongoDB connection
      await client.close();
      
      if (!user) {
        console.error('Demo user not found in database:', imei);
        return res.status(401).json({ error: 'Demo user not found' });
      }
      
      // Map MongoDB user to app user format with demo flag
      const appUser = {
        id: user._id.toString(),
        name: user.Boat || `Vessel ${user.IMEI.slice(-4)}`,
        imeis: [user.IMEI],
        role: 'demo', // Special demo role
        community: user.Community,
        region: user.Region,
        isDemoMode: true // Flag to enable demo mode UI anonymization
      };
      
      console.log('Demo login successful for:', imei);
      return res.status(200).json(appUser);
    } catch (error) {
      // Ensure MongoDB connection is closed if there was an error
      if (client) {
        await client.close();
      }
      throw error;
    }
  } catch (error) {
    console.error('Error during demo login:', error);
    return res.status(500).json({ error: 'Demo login failed' });
  }
}