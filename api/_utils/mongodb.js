import { MongoClient } from 'mongodb';

/**
 * Shared MongoDB connection utility for Vercel serverless functions
 * Implements connection pooling and caching to prevent connection exhaustion
 */

// Cache connection across function invocations
let cachedClient = null;
let cachedDb = null;

/**
 * Get MongoDB connection string from environment
 * Removes quotes if present (common config issue)
 */
function getMongoDBUri() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  // Remove quotes if present
  const cleanUri = uri.replace(/^["']|["']$/g, '');

  // Validate URI format
  if (!cleanUri.startsWith('mongodb://') && !cleanUri.startsWith('mongodb+srv://')) {
    console.error('Invalid MongoDB URI format:', cleanUri.substring(0, 20) + '...');
    throw new Error('Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://');
  }

  return cleanUri;
}

/**
 * Get database name from environment or use default
 */
function getDatabaseName() {
  return process.env.MONGODB_DATABASE || 'portal-prod';
}

/**
 * Connect to MongoDB with connection pooling
 * Returns cached connection if available and still connected
 *
 * @returns {Promise<{client: MongoClient, db: Db}>}
 */
export async function connectToDatabase() {
  // Return cached connection if available and still connected
  if (cachedClient && cachedDb) {
    try {
      // Verify connection is still alive
      await cachedClient.db().admin().ping();
      return { client: cachedClient, db: cachedDb };
    } catch (error) {
      console.warn('Cached connection lost, reconnecting...', error.message);
      cachedClient = null;
      cachedDb = null;
    }
  }

  const uri = getMongoDBUri();
  const dbName = getDatabaseName();

  // Create new connection with optimized settings for serverless
  const client = new MongoClient(uri, {
    // Connection pool settings optimized for serverless
    maxPoolSize: 10,        // Limit concurrent connections
    minPoolSize: 1,         // Keep at least one connection warm
    maxIdleTimeMS: 30000,   // Close idle connections after 30s

    // Timeout settings
    connectTimeoutMS: 30000,  // 30 second connection timeout
    socketTimeoutMS: 45000,   // 45 second socket timeout
    serverSelectionTimeoutMS: 30000, // 30 second server selection timeout

    // Retry settings
    retryWrites: true,
    retryReads: true,
  });

  try {
    // Connect to MongoDB
    await client.connect();

    // Cache the connection
    cachedClient = client;
    cachedDb = client.db(dbName);

    console.log(`Connected to MongoDB database: ${dbName}`);

    return { client: cachedClient, db: cachedDb };
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw new Error(`MongoDB connection failed: ${error.message}`);
  }
}

/**
 * Get database instance (shorthand for connectToDatabase().db)
 *
 * @returns {Promise<Db>}
 */
export async function getDatabase() {
  const { db } = await connectToDatabase();
  return db;
}

/**
 * Close MongoDB connection (for cleanup in development)
 * In production serverless, connections are managed by the platform
 */
export async function closeConnection() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
    console.log('MongoDB connection closed');
  }
}

/**
 * Health check - verify database connection
 *
 * @returns {Promise<boolean>}
 */
export async function isDatabaseConnected() {
  try {
    if (!cachedClient || !cachedDb) {
      return false;
    }

    await cachedClient.db().admin().ping();
    return true;
  } catch (error) {
    return false;
  }
}
