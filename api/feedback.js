import { createEndpoint, ValidationError } from './_utils/endpoint.js';
import { resolveWriteContext } from './_utils/fisherIdentity.js';

const VALID_TYPES = ['opinion', 'problem', 'suggestion', 'question', 'other'];

export default createEndpoint({ methods: ['GET', 'POST'] }, async (req, res, { db, caller }) => {
  const feedbackCollection = db.collection('feedback');

  if (req.method === 'POST') {
    const { type, message, imei, username } = req.body;

    if (!type || typeof type !== 'string') {
      throw new ValidationError('Type is required and must be a string');
    }
    if (!message || typeof message !== 'string') {
      throw new ValidationError('Message is required and must be a string');
    }
    if (!VALID_TYPES.includes(type)) {
      throw new ValidationError(`Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`);
    }
    if (message.length > 2000) {
      throw new ValidationError('Message must be 2000 characters or less');
    }

    const hasImei = typeof imei === 'string' && imei.length > 0;
    const hasUsername = typeof username === 'string' && username.length > 0;

    if (!hasImei && !hasUsername) {
      throw new ValidationError('Either imei or username is required');
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

    const feedback = {
      userId: writeContext.userIdString,
      imei: writeContext.imei,
      username: writeContext.isAdminSubmission ? 'admin' : (username || null),
      boatName: writeContext.boatName,
      community: writeContext.community,
      type,
      message: message.trim(),
      status: 'new',
      createdAt: new Date(),
      updatedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      adminNotes: null,
      ...(writeContext.isAdminSubmission && { isAdminSubmission: true })
    };

    const result = await feedbackCollection.insertOne(feedback);
    const createdFeedback = await feedbackCollection.findOne({ _id: result.insertedId });

    return res.status(201).json(createdFeedback);
  }

  const { userId } = req.query;
  if (!userId) {
    throw new ValidationError('userId query parameter is required');
  }

  const feedback = await feedbackCollection
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();

  return res.json(feedback);
});
