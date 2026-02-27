import { MongoClient } from 'mongodb';

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

// Serverless function handler for catch events
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

  let client;
  
  try {
    // Handle POST request - Create catch event
    if (req.method === 'POST') {
      const { tripId, date, fishGroup, quantity, imei, username, catch_outcome, photos, gps_photo } = req.body;
      
      // Validate required fields - at least one identifier (imei or username) must be present
      // Note: imei or username can be explicitly null, we just need at least one to be a non-empty string
      const hasImei = imei && typeof imei === 'string' && imei.length > 0;
      const hasUsername = username && typeof username === 'string' && username.length > 0;

      if (!tripId || !date || catch_outcome === undefined || (!hasImei && !hasUsername)) {
        console.error('Validation failed:', { tripId: !!tripId, date: !!date, catch_outcome, hasImei, hasUsername });
        return res.status(400).json({ error: 'Missing required fields: tripId, date, (imei or username), catch_outcome' });
      }
      
      // Validate catch_outcome
      if (catch_outcome !== 0 && catch_outcome !== 1) {
        return res.status(400).json({ error: 'catch_outcome must be 0 (no catch) or 1 (has catch)' });
      }
      
      // For catch events (catch_outcome = 1), validate fishGroup and quantity
      if (catch_outcome === 1) {
        if (!fishGroup || !quantity) {
          return res.status(400).json({ error: 'fishGroup and quantity are required when catch_outcome = 1' });
        }
        
        // Validate fishGroup
        const validFishGroups = ['reef fish', 'sharks/rays', 'small pelagics', 'large pelagics', 'tuna/tuna-like'];
        if (!validFishGroups.includes(fishGroup)) {
          return res.status(400).json({ error: `Invalid fish group. Must be one of: ${validFishGroups.join(', ')}` });
        }
        
        // Validate quantity
        if (typeof quantity !== 'number' || quantity <= 0) {
          return res.status(400).json({ error: 'Quantity must be a positive number' });
        }
      }
      
      const userIdentifier = imei || username;
      console.log(`Creating catch event for trip ${tripId} by identifier ${userIdentifier}`);

      // Connect to MongoDB
      const connection = await connectToMongo();
      client = connection.client;
      const db = connection.db;

      const catchEventsCollection = db.collection('catch-events');

      // Get user information for additional context
      // Try to find user by IMEI first, then by username (for non-PDS users)
      const usersCollection = db.collection('users');
      let user = null;
      
      if (hasImei) {
        user = await usersCollection.findOne({ IMEI: imei });
      }
      
      if (!user && hasUsername) {
        user = await usersCollection.findOne({ username: username });
      }

      // Detect if this is an admin user making a test submission
      const isAdminSubmission = req.body.isAdmin === true;

      console.log(`Admin submission detected: ${isAdminSubmission}`);

      // Create catch event document
      const catchEvent = {
        tripId,
        date: new Date(date),
        catch_outcome,
        // Replace admin user data with generic admin identifiers
        // Store both imei and username for proper identification
        imei: isAdminSubmission ? 'admin' : (imei || null),
        username: isAdminSubmission ? 'admin' : (username || user?.username || null), // Store username separately for easier querying
        boatName: isAdminSubmission ? 'admin' : (user?.Boat || user?.username || null),
        community: isAdminSubmission ? 'admin' : (user?.Community || null),
        reportedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        // Mark admin submissions for easier identification
        ...(isAdminSubmission && { isAdminSubmission: true }),
        // Only include fishGroup, quantity, photos, and gps_photo for actual catches (catch_outcome = 1)
        ...(catch_outcome === 1 && {
          fishGroup,
          quantity: parseFloat(quantity),
          photos: photos || [],
          gps_photo: gps_photo || []
        })
      };
      
      // Insert the catch event
      const result = await catchEventsCollection.insertOne(catchEvent);
      
      // Return the created document
      const createdEvent = await catchEventsCollection.findOne({ _id: result.insertedId });
      
      console.log(`Catch event created with ID: ${result.insertedId}`);
      
      // Close MongoDB connection
      await client.close();
      
      return res.status(201).json(createdEvent);
    }
    
    // Handle GET request - Route based on URL path
    else if (req.method === 'GET') {
      const { query } = req;
      
      // Connect to MongoDB
      const connection = await connectToMongo();
      client = connection.client;
      const db = connection.db;
      
      const catchEventsCollection = db.collection('catch-events');
      
      // Get catch events by trip ID: /api/catch-events?tripId=123
      if (query.tripId) {
        const { tripId } = query;

        // Validate tripId is a non-empty string (prevent NoSQL injection)
        if (!tripId || typeof tripId !== 'string') {
          await client.close();
          return res.status(400).json({ error: 'Trip ID is required and must be a string' });
        }

        console.log(`Fetching catch events for trip ${tripId}`);

        const events = await catchEventsCollection.find({ tripId }).sort({ reportedAt: -1 }).toArray();

        await client.close();
        return res.json(events);
      }

      // Get catch events by user IMEI: /api/catch-events?imei=123456789
      else if (query.imei) {
        const { imei } = query;

        // Validate imei is a non-empty string (prevent NoSQL injection)
        if (!imei || typeof imei !== 'string') {
          await client.close();
          return res.status(400).json({ error: 'IMEI is required and must be a string' });
        }

        console.log(`Fetching catch events for user IMEI ${imei}`);

        const events = await catchEventsCollection.find({ imei }).sort({ reportedAt: -1 }).toArray();

        await client.close();
        return res.json(events);
      }

      // Get catch events by username: /api/catch-events?username=johndoe
      else if (query.username) {
        const { username } = query;

        // Validate username is a non-empty string (prevent NoSQL injection)
        if (!username || typeof username !== 'string') {
          await client.close();
          return res.status(400).json({ error: 'Username is required and must be a string' });
        }

        console.log(`Fetching catch events for username ${username}`);

        const events = await catchEventsCollection.find({ username }).sort({ reportedAt: -1 }).toArray();

        await client.close();
        return res.json(events);
      }

      // If no specific query parameters, return error
      else {
        await client.close();
        return res.status(400).json({ error: 'Either tripId, imei, or username query parameter is required' });
      }
    }
    
    // Method not allowed
    else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('Error in catch events API:', error);
    
    // Ensure MongoDB connection is closed if there was an error
    if (client) {
      await client.close();
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}