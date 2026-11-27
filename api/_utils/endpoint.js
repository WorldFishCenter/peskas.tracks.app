import { corsMiddleware } from './cors.js';
import { getDatabase } from './mongodb.js';
import { identifyCaller } from './requireFisher.js';
import { rateLimitMiddleware } from './rateLimit.js';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError
} from './errorHandler.js';

export { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError };

/**
 * Error carrying an explicit HTTP status code for domain failures that do not
 * map to Validation/NotFound/Unauthorized/Forbidden (for example 409 Conflict
 * or 503 Service Unavailable).
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/**
 * Resolve rate-limit config for the current HTTP method. Accepts either a
 * single preset object or a per-method map such as { GET: READ, POST: WRITE }.
 */
function resolveRateLimitConfig(rateLimit, method) {
  if (!rateLimit) return null;
  if (typeof rateLimit.maxRequests === 'number') return rateLimit;
  return rateLimit[method] || null;
}

/**
 * Map a thrown error onto an HTTP status and client-safe message.
 * Internal errors are logged server-side and never leak raw messages to callers.
 */
function mapError(error) {
  if (error instanceof HttpError) {
    return { status: error.status, message: error.message };
  }
  if (error instanceof ValidationError || error?.name === 'ValidationError') {
    return { status: 400, message: error.message };
  }
  if (error instanceof UnauthorizedError || error?.name === 'UnauthorizedError') {
    return { status: 401, message: error.message };
  }
  if (error instanceof ForbiddenError || error?.name === 'ForbiddenError') {
    return { status: 403, message: error.message };
  }
  if (error instanceof NotFoundError || error?.name === 'NotFoundError') {
    return { status: 404, message: error.message };
  }
  if (error?.name === 'MongoServerError' && error?.code === 11000) {
    return { status: 409, message: 'Duplicate entry' };
  }
  return { status: 500, message: 'Internal server error' };
}

/**
 * Build a Vercel serverless handler with uniform CORS, method gating,
 * Step 3 caller verification, optional rate limiting, database injection,
 * and sanitized error handling.
 *
 * Cross-cutting policy changes — including flipping Step 4 authentication
 * enforcement in docs/API-AUTH-PLAN.md — happen once here instead of across
 * sixteen handlers.
 *
 * @param {object} options
 * @param {string[]} options.methods - Allowed HTTP methods (OPTIONS is handled automatically)
 * @param {'fisher'|'public'} [options.auth='fisher'] - 'public' skips caller verification
 * @param {boolean} [options.db=true] - Attach MongoDB handle via getDatabase()
 * @param {object} [options.rateLimit] - Single RateLimitPreset or per-method map
 * @param {(req: any, res: any, ctx: { db: any, caller: any }) => Promise<any>} handler
 */
export function createEndpoint(options, handler) {
  const {
    methods,
    auth = 'fisher',
    db: needsDb = true,
    rateLimit = null
  } = options;

  return async function endpoint(req, res) {
    if (corsMiddleware(req, res)) {
      return;
    }

    if (methods && !methods.includes(req.method)) {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    let caller = null;
    if (auth !== 'public') {
      // Step 3 of docs/API-AUTH-PLAN.md: identify and log caller without rejecting.
      caller = await identifyCaller(req);
    }

    const rateConfig = resolveRateLimitConfig(rateLimit, req.method);
    if (rateConfig) {
      const limit = rateLimitMiddleware(rateConfig)(req, res);
      if (limit.rateLimited) {
        return res.status(limit.response.status).json(limit.response.body);
      }
    }

    try {
      const db = needsDb ? await getDatabase() : null;
      return await handler(req, res, { db, caller });
    } catch (error) {
      const { status, message } = mapError(error);
      if (status >= 500) {
        console.error(`[endpoint] ${req.method} ${req.url || ''}:`, error);
      }
      if (res.headersSent) {
        res.end();
        return;
      }
      return res.status(status).json({ error: message });
    }
  };
}
