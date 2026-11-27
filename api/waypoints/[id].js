import { ObjectId } from 'mongodb';
import { createEndpoint, ValidationError, NotFoundError } from '../_utils/endpoint.js';
import { RateLimitPresets } from '../_utils/rateLimit.js';
import {
  sanitizeInput,
  validateString,
  validateCoordinates,
  validateEnum,
  isValidObjectId
} from '../_utils/validation.js';
import { userIdCriteria } from '../_utils/fisherIdentity.js';

const VALID_WAYPOINT_TYPES = [
  'port',
  'anchorage',
  'fishing_ground',
  'favorite_spot',
  'shallow_reef',
  'other'
];

export default createEndpoint(
  {
    methods: ['PUT', 'DELETE'],
    rateLimit: RateLimitPresets.WRITE
  },
  async (req, res, { db }) => {
    const { id } = req.query;

    if (!id) {
      throw new ValidationError('Waypoint ID is required');
    }
    if (!isValidObjectId(id)) {
      throw new ValidationError('Invalid waypoint ID format');
    }

    const waypointId = new ObjectId(id);
    const waypointsCollection = db.collection('waypoints');

    if (req.method === 'PUT') {
      const sanitizedBody = sanitizeInput(req.body);
      const { userId, name, description, coordinates, type } = sanitizedBody;
      const ownerQuery = userIdCriteria(userId);

      const existingWaypoint = await waypointsCollection.findOne({
        _id: waypointId,
        ...ownerQuery
      });

      if (!existingWaypoint) {
        throw new NotFoundError('Waypoint not found or access denied');
      }

      const updateDoc = { $set: { updatedAt: new Date() } };

      if (name !== undefined) {
        updateDoc.$set.name = validateString(name, { minLength: 1, maxLength: 200, required: true });
      }
      if (description !== undefined) {
        updateDoc.$set.description = validateString(description, { maxLength: 1000 });
      }
      if (coordinates !== undefined) {
        updateDoc.$set.coordinates = validateCoordinates(coordinates);
      }
      if (type !== undefined) {
        updateDoc.$set.type = validateEnum(type, VALID_WAYPOINT_TYPES, true);
      }

      const result = await waypointsCollection.updateOne(
        { _id: waypointId, ...ownerQuery },
        updateDoc
      );

      if (result.matchedCount === 0) {
        throw new NotFoundError('Waypoint not found or access denied');
      }

      const updatedWaypoint = await waypointsCollection.findOne({ _id: waypointId });
      return res.json(updatedWaypoint);
    }

    const ownerQuery = userIdCriteria(req.query.userId);
    const result = await waypointsCollection.deleteOne({
      _id: waypointId,
      ...ownerQuery
    });

    if (result.deletedCount === 0) {
      throw new NotFoundError('Waypoint not found or access denied');
    }

    return res.json({ success: true, message: 'Waypoint deleted successfully' });
  }
);
