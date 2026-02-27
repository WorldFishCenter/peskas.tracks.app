import { MongoClient, ObjectId } from 'mongodb';

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

// Serverless function handler for user profile operations
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

  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  let client;
  try {
    const connection = await connectToMongo();
    client = connection.client;
    const db = connection.db;
    const usersCollection = db.collection('users');

    // GET - Fetch single user by ID
    if (req.method === 'GET') {
      try {
        const user = await usersCollection.findOne(
          { _id: new ObjectId(userId) },
          { projection: { password: 0 } } // Exclude password from response
        );

        await client.close();

        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json(user);
      } catch (error) {
        await client.close();
        console.error('Error fetching user:', error);
        return res.status(500).json({ error: 'Error fetching user' });
      }
    }

    // PUT - Update user profile
    if (req.method === 'PUT') {
      try {
        const { phoneNumber, Country, vessel_type, main_gear_type, Boat } = req.body;

        const updateDoc = {
          $set: {
            phoneNumber,
            Country,
            vessel_type,
            main_gear_type,
            Boat,
            updatedAt: new Date()
          }
        };

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(userId) },
          updateDoc
        );

        await client.close();

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json({
          success: true,
          message: 'Profile updated successfully'
        });
      } catch (error) {
        await client.close();
        console.error('Error updating user:', error);
        return res.status(500).json({ error: 'Error updating profile' });
      }
    }

    // Method not allowed
    await client.close();
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    if (client) {
      await client.close();
    }
    console.error('Error in user profile handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
