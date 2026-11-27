import { createEndpoint, ValidationError } from './_utils/endpoint.js';
import { resolveWriteContext } from './_utils/fisherIdentity.js';

const VALID_FISH_GROUPS = [
  'reef fish',
  'sharks/rays',
  'small pelagics',
  'large pelagics',
  'tuna/tuna-like'
];

const isOptionalId = (id) =>
  id === undefined || id === null || (typeof id === 'string' && id.length > 0 && id.length <= 100);

export default createEndpoint({ methods: ['GET', 'POST'] }, async (req, res, { db, caller }) => {
  const catchEventsCollection = db.collection('catch-events');

  if (req.method === 'POST') {
    const {
      tripId,
      date,
      fishGroup,
      quantity,
      imei,
      username,
      catch_outcome,
      photos,
      gps_photo,
      fuel_liters,
      reportId,
      entryId
    } = req.body;

    const hasImei = typeof imei === 'string' && imei.length > 0;
    const hasUsername = typeof username === 'string' && username.length > 0;

    if (!tripId || !date || catch_outcome === undefined || (!hasImei && !hasUsername)) {
      throw new ValidationError('Missing required fields: tripId, date, (imei or username), catch_outcome');
    }

    if (catch_outcome !== 0 && catch_outcome !== 1) {
      throw new ValidationError('catch_outcome must be 0 (no catch) or 1 (has catch)');
    }

    if (catch_outcome === 1) {
      if (!fishGroup || !quantity) {
        throw new ValidationError('fishGroup and quantity are required when catch_outcome = 1');
      }
      if (!VALID_FISH_GROUPS.includes(fishGroup)) {
        throw new ValidationError(`Invalid fish group. Must be one of: ${VALID_FISH_GROUPS.join(', ')}`);
      }
      if (typeof quantity !== 'number' || quantity <= 0) {
        throw new ValidationError('Quantity must be a positive number');
      }
    }

    const hasFuel = fuel_liters != null;
    if (hasFuel && !(Number.isFinite(fuel_liters) && fuel_liters >= 0)) {
      throw new ValidationError('fuel_liters must be a number of litres, 0 or more');
    }

    if (!isOptionalId(reportId) || !isOptionalId(entryId)) {
      throw new ValidationError('reportId and entryId must be short strings');
    }

    const writeContext = await resolveWriteContext(
      {
        caller,
        imei: hasImei ? imei : null,
        username: hasUsername ? username : null,
        isAdminFlag: req.body.isAdmin
      },
      db.collection('users')
    );

    const catchEvent = {
      tripId,
      date: new Date(date),
      catch_outcome,
      imei: writeContext.imei,
      username: writeContext.username,
      boatName: writeContext.boatName,
      community: writeContext.community,
      reportedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(writeContext.isAdminSubmission && { isAdminSubmission: true }),
      ...(hasFuel && { fuel_liters }),
      ...(catch_outcome === 1 && {
        fishGroup,
        quantity: parseFloat(quantity),
        photos: photos || [],
        gps_photo: gps_photo || []
      })
    };

    // A retried upload sends the same reportId + entryId again: keep the first copy.
    // The filter must match idx_report_entry_unique exactly, so MongoDB retries a clash itself.
    if (reportId) {
      const { value: storedEvent, lastErrorObject } = await catchEventsCollection.findOneAndUpdate(
        { reportId, entryId: entryId || null },
        { $setOnInsert: catchEvent },
        { upsert: true, returnDocument: 'after', includeResultMetadata: true }
      );
      const created = !lastErrorObject?.updatedExisting;
      return res.status(created ? 201 : 200).json(storedEvent);
    }

    const result = await catchEventsCollection.insertOne(catchEvent);
    const createdEvent = await catchEventsCollection.findOne({ _id: result.insertedId });
    return res.status(201).json(createdEvent);
  }

  const { tripId, imei, username } = req.query;

  if (tripId) {
    if (typeof tripId !== 'string') {
      throw new ValidationError('Trip ID is required and must be a string');
    }
    const events = await catchEventsCollection.find({ tripId }).sort({ reportedAt: -1 }).toArray();
    return res.json(events);
  }

  if (imei) {
    if (typeof imei !== 'string') {
      throw new ValidationError('IMEI is required and must be a string');
    }
    const events = await catchEventsCollection.find({ imei }).sort({ reportedAt: -1 }).toArray();
    return res.json(events);
  }

  if (username) {
    if (typeof username !== 'string') {
      throw new ValidationError('Username is required and must be a string');
    }
    const events = await catchEventsCollection.find({ username }).sort({ reportedAt: -1 }).toArray();
    return res.json(events);
  }

  throw new ValidationError('Either tripId, imei, or username query parameter is required');
});
