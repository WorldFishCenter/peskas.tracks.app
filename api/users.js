import { createEndpoint } from './_utils/endpoint.js';

export default createEndpoint({ methods: ['GET'] }, async (_req, res, { db }) => {
  // Administrator accounts live in this collection but are not vessels, and
  // this list feeds the vessel picker. Without the filter they show up there
  // as blank rows: no Boat, no IMEI, nothing to track.
  const users = await db
    .collection('users')
    .find({ role: { $ne: 'admin' } }, { projection: { password: 0 } })
    .toArray();

  return res.status(200).json(users);
});
