import { ObjectId } from 'mongodb';
import { isValidObjectId, validateString } from './validation.js';
import { ValidationError } from './errorHandler.js';

/**
 * Which records belong to a fisher.
 *
 * Fishers are identified three different ways depending on how they joined:
 * a device-tracked fisher by IMEI, a self-registered one by username, and
 * some older documents by boat name. A userId compounds it further, because
 * it is stored as an ObjectId when it parses as one and as a plain string
 * otherwise (the 'admin' account, and any record written while a user lookup
 * was failing).
 *
 * Keying on IMEI alone is not an option: registration sets IMEI to null, so
 * self-registered fishers have none. See docs/adr/0001.
 *
 * Every caller that needs "this fisher's records" resolves it here, so the
 * rules are stated once and can be tested without an HTTP request.
 */

const IDENTIFIER_RULES = { minLength: 1, maxLength: 100, required: true };

/**
 * Validate and sanitise whichever identifiers a request supplied, dropping
 * the ones it did not. Applied before resolveOwnerCriteria so that an
 * identifier reaching a query has been through the same checks whichever
 * field it arrived in.
 *
 * @param {{imei?: string, userId?: string, username?: string}} query
 * @returns {{imei?: string, userId?: string, username?: string}}
 */
export function sanitizeIdentifiers({ imei, userId, username }) {
  const identifiers = {};

  if (imei) identifiers.imei = validateString(imei, IDENTIFIER_RULES);
  if (userId) identifiers.userId = validateString(userId, IDENTIFIER_RULES);
  if (username) identifiers.username = validateString(username, IDENTIFIER_RULES);

  return identifiers;
}

/**
 * Resolve explicit identifiers into the criteria selecting that fisher's
 * records. IMEI wins when present, then userId, then username.
 *
 * @param {{imei?: string, userId?: string, username?: string}} identifiers
 * @param {import('mongodb').Collection} usersCollection - used to resolve a
 *   userId to its IMEI, which is the more reliable key when the user has one
 * @returns {Promise<Object>} MongoDB criteria
 * @throws {ValidationError} when no identifier is supplied
 */
export async function resolveOwnerCriteria({ imei, userId, username }, usersCollection) {
  if (imei) {
    return { imei };
  }

  if (userId) {
    const user = await findUserById(userId, usersCollection);

    // Prefer the IMEI: records are keyed on it wherever the fisher has one.
    if (user?.IMEI) {
      return { imei: user.IMEI };
    }

    // Both storage forms are live in the collection, so match either. Querying
    // only the parsed form silently hides records written as strings.
    if (isValidObjectId(userId)) {
      return { $or: [{ userId: new ObjectId(userId) }, { userId }] };
    }

    return { userId };
  }

  if (username) {
    return { username };
  }

  throw new ValidationError('userId, username, or imei is required');
}

/**
 * Criteria for a single identifier whose kind is not known — a route
 * parameter that may be an IMEI, a username or a boat name.
 *
 * Resolves in one query rather than probing each field in turn.
 *
 * @param {string} identifier
 * @returns {Object} MongoDB criteria
 * @throws {ValidationError} when the identifier is missing
 */
export function resolveIdentifierCriteria(identifier) {
  if (!identifier) {
    throw new ValidationError('User identifier (IMEI or username) is required');
  }

  return {
    $or: [{ imei: identifier }, { username: identifier }, { boatName: identifier }],
  };
}

/**
 * Look a user up by _id, which may be an ObjectId or a plain string such as
 * 'admin'. Returns null rather than throwing: a userId that matches no user
 * is a normal case, and the caller falls back to querying by userId directly.
 */
async function findUserById(userId, usersCollection) {
  try {
    const id = isValidObjectId(userId) ? new ObjectId(userId) : userId;
    return await usersCollection.findOne({ _id: id });
  } catch {
    return null;
  }
}
