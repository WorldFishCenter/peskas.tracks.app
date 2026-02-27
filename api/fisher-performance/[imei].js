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
    console.log('MongoDB connection successful for fisher-performance');
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

    console.log(`Fetching fisher performance for IMEI: ${imei}, dateFrom: ${dateFrom}, dateTo: ${dateTo}, compareWith: ${compareWith}`);

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

    const performanceCollection = db.collection('fishers-performance');
    const fisherStatsCollection = db.collection('fishers-stats');

    // Get fisher's performance data
    const userPerformance = await performanceCollection.find({
      imei,
      started: { $gte: fromDate, $lte: toDate }
    }).toArray();

    // Group by trip to get trip types with catch amounts
    const tripTypeMap = new Map();
    const tripsWithMetrics = new Map();

    userPerformance.forEach(perf => {
      const tripId = perf.tripId;

      if (!tripsWithMetrics.has(tripId)) {
        tripsWithMetrics.set(tripId, {
          tripType: perf.trip_type,
          metrics: {}
        });

        if (!tripTypeMap.has(perf.trip_type)) {
          tripTypeMap.set(perf.trip_type, { count: 0, totalCatch: 0, trips: new Set() });
        }
        tripTypeMap.get(perf.trip_type).trips.add(tripId);
      }

      tripsWithMetrics.get(tripId).metrics[perf.metric] = perf.value;
    });

    // Get catch amounts for each trip
    const tripIds = Array.from(tripsWithMetrics.keys());
    const statsForTrips = await fisherStatsCollection.find({
      imei,
      tripId: { $in: tripIds }
    }).toArray();

    const tripCatchMap = new Map();
    statsForTrips.forEach(stat => {
      if (!tripCatchMap.has(stat.tripId)) {
        tripCatchMap.set(stat.tripId, 0);
      }
      tripCatchMap.set(stat.tripId, tripCatchMap.get(stat.tripId) + (stat.catch_kg || 0));
    });

    // Calculate average catch per trip type
    tripsWithMetrics.forEach((data, tripId) => {
      const tripType = data.tripType;
      const catchAmount = tripCatchMap.get(tripId) || 0;
      tripTypeMap.get(tripType).totalCatch += catchAmount;
      tripTypeMap.get(tripType).count = tripTypeMap.get(tripType).trips.size;
    });

    const tripTypes = {};
    tripTypeMap.forEach((data, type) => {
      tripTypes[type] = {
        count: data.count,
        avgCatch: data.count > 0 ? Math.round((data.totalCatch / data.count) * 10) / 10 : 0
      };
    });

    // Calculate average metrics
    const metricSums = {
      cpue_kg_per_hour: [],
      kg_per_liter: [],
      search_ratio: []
    };

    userPerformance.forEach(perf => {
      if (metricSums[perf.metric] !== undefined) {
        metricSums[perf.metric].push(perf.value);
      }
    });

    const calculateAvg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const userMetrics = {
      cpue_kg_per_hour: calculateAvg(metricSums.cpue_kg_per_hour),
      kg_per_liter: calculateAvg(metricSums.kg_per_liter),
      search_ratio: calculateAvg(metricSums.search_ratio)
    };

    // Get best trips (highest CPUE)
    const tripsWithCPUE = [];
    tripsWithMetrics.forEach((data, tripId) => {
      if (data.metrics.cpue_kg_per_hour !== undefined) {
        const trip = userPerformance.find(p => p.tripId === tripId);
        tripsWithCPUE.push({
          tripId,
          date: trip.started,
          tripType: data.tripType,
          cpue_kg_per_hour: data.metrics.cpue_kg_per_hour
        });
      }
    });

    const bestTrips = tripsWithCPUE
      .sort((a, b) => b.cpue_kg_per_hour - a.cpue_kg_per_hour)
      .slice(0, 5);

    // Comparison logic
    let comparisonMetrics = {
      cpue_kg_per_hour: 0,
      kg_per_liter: 0,
      search_ratio: 0
    };
    let comparisonLabel = '';

    if (compareWith === 'community') {
      const usersCollection = db.collection('users');
      const user = await usersCollection.findOne({ IMEI: imei });
      const community = user?.Community;

      if (community) {
        const communityUsers = await usersCollection.find({ Community: community }).toArray();
        const communityImeis = communityUsers.map(u => u.IMEI);

        const communityPerformance = await performanceCollection.find({
          imei: { $in: communityImeis, $ne: imei },
          started: { $gte: fromDate, $lte: toDate }
        }).toArray();

        const communityMetricSums = {
          cpue_kg_per_hour: [],
          kg_per_liter: [],
          search_ratio: []
        };

        communityPerformance.forEach(perf => {
          if (communityMetricSums[perf.metric] !== undefined) {
            communityMetricSums[perf.metric].push(perf.value);
          }
        });

        comparisonMetrics.cpue_kg_per_hour = calculateAvg(communityMetricSums.cpue_kg_per_hour);
        comparisonMetrics.kg_per_liter = calculateAvg(communityMetricSums.kg_per_liter);
        comparisonMetrics.search_ratio = calculateAvg(communityMetricSums.search_ratio);

        // Only set label if there's actual data (not all zeros)
        const hasData = comparisonMetrics.cpue_kg_per_hour > 0 ||
                       comparisonMetrics.kg_per_liter > 0 ||
                       comparisonMetrics.search_ratio > 0;
        comparisonLabel = hasData ? `${communityImeis.length - 1} fishers in ${community}` : '';
      }
    } else if (compareWith === 'all') {
      const allPerformance = await performanceCollection.find({
        imei: { $ne: imei },
        started: { $gte: fromDate, $lte: toDate }
      }).toArray();

      const allMetricSums = {
        cpue_kg_per_hour: [],
        kg_per_liter: [],
        search_ratio: []
      };

      allPerformance.forEach(perf => {
        if (allMetricSums[perf.metric] !== undefined) {
          allMetricSums[perf.metric].push(perf.value);
        }
      });

      comparisonMetrics.cpue_kg_per_hour = calculateAvg(allMetricSums.cpue_kg_per_hour);
      comparisonMetrics.kg_per_liter = calculateAvg(allMetricSums.kg_per_liter);
      comparisonMetrics.search_ratio = calculateAvg(allMetricSums.search_ratio);

      // Only set label if there's actual data (not all zeros)
      const hasData = comparisonMetrics.cpue_kg_per_hour > 0 ||
                     comparisonMetrics.kg_per_liter > 0 ||
                     comparisonMetrics.search_ratio > 0;
      comparisonLabel = hasData ? 'all fishers' : '';
    } else if (compareWith === 'previous') {
      const periodDuration = toDate - fromDate;
      const previousFromDate = new Date(fromDate - periodDuration);
      const previousToDate = new Date(fromDate);

      const previousPerformance = await performanceCollection.find({
        imei,
        started: { $gte: previousFromDate, $lt: previousToDate }
      }).toArray();

      const prevMetricSums = {
        cpue_kg_per_hour: [],
        kg_per_liter: [],
        search_ratio: []
      };

      previousPerformance.forEach(perf => {
        if (prevMetricSums[perf.metric] !== undefined) {
          prevMetricSums[perf.metric].push(perf.value);
        }
      });

      comparisonMetrics.cpue_kg_per_hour = calculateAvg(prevMetricSums.cpue_kg_per_hour);
      comparisonMetrics.kg_per_liter = calculateAvg(prevMetricSums.kg_per_liter);
      comparisonMetrics.search_ratio = calculateAvg(prevMetricSums.search_ratio);

      // Only set label if there's actual data (not all zeros)
      const hasData = comparisonMetrics.cpue_kg_per_hour > 0 ||
                     comparisonMetrics.kg_per_liter > 0 ||
                     comparisonMetrics.search_ratio > 0;

      // Format date range for comparison label - ALWAYS show the date range, even if no data
      const formatDate = (date) => {
        const month = date.toLocaleString('en-US', { month: 'short' });
        const day = date.getDate();
        return `${month} ${day}`;
      };
      comparisonLabel = `${formatDate(previousFromDate)} - ${formatDate(previousToDate)}`;
      comparisonMetrics.hasData = hasData; // Indicate if there's actual data
    }

    // Calculate percent differences
    const calculatePercentDiff = (your, comparison) => {
      if (comparison === 0) return 0;
      return Math.round(((your - comparison) / comparison) * 100);
    };

    const metrics = {
      cpue_kg_per_hour: {
        yourAvg: Math.round(userMetrics.cpue_kg_per_hour * 10) / 10,
        comparisonAvg: Math.round(comparisonMetrics.cpue_kg_per_hour * 10) / 10,
        percentDiff: calculatePercentDiff(userMetrics.cpue_kg_per_hour, comparisonMetrics.cpue_kg_per_hour)
      },
      kg_per_liter: {
        yourAvg: Math.round(userMetrics.kg_per_liter * 10) / 10,
        comparisonAvg: Math.round(comparisonMetrics.kg_per_liter * 10) / 10,
        percentDiff: calculatePercentDiff(userMetrics.kg_per_liter, comparisonMetrics.kg_per_liter)
      },
      search_ratio: {
        yourAvg: Math.round(userMetrics.search_ratio * 10) / 10,
        comparisonAvg: Math.round(comparisonMetrics.search_ratio * 10) / 10,
        percentDiff: calculatePercentDiff(userMetrics.search_ratio, comparisonMetrics.search_ratio)
      }
    };

    return res.status(200).json({
      tripTypes,
      metrics,
      bestTrips: bestTrips.map(trip => ({
        tripId: trip.tripId,
        date: trip.date,
        tripType: trip.tripType,
        cpue: Math.round(trip.cpue_kg_per_hour * 10) / 10
      })),
      comparison: {
        type: compareWith,
        basedOn: comparisonLabel
      }
    });

  } catch (error) {
    console.error('Error fetching fisher performance:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
