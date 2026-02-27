import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory for proper path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables BEFORE accessing process.env
// This is necessary because ES modules load dependencies before the main file
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// MongoDB Connection
// Remove quotes from MongoDB URI if present
const MONGODB_URI = process.env.MONGODB_URI
  ? process.env.MONGODB_URI.replace(/^"|"$/g, '')
  : '';

// Display a masked version of the connection string for security
if (MONGODB_URI) {
  const maskedURI = MONGODB_URI.replace(/(mongodb\+srv:\/\/)([^:]+):([^@]+)@/, '$1$2:****@');
  console.log(`Connecting to MongoDB with URI: ${maskedURI.substring(0, 30)}...`);
} else {
  console.error('MongoDB URI is not defined in environment variables');
}

// Create MongoDB client with proper options
const client = new MongoClient(MONGODB_URI, {
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
});

// Database name
const DB_NAME = 'portal-prod';

/**
 * Connect to MongoDB and return the database instance
 * @returns {Promise<import('mongodb').Db|null>} Database instance or null on error
 */
export async function connectToMongo() {
  try {
    if (!client.topology || !client.topology.isConnected()) {
      await client.connect();
      console.log('Connected to MongoDB');
    }
    return client.db(DB_NAME);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    return null;
  }
}

/**
 * Get the MongoDB client instance
 * @returns {MongoClient} MongoDB client
 */
export function getClient() {
  return client;
}

export { ObjectId } from 'mongodb';
