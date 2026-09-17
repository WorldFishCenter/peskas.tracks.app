import { summariseCatchStats, catchByFishGroup, communityImeis } from '../_utils/fisherStats.js';
import { getDatabase } from '../_utils/mongodb.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imei } = req.query;
    const { dateFrom, dateTo, compareWith = 'community' } = req.query;

    if (!imei) {
      return res.status(400).json({ error: 'IMEI is required' });
    }

    console.log(`Fetching fisher stats for IMEI: ${imei}, dateFrom: ${dateFrom}, dateTo: ${dateTo}, compareWith: ${compareWith}`);

    const db = await getDatabase();
    if (!db) {
      return res.status(500).json({ error: 'Database connection error' });
    }

    // Parse dates with proper error handling
    let fromDate, toDate;
    try {
      fromDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      toDate = dateTo ? new Date(dateTo) : new Date();

      // Validate dates
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)' });
    }

    // Get fisher's stats
    const fisherStatsCollection = db.collection('fishers-stats');
    const userStatsQuery = { imei, date: { $gte: fromDate, $lte: toDate } };
    const userStats = await fisherStatsCollection.find(userStatsQuery).toArray();

    const {
      trips: totalTrips,
      successfulTrips,
      totalCatch,
      successRate,
      avgCatchPerTrip
    } = summariseCatchStats(userStats);

    const catchByTypeArray = catchByFishGroup(userStats);

    // Get recent trips (last 5)
    const recentTrips = userStats
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map(stat => ({
        tripId: stat.tripId,
        date: stat.date,
        catch_kg: stat.catch_kg || 0,
        fishGroup: stat.fishGroup
      }));

    // Time series data for chart
    const timeSeries = userStats
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(stat => ({
        date: stat.date.toISOString().split('T')[0],
        catch_kg: stat.catch_kg || 0
      }));

    // Comparison logic
    let comparisonData = {
      avgCatch: 0,
      avgSuccessRate: 0,
      basedOn: '',
      hasData: false
    };

    const usersCollection = db.collection('users');

    if (compareWith === 'community') {
      // Compare with community fishers
      const user = await usersCollection.findOne({ IMEI: imei });
      const community = user?.Community;

      if (community) {
        const imeis = await communityImeis(usersCollection, community);

        // Get stats for community
        const communityStats = await fisherStatsCollection.find({
          imei: { $in: imeis, $ne: imei }, // Exclude current user
          date: { $gte: fromDate, $lte: toDate }
        }).toArray();

        if (communityStats.length > 0) {
          const summary = summariseCatchStats(communityStats);

          comparisonData = {
            avgCatch: summary.avgCatchPerTrip,
            avgSuccessRate: summary.successRate,
            basedOn: `${imeis.length - 1} fishers in ${community}`,
            hasData: true
          };
        }
      }
    } else if (compareWith === 'all') {
      // Compare with all fishers
      const allStats = await fisherStatsCollection.find({
        imei: { $ne: imei }, // Exclude current user
        date: { $gte: fromDate, $lte: toDate }
      }).toArray();

      if (allStats.length > 0) {
        const summary = summariseCatchStats(allStats);

        comparisonData = {
          avgCatch: summary.avgCatchPerTrip,
          avgSuccessRate: summary.successRate,
          basedOn: 'all fishers',
          hasData: true
        };
      }
    } else if (compareWith === 'previous') {
      // Compare with previous period
      const periodDuration = toDate - fromDate;
      const previousFromDate = new Date(fromDate - periodDuration);
      const previousToDate = new Date(fromDate);

      console.log(`Previous period: ${previousFromDate.toISOString()} to ${previousToDate.toISOString()}`);

      const previousStats = await fisherStatsCollection.find({
        imei,
        date: { $gte: previousFromDate, $lt: previousToDate }
      }).toArray();

      console.log(`Found ${previousStats.length} stats entries in previous period`);

      if (previousStats.length > 0) {
        const summary = summariseCatchStats(previousStats);

        console.log(`Previous period: ${summary.trips} trips, ${summary.successfulTrips} successful, ${summary.totalCatch} kg`);

        comparisonData = {
          avgCatch: summary.avgCatchPerTrip,
          avgSuccessRate: summary.successRate,
          basedOn: `${previousFromDate.toISOString().split('T')[0]} - ${previousToDate.toISOString().split('T')[0]}`,
          hasData: summary.trips > 0
        };
      }
    }

    return res.status(200).json({
      summary: {
        totalCatch: Math.round(totalCatch * 10) / 10,
        totalTrips,
        successfulTrips,
        successRate,
        avgCatchPerTrip: Math.round(avgCatchPerTrip * 10) / 10
      },
      catchByType: catchByTypeArray,
      recentTrips,
      timeSeries,
      comparison: {
        type: compareWith,
        ...comparisonData
      }
    });

  } catch (error) {
    console.error('Error fetching fisher stats:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
