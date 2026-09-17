import { ObjectId } from 'mongodb';
import { isValidObjectId } from './validation.js';
import { readToken, tokenFromRequest } from './token.js';

/**
 * Who is calling?
 *
 * `identifyCaller` answers and keeps score; `requireFisher` answers or turns
 * the caller away. Handlers use the second, so the identity they act on is
 * the one the token proves rather than the one the request claims.
 *
 * This is where the hole in docs/API-AUTH-PLAN.md actually closes. Not
 * because the ownership checks improved — they were always sound — but
 * because there is no longer a caller-supplied id for them to be pointed at.
 */

/**
 * @param {{headers?: object, url?: string, method?: string}} req
 * @returns {Promise<{id: string, role: string}|null>} the caller, or null when
 *   they did not prove who they are
 */
export async function identifyCaller(req) {
  const token = tokenFromRequest(req);
  const where = `${req?.method || '?'} ${routeOf(req)}`;

  if (!token) {
    console.log(`[auth] no token: ${where}`);
    return null;
  }

  const caller = await readToken(token);

  if (!caller) {
    // A token that does not verify is worth separating from no token at all:
    // the first is a client bug or an expired session, the second is a caller
    // that has not been updated yet. Only the second blocks step 4.
    console.log(`[auth] token present but not valid: ${where}`);
    return null;
  }

  console.log(`[auth] token ok: ${where} (${caller.role})`);
  return caller;
}

/**
 * The path, without the query string — which is where the caller-supplied
 * identities live, and logging those alongside a note about who failed to
 * authenticate would write the very data this work exists to protect into a
 * log file.
 */
function routeOf(req) {
  const url = req?.url || '';
  const [path] = url.split('?');
  return path || '(unknown)';
}

/**
 * The caller, or null once a 401 has been sent.
 *
 * Handlers must stop when this returns null: the response is already written.
 *
 *   const caller = await requireFisher(req, res);
 *   if (!caller) return;
 *
 * @param {object} req
 * @param {object} res
 * @returns {Promise<{id: string, role: string}|null>}
 */
export async function requireFisher(req, res) {
  const caller = await identifyCaller(req);

  if (!caller) {
    // One message for every way of failing to prove who you are. Saying which
    // part was wrong tells whoever is guessing what to try next.
    res.status(401).json({ error: 'Sign in to continue' });
    return null;
  }

  return caller;
}

/**
 * True when this caller may act for somebody other than themselves.
 *
 * Administrators work on a vessel they have selected, so they legitimately
 * name identities that are not their own. Everybody else gets exactly one.
 *
 * @param {{id: string, role: string}} caller
 * @param {string} identity the id, IMEI or username being named
 * @param {string[]} ownIdentities what this caller may name for themselves
 */
export function mayActFor(caller, identity, ownIdentities = []) {
  if (caller.role === 'admin') return true;
  return ownIdentities.filter(Boolean).map(String).includes(String(identity));
}

/**
 * The account behind a token, and the names it answers to.
 *
 * A token carries an id and nothing else, deliberately — but a fisher is also
 * known by IMEI, username and boat name, and the records they own are stored
 * under whichever of those applied when they were written. This resolves the
 * one into the others, from the database, at the time of asking.
 *
 * @returns {Promise<{user: object|null, identities: string[]}>}
 */
export async function callerAccount(caller, usersCollection) {
  if (!isValidObjectId(caller.id)) {
    // An administrator from before accounts existed, or a token predating a
    // change of id format. They own nothing addressable either way.
    return { user: null, identities: [caller.id] };
  }

  const user = await usersCollection.findOne({ _id: new ObjectId(caller.id) });
  if (!user) return { user: null, identities: [caller.id] };

  return {
    user,
    identities: [caller.id, user.IMEI, user.username, user.Boat].filter(Boolean).map(String)
  };
}
