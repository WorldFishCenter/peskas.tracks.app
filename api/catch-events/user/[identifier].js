import { createEndpoint } from '../../_utils/endpoint.js';
import { resolveIdentifierCriteria } from '../../_utils/fisherIdentity.js';

export default createEndpoint({ methods: ['GET'] }, async (req, res, { db }) => {
  const { identifier } = req.query;

  // One query rather than probing IMEI, then looking the identifier up as a
  // username, then querying again. See api/_utils/fisherIdentity.js.
  const events = await db
    .collection('catch-events')
    .find(resolveIdentifierCriteria(identifier))
    .sort({ reportedAt: -1 })
    .toArray();

  return res.status(200).json(events);
});
