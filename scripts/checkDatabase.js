/**
 * Database Connection Check
 * Verifies MongoDB is reachable and reports collection counts.
 *
 * Was previously GET /api/test-db on the Express dev server; it is a
 * diagnostic rather than an endpoint, so it does not belong on the
 * production surface.
 *
 * Usage: node scripts/checkDatabase.js
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI?.replace(/^["']|["']$/g, '');
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'portal-prod';

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not set');
  process.exit(1);
}

async function checkDatabase() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);

    const userCount = await db.collection('users').countDocuments();
    const catchEventsCount = await db.collection('catch-events').countDocuments();
    const waypointsCount = await db.collection('waypoints').countDocuments();

    console.log('Database connection successful');
    console.log(`  database:     ${db.databaseName}`);
    console.log(`  users:        ${userCount}`);
    console.log(`  catch-events: ${catchEventsCount}`);
    console.log(`  waypoints:    ${waypointsCount}`);
  } catch (error) {
    console.error('Database check failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

checkDatabase();
