import { ObjectId } from 'mongodb';
import { requireFisher } from '../../_utils/requireFisher.js';
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

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Changing a password is the one thing an administrator may not do on
  // somebody's behalf: it would take the account away from its owner.
  const userId = caller.id;
  const { currentPassword, newPassword } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  // Validate password length (consistent with Express server)
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');

    // Verify current password
    const user = await usersCollection.findOne({
      _id: new ObjectId(userId),
      password: currentPassword
    });

    if (!user) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update password
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          password: newPassword,
          updatedAt: new Date()
        }
      }
    );


    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
