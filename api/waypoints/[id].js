import { ObjectId } from 'mongodb';
import { requireFisher } from '../_utils/requireFisher.js';
import { getDatabase } from '../_utils/mongodb.js';
import { corsMiddleware } from '../_utils/cors.js';
import { rateLimitMiddleware, RateLimitPresets } from '../_utils/rateLimit.js';
import {
  sanitizeInput,
  validateString,
  validateCoordinates,
  validateEnum,
  isValidObjectId
} from '../_utils/validation.js';
import { handleError, ValidationError, NotFoundError } from '../_utils/errorHandler.js';

// Serverless function handler for individual waypoint operations
export default async function handler(req, res) {
  // Handle CORS
  if (corsMiddleware(req, res)) {
    return; // OPTIONS request handled
  }

  // Ownership is scoped to this fisher, and this fisher is the one the token
  // proves. The request no longer gets a say in whose waypoint it is editing.
  const caller = await requireFisher(req, res);
  if (!caller) return;

  try {
    const { id } = req.query;

    // Validate waypoint ID
    if (!id) {
      throw new ValidationError('Waypoint ID is required');
    }

    if (!isValidObjectId(id)) {
      throw new ValidationError('Invalid waypoint ID format');
    }

    // Handle PUT request - Update a waypoint
    if (req.method === 'PUT') {
      // Apply rate limiting
      const rateLimit = rateLimitMiddleware(RateLimitPresets.WRITE)(req, res);
      if (rateLimit.rateLimited) {
        return res.status(rateLimit.response.status).json(rateLimit.response.body);
      }

      // Sanitize input
      const sanitizedBody = sanitizeInput(req.body);
      const { name, description, coordinates, type } = sanitizedBody;

      const validatedUserId = caller.id;

      // Connect to MongoDB
      const db = await getDatabase();
      const waypointsCollection = db.collection('waypoints');

      // Handle userId that might be a string (e.g., 'admin') or a valid ObjectId
      // This ensures consistency with Express server and handles both storage formats
      let userIdQuery;
      if (isValidObjectId(validatedUserId)) {
        // Query for both ObjectId and string formats to handle legacy data
        userIdQuery = {
          $or: [
            { userId: new ObjectId(validatedUserId) },
            { userId: validatedUserId }
          ]
        };
      } else {
        // For non-ObjectId userIds (e.g., 'admin'), query as string only
        userIdQuery = { userId: validatedUserId };
      }

      // Verify waypoint belongs to user before updating
      const existingWaypoint = await waypointsCollection.findOne({
        _id: new ObjectId(id),
        ...userIdQuery
      });

      if (!existingWaypoint) {
        throw new NotFoundError('Waypoint not found or access denied');
      }

      // Build update object
      const updateDoc = {
        $set: {
          updatedAt: new Date()
        }
      };

      // Validate and add optional fields
      if (name !== undefined) {
        updateDoc.$set.name = validateString(name, {
          minLength: 1,
          maxLength: 200,
          required: true
        });
      }

      if (description !== undefined) {
        updateDoc.$set.description = validateString(description, {
          maxLength: 1000
        });
      }

      if (coordinates !== undefined) {
        updateDoc.$set.coordinates = validateCoordinates(coordinates);
      }

      if (type !== undefined) {
        const validTypes = ['port', 'anchorage', 'fishing_ground', 'favorite_spot', 'shallow_reef', 'other'];
        updateDoc.$set.type = validateEnum(type, validTypes, true);
      }

      // Update waypoint
      const result = await waypointsCollection.updateOne(
        { _id: new ObjectId(id), ...userIdQuery },
        updateDoc
      );

      if (result.matchedCount === 0) {
        throw new NotFoundError('Waypoint not found or access denied');
      }

      // Fetch and return updated waypoint
      const updatedWaypoint = await waypointsCollection.findOne({ _id: new ObjectId(id) });

      return res.json(updatedWaypoint);
    }

    // Handle DELETE request - Delete a waypoint
    else if (req.method === 'DELETE') {
      // Apply rate limiting
      const rateLimit = rateLimitMiddleware(RateLimitPresets.WRITE)(req, res);
      if (rateLimit.rateLimited) {
        return res.status(rateLimit.response.status).json(rateLimit.response.body);
      }

      const validatedUserId = caller.id;

      // Connect to MongoDB
      const db = await getDatabase();
      const waypointsCollection = db.collection('waypoints');

      // Handle userId that might be a string (e.g., 'admin') or a valid ObjectId
      // This ensures consistency with Express server and handles both storage formats
      let userIdQuery;
      if (isValidObjectId(validatedUserId)) {
        // Query for both ObjectId and string formats to handle legacy data
        userIdQuery = {
          $or: [
            { userId: new ObjectId(validatedUserId) },
            { userId: validatedUserId }
          ]
        };
      } else {
        // For non-ObjectId userIds (e.g., 'admin'), query as string only
        userIdQuery = { userId: validatedUserId };
      }

      // Delete only if waypoint belongs to user
      const result = await waypointsCollection.deleteOne({
        _id: new ObjectId(id),
        ...userIdQuery
      });

      if (result.deletedCount === 0) {
        throw new NotFoundError('Waypoint not found or access denied');
      }

      return res.json({ success: true, message: 'Waypoint deleted successfully' });
    }

    // Method not allowed
    else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    handleError(res, error, {
      endpoint: `/api/waypoints/${req.query.id}`,
      method: req.method,
      query: req.query,
      body: req.method === 'PUT' ? sanitizeInput(req.body) : undefined
    });
  }
}
