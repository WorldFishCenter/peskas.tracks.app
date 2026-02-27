import { MongoClient } from 'mongodb';

// MongoDB Connection - with connection caching for serverless optimization
const MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/^"(.*)"$/, '$1')
  : '';

let cachedClient = null;
let cachedDb = null;

async function connectToMongo() {
  if (cachedDb) {
    return cachedDb;
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
    console.error('Invalid MongoDB URI format');
    throw new Error('Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://');
  }

  const client = new MongoClient(MONGODB_URI, {
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
  });

  try {
    await client.connect();
    console.log('MongoDB connection successful for fisher-stats');
    const db = client.db('portal-prod');

    cachedClient = client;
    cachedDb = db;

    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

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

    const db = await connectToMongo();
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

    // Calculate summary statistics
    const totalTrips = userStats.length;
    const successfulTrips = userStats.filter(s => s.catch_kg > 0).length;
    const totalCatch = userStats.reduce((sum, s) => sum + (s.catch_kg || 0), 0);
    const successRate = totalTrips > 0 ? successfulTrips / totalTrips : 0;
    const avgCatchPerTrip = totalTrips > 0 ? totalCatch / totalTrips : 0;

    // Group catch by fish type
    const catchByType = {};
    userStats.forEach(stat => {
      if (stat.catch_kg > 0 && stat.fishGroup) {
        if (!catchByType[stat.fishGroup]) {
          catchByType[stat.fishGroup] = { totalKg: 0, count: 0 };
        }
        catchByType[stat.fishGroup].totalKg += stat.catch_kg;
        catchByType[stat.fishGroup].count += 1;
      }
    });

    const catchByTypeArray = Object.entries(catchByType).map(([fishGroup, data]) => ({
      fishGroup,
      totalKg: Math.round(data.totalKg * 10) / 10,
      count: data.count
    }));

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
        const communityUsers = await usersCollection.find({ Community: community }).toArray();
        const communityImeis = communityUsers.map(u => u.IMEI);

        // Get stats for community
        const communityStats = await fisherStatsCollection.find({
          imei: { $in: communityImeis, $ne: imei }, // Exclude current user
          date: { $gte: fromDate, $lte: toDate }
        }).toArray();

        if (communityStats.length > 0) {
          const communityTotalTrips = communityStats.length;
          const communitySuccessfulTrips = communityStats.filter(s => s.catch_kg > 0).length;
          const communityTotalCatch = communityStats.reduce((sum, s) => sum + (s.catch_kg || 0), 0);

          comparisonData = {
            avgCatch: communityTotalTrips > 0 ? communityTotalCatch / communityTotalTrips : 0,
            avgSuccessRate: communityTotalTrips > 0 ? communitySuccessfulTrips / communityTotalTrips : 0,
            basedOn: `${communityImeis.length - 1} fishers in ${community}`,
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
        const allTotalTrips = allStats.length;
        const allSuccessfulTrips = allStats.filter(s => s.catch_kg > 0).length;
        const allTotalCatch = allStats.reduce((sum, s) => sum + (s.catch_kg || 0), 0);

        comparisonData = {
          avgCatch: allTotalTrips > 0 ? allTotalCatch / allTotalTrips : 0,
          avgSuccessRate: allTotalTrips > 0 ? allSuccessfulTrips / allTotalTrips : 0,
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
        const prevTotalTrips = previousStats.length;
        const prevSuccessfulTrips = previousStats.filter(s => s.catch_kg > 0).length;
        const prevTotalCatch = previousStats.reduce((sum, s) => sum + (s.catch_kg || 0), 0);

        console.log(`Previous period: ${prevTotalTrips} trips, ${prevSuccessfulTrips} successful, ${prevTotalCatch} kg`);

        comparisonData = {
          avgCatch: prevTotalTrips > 0 ? prevTotalCatch / prevTotalTrips : 0,
          avgSuccessRate: prevTotalTrips > 0 ? prevSuccessfulTrips / prevTotalTrips : 0,
          basedOn: `${previousFromDate.toISOString().split('T')[0]} - ${previousToDate.toISOString().split('T')[0]}`,
          hasData: prevTotalTrips > 0
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
