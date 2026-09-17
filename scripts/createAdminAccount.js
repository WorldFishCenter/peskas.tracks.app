/**
 * Create an administrator account.
 *
 * Administrators used to share one identity: the browser minted `id: 'admin'`
 * for anyone who typed the global password, so every administrator's
 * waypoints, catch events and feedback landed in the same pile. This gives
 * each of them an account of their own, which is what step 2 of
 * docs/API-AUTH-PLAN.md asks for.
 *
 * An admin account is an ordinary `users` document with `role: 'admin'` and no
 * IMEI or Boat — it is a person, not a vessel. `api/auth/login.js` reads that
 * field, and `api/users.js` keeps such accounts out of the vessel picker.
 *
 * The password is stored as typed. That is the owner's decision, recorded
 * under "Decisions already taken" in docs/API-AUTH-PLAN.md, and matches how
 * every fisher password in this collection is already stored.
 *
 * Usage:
 *   node scripts/createAdminAccount.js <username>   # prompts for the password
 *   node scripts/createAdminAccount.js --list       # show existing admins
 *
 * Writes to MONGODB_DATABASE, or portal-prod when that is unset. Note that the
 * repository's usual connection string points at production even where it is
 * labelled dev, so check the database name it prints before confirming.
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import readline from 'node:readline';

dotenv.config({ path: '.env.local' });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI?.replace(/^["']|["']$/g, '');
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'portal-prod';

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not set');
  process.exit(1);
}

/** Ask a question without echoing the answer to the terminal. */
function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let asked = false;
    rl._writeToOutput = (chunk) => {
      // Let the question through once, then swallow the keystrokes echoed back.
      if (!asked && chunk.includes(question)) {
        asked = true;
        rl.output.write(chunk);
      }
    };
    rl.question(question, (answer) => {
      rl.output.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function listAdmins(users) {
  const admins = await users.find({ role: 'admin' }, { projection: { password: 0 } }).toArray();

  if (admins.length === 0) {
    console.log('No administrator accounts exist yet.');
    return;
  }

  console.log(`${admins.length} administrator account(s):`);
  for (const admin of admins) {
    console.log(`  ${admin.username}  (${admin._id}, created ${admin.createdAt || 'unknown'})`);
  }
}

async function createAdmin(users, username) {
  // login.js matches usernames case-insensitively, so a differently-cased
  // duplicate would be a second account nobody could tell apart.
  const existing = await users.findOne({
    username: { $regex: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  });

  if (existing) {
    console.error(`Error: a user with the username "${username}" already exists (${existing._id}).`);
    process.exit(1);
  }

  // login.js looks up by IMEI, then Boat, then username. A name shared with a
  // vessel is not fatal — each lookup also matches on the password — but it is
  // confusing enough to be worth refusing.
  const vessel = await users.findOne({
    Boat: { $regex: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  });

  if (vessel) {
    console.error(`Error: "${username}" is already the name of a vessel (${vessel._id}). Pick another.`);
    process.exit(1);
  }

  const password = await promptHidden(`Password for ${username}: `);
  if (!password) {
    console.error('Error: the password cannot be empty.');
    process.exit(1);
  }

  const again = await promptHidden('Repeat the password: ');
  if (password !== again) {
    console.error('Error: the passwords do not match.');
    process.exit(1);
  }

  console.log(`\nAbout to create administrator "${username}" in database "${DATABASE_NAME}".`);
  const confirmation = await prompt('Type the database name to confirm: ');
  if (confirmation.trim() !== DATABASE_NAME) {
    console.error('Aborted: nothing was written.');
    process.exit(1);
  }

  const result = await users.insertOne({
    username,
    password,
    role: 'admin',
    createdAt: new Date().toISOString()
  });

  console.log(`\nCreated administrator "${username}" (${result.insertedId}).`);
  console.log(`They sign in with that username and the password you just set.`);
}

async function main() {
  const [arg] = process.argv.slice(2);

  if (!arg || arg === '--help' || arg === '-h') {
    console.log('Usage: node scripts/createAdminAccount.js <username>');
    console.log('       node scripts/createAdminAccount.js --list');
    process.exit(arg ? 0 : 1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const users = client.db(DATABASE_NAME).collection('users');
    console.log(`Connected to "${DATABASE_NAME}".\n`);

    if (arg === '--list') {
      await listAdmins(users);
    } else {
      await createAdmin(users, arg.trim());
    }
  } catch (error) {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
