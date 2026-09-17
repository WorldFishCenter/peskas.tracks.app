import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { issueToken } from './token.js';

/**
 * Exercising the serverless functions in tests.
 *
 * The handlers are Vercel functions: they take (req, res) and read
 * MONGODB_URI at module load. This gives them a real MongoDB to talk to and a
 * request/response pair to answer, so a test can drive an endpoint the way a
 * browser would — through its validation, its query and its JSON — rather than
 * calling the pieces underneath it and hoping the endpoint wires them up the
 * same way.
 *
 * The database is a throwaway in-memory server, so tests never touch
 * portal-prod or portal-dev.
 */

let mongo;
let client;

/**
 * Start an in-memory MongoDB and point the handlers at it. Must run before any
 * handler module is imported, because they capture MONGODB_URI at module load
 * — so import handlers with `await import(...)` inside the test, not at the
 * top of the file.
 */
export async function startTestDatabase() {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DATABASE = 'portal-prod';

  // The endpoints require a signed token since step 4, so a test that does not
  // sign in gets a 401 rather than the behaviour it meant to exercise.
  process.env.AUTH_TOKEN_SECRET ||= 'test-signing-secret';

  client = new MongoClient(mongo.getUri());
  await client.connect();

  // The name the handlers open; in memory it is simply a fresh database.
  return client.db('portal-prod');
}

export async function stopTestDatabase() {
  await client?.close();
  await mongo?.stop();
}

/**
 * A request/response pair that records what the handler answered.
 *
 * @param {{method?: string, body?: object, query?: object, headers?: object}} options
 * @returns {{req: object, res: object, result: {status: number|null, body: any}}}
 */
export function mockRequest({ method = 'GET', body = {}, query = {}, headers = {} } = {}) {
  const result = { status: null, body: null, headers: {} };

  const res = {
    status(code) {
      result.status = code;
      return res;
    },
    json(payload) {
      // A handler that answers before calling status() has answered 200.
      result.status ??= 200;
      result.body = payload;
      return res;
    },
    setHeader(name, value) {
      result.headers[name] = value;
      return res;
    },
    end() {
      result.status ??= 200;
      return res;
    },
  };

  return { req: { method, body, query, headers }, res, result };
}

/**
 * Call a handler and return what it answered.
 *
 * @param {Function} handler - the default export of an api/ module
 * @param {object} options - passed to mockRequest
 */
export async function callHandler(handler, options) {
  const { req, res, result } = mockRequest(options);
  await handler(req, res);
  return result;
}

/**
 * The Authorization header a signed-in caller would send.
 *
 * Pass it as `headers` to callHandler. Tests that leave it out are testing
 * what an anonymous caller gets, which since step 4 is a 401 — so leave it out
 * deliberately, not by accident.
 *
 * @param {string|object} id the fisher's _id
 * @param {'user'|'admin'} role
 */
export async function signedInAs(id, role = 'user') {
  return { authorization: `Bearer ${await issueToken({ id: String(id), role })}` };
}
