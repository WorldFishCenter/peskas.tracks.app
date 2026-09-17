import { ObjectId } from 'mongodb';
import { requireFisher } from '../_utils/requireFisher.js';
import { getDatabase } from '../_utils/mongodb.js';

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

  const { userId } = req.query;

  // The account named must be the caller's own. An administrator may look at
  // anyone's, which is how the vessel picker and the profile view work.
  if (userId && caller.role !== 'admin' && String(userId) !== String(caller.id)) {
    return res.status(403).json({ error: 'Not yours to read' });
  }

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');

    // GET - Fetch single user by ID
    if (req.method === 'GET') {
      try {
        const user = await usersCollection.findOne(
          { _id: new ObjectId(userId) },
          { projection: { password: 0 } } // Exclude password from response
        );


        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json(user);
      } catch (error) {
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


        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json({
          success: true,
          message: 'Profile updated successfully'
        });
      } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ error: 'Error updating profile' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Error in user profile handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
