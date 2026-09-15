/**
 * Fisher Collections Explorer
 * Reports the shape of the fishers-stats and fishers-performance collections:
 * document counts, field names, and the distinct metric and trip_type values
 * the fisher-stats and fisher-performance endpoints aggregate over.
 *
 * Was previously GET /api/explore-fisher-collections on the Express dev
 * server; it is a diagnostic rather than an endpoint.
 *
 * Usage: node scripts/exploreFisherCollections.js
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI?.replace(/^["']|["']$/g, '');
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'portal-prod';
const SAMPLE_SIZE = 10;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not set');
  process.exit(1);
}

async function describeCollection(db, name) {
  const collection = db.collection(name);
  const samples = await collection.find().limit(SAMPLE_SIZE).toArray();

  return {
    count: await collection.countDocuments(),
    fields: samples[0] ? Object.keys(samples[0]) : [],
    sample: samples[0] ?? null,
  };
}

async function exploreFisherCollections() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);

    const stats = await describeCollection(db, 'fishers-stats');
    const performance = await describeCollection(db, 'fishers-performance');

    const uniqueMetrics = await db.collection('fishers-performance').distinct('metric');
    const uniqueTripTypes = await db.collection('fishers-performance').distinct('trip_type');

    console.log('fishers-stats');
    console.log(`  documents: ${stats.count}`);
    console.log(`  fields:    ${stats.fields.join(', ') || '(none)'}`);

    console.log('\nfishers-performance');
    console.log(`  documents:  ${performance.count}`);
    console.log(`  fields:     ${performance.fields.join(', ') || '(none)'}`);
    console.log(`  metrics:    ${uniqueMetrics.join(', ') || '(none)'}`);
    console.log(`  trip types: ${uniqueTripTypes.join(', ') || '(none)'}`);

    if (process.argv.includes('--samples')) {
      console.log('\nSample documents');
      console.log(JSON.stringify({ stats: stats.sample, performance: performance.sample }, null, 2));
    }
  } catch (error) {
    console.error('Collection exploration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

exploreFisherCollections();
