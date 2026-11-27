import { createEndpoint, ValidationError } from './_utils/endpoint.js';
import { RateLimitPresets } from './_utils/rateLimit.js';
import {
  sanitizeInput,
  validateString,
  validateCoordinates,
  validateEnum
} from './_utils/validation.js';
import {
  resolveOwnerCriteria,
  resolveWriteContext,
  sanitizeIdentifiers
} from './_utils/fisherIdentity.js';

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
    methods: ['GET', 'POST'],
    rateLimit: { GET: RateLimitPresets.READ, POST: RateLimitPresets.WRITE }
  },
  async (req, res, { db, caller }) => {
    const waypointsCollection = db.collection('waypoints');
    const usersCollection = db.collection('users');

    if (req.method === 'GET') {
      const identifiers = sanitizeIdentifiers(req.query);

      // Which records belong to this fisher is resolved in one place; see
      // api/_utils/fisherIdentity.js. Waypoints are always private.
      const query = {
        isPrivate: true,
        ...(await resolveOwnerCriteria(identifiers, usersCollection))
      };

      const waypoints = await waypointsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      return res.json(waypoints);
    }

    const sanitizedBody = sanitizeInput(req.body);
    const { userId, imei, username, name, description, coordinates, type, metadata, isAdmin } = sanitizedBody;

    const validatedUserId = validateString(userId, { minLength: 1, maxLength: 100, required: true });
    const validatedName = validateString(name, { minLength: 1, maxLength: 200, required: true });

    if (!coordinates) {
      throw new ValidationError('Coordinates are required');
    }

    const validatedCoordinates = validateCoordinates(coordinates);
    const validatedType = validateEnum(type, VALID_WAYPOINT_TYPES, true);
    const validatedDescription = description ? validateString(description, { maxLength: 1000 }) : null;
    const validatedImei = imei ? validateString(imei, { maxLength: 50 }) : null;
    const validatedUsername = username ? validateString(username, { maxLength: 100 }) : null;

    const writeContext = await resolveWriteContext(
      {
        caller,
        userId: validatedUserId,
        imei: validatedImei,
        username: validatedUsername,
        isAdminFlag: isAdmin
      },
      usersCollection
    );

    const waypoint = {
      userId: writeContext.userIdForStorage,
      imei: writeContext.imei,
      username: writeContext.username,
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
      ...(writeContext.isAdminSubmission && { isAdminSubmission: true })
    };

    const result = await waypointsCollection.insertOne(waypoint);
    const createdWaypoint = await waypointsCollection.findOne({ _id: result.insertedId });

    return res.status(201).json(createdWaypoint);
  }
);
