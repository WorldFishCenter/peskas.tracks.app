import { ObjectId } from 'mongodb';
import { getDatabase } from './_utils/mongodb.js';
import { corsMiddleware } from './_utils/cors.js';
import { rateLimitMiddleware, RateLimitPresets } from './_utils/rateLimit.js';
import {
  sanitizeInput,
  validateString,
  validateCoordinates,
  validateEnum,
  isValidObjectId
} from './_utils/validation.js';
import { handleError, ValidationError } from './_utils/errorHandler.js';
import { resolveOwnerCriteria, sanitizeIdentifiers } from './_utils/fisherIdentity.js';

// Serverless function handler for waypoints
export default async function handler(req, res) {
  // Handle CORS
  if (corsMiddleware(req, res)) {
    return; // OPTIONS request handled
  }

  try {
    // Handle GET request - Get waypoints for a user
    if (req.method === 'GET') {
      // Apply rate limiting (generous for GET requests)
      const rateLimit = rateLimitMiddleware(RateLimitPresets.READ)(req, res);
      if (rateLimit.rateLimited) {
        return res.status(rateLimit.response.status).json(rateLimit.response.body);
      }

      const identifiers = sanitizeIdentifiers(req.query);

      // Connect to MongoDB
      const db = await getDatabase();
      const waypointsCollection = db.collection('waypoints');
      const usersCollection = db.collection('users');

      // Which records belong to this fisher is resolved in one place; see
      // api/_utils/fisherIdentity.js. Waypoints are always private.
      const query = {
        isPrivate: true,
        ...(await resolveOwnerCriteria(identifiers, usersCollection))
      };

      // Fetch waypoints belonging to this user
      const waypoints = await waypointsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      return res.json(waypoints);
    }

    // Handle POST request - Create a new waypoint
    else if (req.method === 'POST') {
      // Apply stricter rate limiting for POST requests
      const rateLimit = rateLimitMiddleware(RateLimitPresets.WRITE)(req, res);
      if (rateLimit.rateLimited) {
        return res.status(rateLimit.response.status).json(rateLimit.response.body);
      }

      // Sanitize input to prevent NoSQL injection
      const sanitizedBody = sanitizeInput(req.body);
      const { userId, imei, username, name, description, coordinates, type, metadata, isAdmin } = sanitizedBody;

      // Detect if this is an admin user making a test submission
      const isAdminSubmission = isAdmin === true;

      console.log(`Admin submission detected: ${isAdminSubmission}`);

      // Validate required fields
      const validatedUserId = validateString(userId, {
        minLength: 1,
        maxLength: 100,
        required: true
      });

      const validatedName = validateString(name, {
        minLength: 1,
        maxLength: 200,
        required: true
      });

      // Validate coordinates
      if (!coordinates) {
        throw new ValidationError('Coordinates are required');
      }

      const validatedCoordinates = validateCoordinates(coordinates);

      // Validate type
      const validTypes = ['port', 'anchorage', 'fishing_ground', 'favorite_spot', 'shallow_reef', 'other'];
      const validatedType = validateEnum(type, validTypes, true);

      // Validate optional fields
      const validatedDescription = description
        ? validateString(description, { maxLength: 1000 })
        : null;

      const validatedImei = imei
        ? validateString(imei, { maxLength: 50 })
        : null;

      const validatedUsername = username
        ? validateString(username, { maxLength: 100 })
        : null;

      // Connect to MongoDB
      const db = await getDatabase();
      const waypointsCollection = db.collection('waypoints');
      const usersCollection = db.collection('users');

      // Get user information for username field (like catch-events pattern)
      // Also determine proper userId storage format (ObjectId vs string)
      let user = null;
      let userIdForStorage = validatedUserId; // Default to string

      if (isValidObjectId(validatedUserId)) {
        try {
          const objectIdUserId = new ObjectId(validatedUserId);
          user = await usersCollection.findOne({ _id: objectIdUserId });
          userIdForStorage = objectIdUserId; // Store as ObjectId if valid
        } catch (err) {
          console.error('Error fetching user for waypoint:', err);
          // Continue with string userId if lookup fails
        }
      } else {
        // For non-ObjectId userIds (e.g., 'admin'), keep as string
        console.log(`userId is not a valid ObjectId, storing as string: ${validatedUserId}`);
      }

      // Create waypoint document
      const waypoint = {
        userId: userIdForStorage, // Store as ObjectId when valid, string otherwise
        // Replace admin user data with generic admin identifiers (like catch-events)
        imei: isAdminSubmission ? 'admin' : validatedImei,
        username: isAdminSubmission ? 'admin' : (validatedUsername || user?.username || null), // Anonymized for admin submissions (like catch-events)
        name: validatedName,
        description: validatedDescription,
        coordinates: {
          lat: validatedCoordinates.lat,
          lng: validatedCoordinates.lng
        },
        type: validatedType,
        isPrivate: true,
        metadata: sanitizeInput(metadata) || {},
        createdAt: new Date(),
        updatedAt: new Date(),
        // Mark admin submissions for easier identification
        ...(isAdminSubmission && { isAdminSubmission: true })
      };

      const result = await waypointsCollection.insertOne(waypoint);
      const createdWaypoint = await waypointsCollection.findOne({ _id: result.insertedId });

      return res.status(201).json(createdWaypoint);
    }

    // Method not allowed for this route
    else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    handleError(res, error, {
      endpoint: '/api/waypoints',
      method: req.method,
      query: req.query,
      body: req.method === 'POST' ? sanitizeInput(req.body) : undefined
    });
  }
}
