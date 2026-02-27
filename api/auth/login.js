import { MongoClient } from 'mongodb';

/**
 * Escape special regex characters in a string to prevent regex injection
 * @param {string} str - The string to escape
 * @returns {string} The escaped string safe for use in RegExp
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// MongoDB Connection
// Remove quotes from MongoDB URI if present
const MONGODB_URI = process.env.MONGODB_URI 
  ? process.env.MONGODB_URI.replace(/^"|"$/g, '')
  : '';

// Connect to MongoDB with better error handling
async function connectToMongo() {
  // Add validation for MongoDB URI
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

// Serverless function handler for login
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
    const { imei, password } = req.body;
    
    if (!imei || !password) {
      return res.status(400).json({ error: 'IMEI/Boat name/Username and password are required' });
    }
    
    // Check for global password from .env
    const globalPassword = process.env.GLOBAL_PASSW;
    const useGlobalPassword = password === globalPassword;

    // Connect to MongoDB
    let client;
    try {
      const connection = await connectToMongo();
      client = connection.client;
      const db = connection.db;
      const usersCollection = db.collection('users');

      // Try multiple lookup strategies: IMEI, Boat name, or Username
      console.log(`Searching for user with identifier: ${imei}`);
      let user;

      // If using global password, skip password validation
      if (useGlobalPassword) {
        console.log('Global password login - looking up user without password check:', imei);
        user = await usersCollection.findOne({ IMEI: imei });

        // If not found by IMEI, try by Boat name (case-insensitive for better UX)
        if (!user) {
          console.log(`No user found with IMEI, trying Boat name: ${imei}`);
          user = await usersCollection.findOne({
            Boat: { $regex: new RegExp(`^${escapeRegex(imei)}$`, 'i') }
          });
        }

        // If still not found, try by username (case-insensitive for better UX)
        if (!user) {
          console.log(`No user found with Boat name, trying username: ${imei}`);
          user = await usersCollection.findOne({
            username: { $regex: new RegExp(`^${escapeRegex(imei)}$`, 'i') }
          });
        }
      } else {
        // Normal password validation
        user = await usersCollection.findOne({ IMEI: imei, password });

        // If not found by IMEI, try by Boat name (case-insensitive for better UX)
        if (!user) {
          console.log(`No user found with IMEI, trying Boat name: ${imei}`);
          user = await usersCollection.findOne({
            Boat: { $regex: new RegExp(`^${escapeRegex(imei)}$`, 'i') },
            password
          });
        }

        // If still not found, try by username (case-insensitive for better UX)
        if (!user) {
          console.log(`No user found with Boat name, trying username: ${imei}`);
          user = await usersCollection.findOne({
            username: { $regex: new RegExp(`^${escapeRegex(imei)}$`, 'i') },
            password
          });
        }
      }

      // Close MongoDB connection
      await client.close();

      if (!user) {
        console.log('No user found with these credentials');
        return res.status(401).json({ error: 'Invalid IMEI/Boat name/Username or password' });
      }

      // Map MongoDB user to app user format
      const appUser = {
        id: user._id.toString(),
        name: user.Boat || user.username || `Vessel ${user.IMEI?.slice(-4) || 'Unknown'}`,
        username: user.username || null, // Include username for non-PDS users
        imeis: user.IMEI ? [user.IMEI] : [], // Empty array if no IMEI (self-registered users)
        role: useGlobalPassword ? 'admin' : 'user', // Admin role when using global password
        community: user.Community,
        region: user.Region,
        hasImei: user.hasImei !== false && !!user.IMEI // Use explicit flag if available, otherwise derive from IMEI
      };

      console.log('User authenticated:', { name: appUser.name, hasImei: appUser.hasImei });
      
      return res.status(200).json(appUser);
    } catch (error) {
      // Ensure MongoDB connection is closed if there was an error
      if (client) {
        await client.close();
      }
      throw error;
    }
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 