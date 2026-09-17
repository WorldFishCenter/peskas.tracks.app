import { readToken, tokenFromRequest } from './token.js';

/**
 * Who is calling?
 *
 * Despite the name this does not yet require anything — that is step 4 of
 * docs/API-AUTH-PLAN.md, and the name is here so the change that starts
 * rejecting callers is a change to this file rather than a new concept
 * scattered across thirteen handlers.
 *
 * For now it answers the question and keeps score. Every call records whether
 * the caller carried a token, so the logs say how much traffic is still
 * unauthenticated. When that reaches zero, enforcement costs nobody their
 * access, and until it does, turning it on would lock somebody out.
 *
 * Nothing here rejects a request. Handlers keep working exactly as before for
 * callers with no token.
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
