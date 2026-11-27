import { createEndpoint, ValidationError, UnauthorizedError, NotFoundError } from '../../_utils/endpoint.js';
import { parseUserObjectId } from '../../_utils/fisherIdentity.js';

export default createEndpoint({ methods: ['POST'] }, async (req, res, { db }) => {
  const objectId = parseUserObjectId(req.query.userId);
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ValidationError('Current password and new password are required');
  }

  if (newPassword.length < 6) {
    throw new ValidationError('New password must be at least 6 characters');
  }

  const usersCollection = db.collection('users');
  const user = await usersCollection.findOne({ _id: objectId, password: currentPassword });

  if (!user) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const result = await usersCollection.updateOne(
    { _id: objectId },
    {
      $set: {
        password: newPassword,
        updatedAt: new Date()
      }
    }
  );

  if (result.matchedCount === 0) {
    throw new NotFoundError('User not found');
  }

  return res.status(200).json({
    success: true,
    message: 'Password changed successfully'
  });
});
