import { createEndpoint, NotFoundError } from '../_utils/endpoint.js';
import { parseUserObjectId } from '../_utils/fisherIdentity.js';

export default createEndpoint({ methods: ['GET', 'PUT'] }, async (req, res, { db }) => {
  const objectId = parseUserObjectId(req.query.userId);
  const usersCollection = db.collection('users');

  if (req.method === 'GET') {
    const user = await usersCollection.findOne(
      { _id: objectId },
      { projection: { password: 0 } }
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return res.status(200).json(user);
  }

  const { phoneNumber, Country, vessel_type, main_gear_type, Boat } = req.body;
  const result = await usersCollection.updateOne(
    { _id: objectId },
    {
      $set: {
        phoneNumber,
        Country,
        vessel_type,
        main_gear_type,
        Boat,
        updatedAt: new Date()
      }
    }
  );

  if (result.matchedCount === 0) {
    throw new NotFoundError('User not found');
  }

  return res.status(200).json({
    success: true,
    message: 'Profile updated successfully'
  });
});
