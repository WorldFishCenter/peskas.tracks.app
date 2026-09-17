import { connectToDatabase } from './_utils/mongodb.js';
import { requireFisher, callerAccount } from './_utils/requireFisher.js';

// Valid feedback types
const VALID_TYPES = ['opinion', 'problem', 'suggestion', 'question', 'other'];

/**
 * Serverless function handler for feedback
 */
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

  let client;

  try {
    // Handle POST request - Submit feedback
    if (req.method === 'POST') {
      const { type, message } = req.body;

      // Validate type is a string
      if (!type || typeof type !== 'string') {
        return res.status(400).json({
          error: 'Type is required and must be a string'
        });
      }

      // Validate message is a string
      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          error: 'Message is required and must be a string'
        });
      }

      console.log('Feedback submission received:', { type, message: message.substring(0, 50) });

      // Validate type value
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`
        });
      }

      // Validate message length
      if (message.length > 2000) {
        return res.status(400).json({
          error: 'Message must be 2000 characters or less'
        });
      }

      // Connect to MongoDB
      const { client: mongoClient, db } = await connectToDatabase();
      client = mongoClient;

      const feedbackCollection = db.collection('feedback');
      const usersCollection = db.collection('users');

      // Who sent it comes from the token. The body used to name its own
      // author and set its own isAdmin flag, so any caller could file
      // feedback against a fisher or have it filed as an administrator's.
      const { user } = await callerAccount(caller, usersCollection);
      const userId = user ? user._id.toString() : null;
      const imei = user?.IMEI || null;
      const username = user?.username || null;

      const isAdminSubmission = caller.role === 'admin';

      // Create feedback document
      const feedback = {
        userId: userId || (isAdminSubmission ? 'admin' : null),
        imei: isAdminSubmission ? 'admin' : (imei || null),
        username: isAdminSubmission ? 'admin' : (username || null),
        boatName: isAdminSubmission ? 'admin' : (user?.Boat || user?.username || null),
        community: isAdminSubmission ? 'admin' : (user?.Community || null),
        type,
        message: message.trim(),
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        adminNotes: null,
        ...(isAdminSubmission && { isAdminSubmission: true })
      };

      // Insert the feedback
      const result = await feedbackCollection.insertOne(feedback);

      // Return the created document
      const createdFeedback = await feedbackCollection.findOne({ _id: result.insertedId });

      console.log(`Feedback created with ID: ${result.insertedId}`);

      return res.status(201).json(createdFeedback);
    }

    // Handle GET request - Get user feedback
    else if (req.method === 'GET') {
      const { query } = req;

      // Get feedback by user ID: /api/feedback?userId=123
      if (query.userId) {
        const { userId } = query;

        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }

        console.log(`Fetching feedback for user ${userId}`);

        const { client: mongoClient, db } = await connectToDatabase();
        client = mongoClient;

        const feedbackCollection = db.collection('feedback');
        const feedback = await feedbackCollection
          .find({ userId })
          .sort({ createdAt: -1 })
          .toArray();

        return res.json(feedback);
      }

      // If no specific query parameters, return error
      else {
        return res.status(400).json({ error: 'userId query parameter is required' });
      }
    }

    // Method not allowed
    else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in feedback API:', error);

    return res.status(500).json({ error: 'Internal server error' });
  }
}







