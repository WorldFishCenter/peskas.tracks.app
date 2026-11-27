import { createEndpoint } from '../_utils/endpoint.js';
import { getFisherPerformance } from '../_utils/fisherStats.js';

export default createEndpoint({ methods: ['GET'] }, async (req, res, { db }) => {
  const { imei, dateFrom, dateTo, compareWith = 'community' } = req.query;

  const performance = await getFisherPerformance(db, {
    identifier: imei,
    dateFrom,
    dateTo,
    compareWith
  });

  return res.status(200).json(performance);
});
