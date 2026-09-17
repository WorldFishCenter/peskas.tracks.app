import { requireFisher, callerAccount } from './_utils/requireFisher.js';
import { getDatabase } from './_utils/mongodb.js';

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

  
  try {
    // Handle POST request - Create catch event
    if (req.method === 'POST') {
      const { tripId, date, fishGroup, quantity, catch_outcome, photos, gps_photo } = req.body;

      // The body no longer says who is reporting, so it is no longer asked to.
      // The token does, and a request cannot lie about it.
      if (!tripId || !date || catch_outcome === undefined) {
        console.error('Validation failed:', { tripId: !!tripId, date: !!date, catch_outcome });
        return res.status(400).json({ error: 'Missing required fields: tripId, date, catch_outcome' });
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
      
      console.log(`Creating catch event for trip ${tripId}`);

      // Connect to MongoDB
      const db = await getDatabase();

      const catchEventsCollection = db.collection('catch-events');

      // Whose report this is comes from the token, not from the body. The
      // request used to name its own author and declare its own admin status,
      // which meant any caller could file a catch against any fisher, or have
      // one recorded as an administrator's test.
      const usersCollection = db.collection('users');
      const { user } = await callerAccount(caller, usersCollection);

      const isAdminSubmission = caller.role === 'admin';

      // Create catch event document
      const catchEvent = {
        tripId,
        date: new Date(date),
        catch_outcome,
        // Replace admin user data with generic admin identifiers
        // Store both imei and username for proper identification
        imei: isAdminSubmission ? 'admin' : (user?.IMEI || null),
        username: isAdminSubmission ? 'admin' : (user?.username || null),
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
      
      
      return res.status(201).json(createdEvent);
    }
    
    // Handle GET request - Route based on URL path
    else if (req.method === 'GET') {
      const { query } = req;
      
      // Connect to MongoDB
      const db = await getDatabase();
      
      const catchEventsCollection = db.collection('catch-events');
      
      // Get catch events by trip ID: /api/catch-events?tripId=123
      if (query.tripId) {
        const { tripId } = query;

        // Validate tripId is a non-empty string (prevent NoSQL injection)
        if (!tripId || typeof tripId !== 'string') {
          return res.status(400).json({ error: 'Trip ID is required and must be a string' });
        }

        console.log(`Fetching catch events for trip ${tripId}`);

        const events = await catchEventsCollection.find({ tripId }).sort({ reportedAt: -1 }).toArray();

        return res.json(events);
      }

      // Get catch events by user IMEI: /api/catch-events?imei=123456789
      else if (query.imei) {
        const { imei } = query;

        // Validate imei is a non-empty string (prevent NoSQL injection)
        if (!imei || typeof imei !== 'string') {
          return res.status(400).json({ error: 'IMEI is required and must be a string' });
        }

        console.log(`Fetching catch events for user IMEI ${imei}`);

        const events = await catchEventsCollection.find({ imei }).sort({ reportedAt: -1 }).toArray();

        return res.json(events);
      }

      // Get catch events by username: /api/catch-events?username=johndoe
      else if (query.username) {
        const { username } = query;

        // Validate username is a non-empty string (prevent NoSQL injection)
        if (!username || typeof username !== 'string') {
          return res.status(400).json({ error: 'Username is required and must be a string' });
        }

        console.log(`Fetching catch events for username ${username}`);

        const events = await catchEventsCollection.find({ username }).sort({ reportedAt: -1 }).toArray();

        return res.json(events);
      }

      // If no specific query parameters, return error
      else {
        return res.status(400).json({ error: 'Either tripId, imei, or username query parameter is required' });
      }
    }
    
    // Method not allowed
    else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('Error in catch events API:', error);
    
    
    return res.status(500).json({ error: 'Internal server error' });
  }
}