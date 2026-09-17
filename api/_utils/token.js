import { SignJWT, jwtVerify } from 'jose';

/**
 * Session tokens: minting them, and reading them back.
 *
 * A token is this API's own proof of who is calling. It is signed with a
 * secret only the server holds, so a caller can carry an identity but cannot
 * invent one — which is the whole point, because today every endpoint takes
 * the caller's word for who they are (docs/API-AUTH-PLAN.md).
 *
 * It says as little as possible: who, and what they are. Anything else about
 * the fisher is read from the database at the time it is needed, so a token
 * issued a month ago cannot assert yesterday's answer to today's question.
 *
 * The payload is signed, not encrypted — anyone holding a token can read it.
 * Never put anything in here that the holder should not see.
 */

const ALGORITHM = 'HS256';

/**
 * Thirty days. The session already sits in localStorage indefinitely, so
 * anything shorter would be a new and visible annoyance for fishers working
 * offshore on a poor connection.
 */
export const TOKEN_LIFETIME = '30d';

let warnedAboutMissingSecret = false;

/**
 * The signing secret, or null when it is not configured.
 *
 * Read per call rather than at module load: these run as serverless functions
 * whose environment is not settled when the module is first imported, and the
 * tests set it between cases.
 */
function getSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET;

  if (!secret) {
    if (!warnedAboutMissingSecret) {
      warnedAboutMissingSecret = true;
      console.warn(
        '[auth] AUTH_TOKEN_SECRET is not set: no session tokens will be issued ' +
        'or accepted. Requests still succeed, unauthenticated, as they did before.'
      );
    }
    return null;
  }

  return new TextEncoder().encode(secret);
}

/**
 * Mint a token for a signed-in user.
 *
 * @param {{id: string, role?: string}} user as `api/auth/login.js` returns it
 * @returns {Promise<string|null>} null when no secret is configured
 */
export async function issueToken(user) {
  const secret = getSecret();
  if (!secret) return null;

  return new SignJWT({ role: user.role || 'user' })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(secret);
}

/**
 * Read a token back, or null if it does not verify.
 *
 * Null covers every way a token can fail — wrong signature, expired, garbled,
 * an algorithm we do not sign with — deliberately, because the caller has the
 * same answer for all of them and distinguishing them in a log tells an
 * attacker which part of their forgery to fix.
 *
 * @param {string} token
 * @returns {Promise<{id: string, role: string}|null>}
 */
export async function readToken(token) {
  const secret = getSecret();
  if (!secret || !token) return null;

  try {
    const { payload } = await jwtVerify(token, secret, {
      // Pinned: without this, a token could name its own algorithm and a
      // forged one could talk us into verifying it differently.
      algorithms: [ALGORITHM]
    });

    if (!payload.sub) return null;

    return { id: payload.sub, role: payload.role || 'user' };
  } catch {
    return null;
  }
}

/**
 * Pull the token out of a request's Authorization header.
 *
 * @param {{headers?: object}} req
 * @returns {string|null}
 */
export function tokenFromRequest(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof header !== 'string') return null;

  const [scheme, value] = header.split(' ');
  if (!value || scheme.toLowerCase() !== 'bearer') return null;

  return value.trim() || null;
}
