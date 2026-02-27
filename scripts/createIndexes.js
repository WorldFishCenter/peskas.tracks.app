/**
 * Database Indexes Creation Script
 * Run this script to create optimal indexes for MongoDB collections
 *
 * Usage: node scripts/createIndexes.js
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI?.replace(/^["']|["']$/g, '');
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'portal-prod';

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not set');
  process.exit(1);
}

/**
 * Index definitions for all collections
 */
const indexDefinitions = {
  'users': [
    // Primary lookups
    { keys: { IMEI: 1 }, options: { name: 'idx_imei', unique: true, sparse: true } },
    { keys: { username: 1 }, options: { name: 'idx_username', unique: true, sparse: true } },
    { keys: { Boat: 1 }, options: { name: 'idx_boat' } },

    // Secondary lookups
    { keys: { Community: 1 }, options: { name: 'idx_community' } },
    { keys: { Region: 1 }, options: { name: 'idx_region' } },
    { keys: { role: 1 }, options: { name: 'idx_role' } },

    // Compound indexes for common queries
    { keys: { Community: 1, Region: 1 }, options: { name: 'idx_community_region' } }
  ],

  'catch-events': [
    // Primary lookups
    { keys: { tripId: 1 }, options: { name: 'idx_tripId' } },
    { keys: { imei: 1 }, options: { name: 'idx_imei' } },
    { keys: { username: 1 }, options: { name: 'idx_username' } },

    // Sorting and filtering
    { keys: { reportedAt: -1 }, options: { name: 'idx_reportedAt_desc' } },
    { keys: { date: -1 }, options: { name: 'idx_date_desc' } },
    { keys: { catch_outcome: 1 }, options: { name: 'idx_catch_outcome' } },

    // Compound indexes for common queries
    { keys: { imei: 1, reportedAt: -1 }, options: { name: 'idx_imei_reported' } },
    { keys: { tripId: 1, reportedAt: -1 }, options: { name: 'idx_trip_reported' } },
    { keys: { username: 1, reportedAt: -1 }, options: { name: 'idx_username_reported' } },

    // Analytics queries
    { keys: { fishGroup: 1, date: -1 }, options: { name: 'idx_fishgroup_date' } },
    { keys: { community: 1, date: -1 }, options: { name: 'idx_community_date' } }
  ],

  'waypoints': [
    // Primary lookups
    { keys: { userId: 1 }, options: { name: 'idx_userId' } },
    { keys: { _id: 1, userId: 1 }, options: { name: 'idx_id_userId' } },

    // Sorting
    { keys: { createdAt: -1 }, options: { name: 'idx_createdAt_desc' } },
    { keys: { updatedAt: -1 }, options: { name: 'idx_updatedAt_desc' } },

    // Filtering
    { keys: { type: 1 }, options: { name: 'idx_type' } },
    { keys: { isPrivate: 1 }, options: { name: 'idx_isPrivate' } },

    // Geospatial queries (if needed in future)
    { keys: { 'coordinates.lat': 1, 'coordinates.lng': 1 }, options: { name: 'idx_coordinates' } },

    // Compound indexes
    { keys: { userId: 1, type: 1 }, options: { name: 'idx_userId_type' } },
    { keys: { userId: 1, createdAt: -1 }, options: { name: 'idx_userId_created' } }
  ],

  'fishers-stats': [
    // Primary lookups
    { keys: { imei: 1 }, options: { name: 'idx_imei' } },
    { keys: { date: -1 }, options: { name: 'idx_date_desc' } },

    // Compound indexes for queries
    { keys: { imei: 1, date: -1 }, options: { name: 'idx_imei_date' } }
  ],

  'fishers-performance': [
    // Primary lookups
    { keys: { imei: 1 }, options: { name: 'idx_imei' } },
    { keys: { tripId: 1 }, options: { name: 'idx_tripId', unique: true } },

    // Sorting
    { keys: { started: -1 }, options: { name: 'idx_started_desc' } },
    { keys: { ended: -1 }, options: { name: 'idx_ended_desc' } },

    // Compound indexes
    { keys: { imei: 1, started: -1 }, options: { name: 'idx_imei_started' } },
    { keys: { imei: 1, ended: -1 }, options: { name: 'idx_imei_ended' } }
  ]
};

/**
 * Create indexes for a collection
 */
async function createIndexesForCollection(db, collectionName, indexes) {
  const collection = db.collection(collectionName);

  console.log(`\nCreating indexes for collection: ${collectionName}`);

  for (const { keys, options } of indexes) {
    try {
      await collection.createIndex(keys, options);
      console.log(`  ✓ Created index: ${options.name}`);
    } catch (error) {
      if (error.code === 85 || error.codeName === 'IndexOptionsConflict') {
        // Index already exists with different options - drop and recreate
        console.log(`  ⚠ Index ${options.name} exists with different options, recreating...`);
        try {
          await collection.dropIndex(options.name);
          await collection.createIndex(keys, options);
          console.log(`  ✓ Recreated index: ${options.name}`);
        } catch (dropError) {
          console.error(`  ✗ Failed to recreate index ${options.name}:`, dropError.message);
        }
      } else if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
        console.log(`  → Index ${options.name} already exists (skipping)`);
      } else {
        console.error(`  ✗ Failed to create index ${options.name}:`, error.message);
      }
    }
  }
}

/**
 * List existing indexes for a collection
 */
async function listIndexes(db, collectionName) {
  const collection = db.collection(collectionName);

  try {
    const indexes = await collection.indexes();
    console.log(`\nExisting indexes for ${collectionName}:`);
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });
  } catch (error) {
    console.error(`Error listing indexes for ${collectionName}:`, error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('MongoDB Index Creation Script');
  console.log('='.repeat(60));
  console.log(`Database: ${DATABASE_NAME}`);
  console.log(`URI: ${MONGODB_URI.substring(0, 30)}...`);

  let client;

  try {
    // Connect to MongoDB
    console.log('\nConnecting to MongoDB...');
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 30000
    });

    await client.connect();
    console.log('✓ Connected to MongoDB');

    const db = client.db(DATABASE_NAME);

    // List existing collections
    const collections = await db.listCollections().toArray();
    console.log('\nFound collections:', collections.map(c => c.name).join(', '));

    // Create indexes for each collection
    for (const [collectionName, indexes] of Object.entries(indexDefinitions)) {
      // Check if collection exists
      const collectionExists = collections.some(c => c.name === collectionName);

      if (!collectionExists) {
        console.log(`\n⚠ Collection ${collectionName} does not exist yet (will be created on first insert)`);
        continue;
      }

      // List existing indexes (before)
      if (process.argv.includes('--verbose')) {
        await listIndexes(db, collectionName);
      }

      // Create indexes
      await createIndexesForCollection(db, collectionName, indexes);

      // List indexes after creation (if verbose)
      if (process.argv.includes('--verbose')) {
        await listIndexes(db, collectionName);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✓ Index creation completed successfully');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n✓ MongoDB connection closed');
    }
  }
}

// Run the script
main();
