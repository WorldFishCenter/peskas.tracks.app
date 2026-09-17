/**
 * The one place `src/api/` reaches the network.
 *
 * Every service module calls through here instead of calling `fetch` itself,
 * so anything that must apply to every request — a session token header, a
 * retry, a log line — has one edit site rather than twenty-one. This is the
 * plumbing step 1 of docs/API-AUTH-PLAN.md asks for; step 3 attaches the token.
 *
 * Two doors, and the difference is the point:
 *
 *   apiFetch(path, …)      our own serverless functions under `/api`, same origin
 *   externalFetch(url, …)  a third party — today the Pelagic Analytics API
 *
 * Anything identifying this app's user belongs on the first and never on the
 * second: a session token sent to another host is a credential handed to a
 * stranger. They share the plumbing below, but only `apiFetch` will carry the
 * token.
 *
 * Both return the raw `Response`. Status handling stays with the callers, who
 * translate failures into their own user-facing, translated messages.
 */

/** Relative, so the dev server and production both resolve it to themselves. */
const API_BASE = '/api';

/** Where AuthContext leaves the session token for us. */
const TOKEN_KEY = 'authToken';

/**
 * Read the session token, if there is one.
 *
 * localStorage throws rather than returning null in a private window with site
 * data blocked, and a sign-in page that cannot render is worse than a request
 * that goes out unauthenticated, so this never throws.
 */
function sessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export type QueryParams = Record<string, QueryValue>;

export interface RequestOptions {
  method?: string;
  /** Appended as a query string. `null` and `undefined` entries are dropped. */
  query?: QueryParams;
  /** Serialised as JSON unless it is already a string. */
  body?: unknown;
  headers?: Record<string, string>;
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
  /** A caller's own abort signal; combined with `timeoutMs` when both are given. */
  signal?: AbortSignal;
}

/**
 * Call one of our own endpoints. `path` is relative to `/api` and starts with
 * a slash, e.g. `/waypoints`.
 */
export function apiFetch(path: string, options: RequestOptions = {}): Promise<Response> {
  const token = sessionToken();

  return request(`${API_BASE}${path}`, {
    ...options,
    headers: token
      // Spread second so a caller that sets its own Authorization keeps it.
      ? { Authorization: `Bearer ${token}`, ...options.headers }
      : options.headers
  });
}

/**
 * Call a third-party API by absolute URL. Deliberately separate from
 * `apiFetch`: nothing that identifies our user may travel this way.
 */
export function externalFetch(url: string, options: RequestOptions = {}): Promise<Response> {
  return request(url, options);
}

function request(url: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', query, body, headers, timeoutMs, signal } = options;

  const init: RequestInit = {
    method,
    headers: { ...headers }
  };

  if (body !== undefined) {
    if (typeof body === 'string') {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      // Spread second so an explicit caller header still wins.
      init.headers = { 'Content-Type': 'application/json', ...headers };
    }
  }

  const abort = abortSignal(timeoutMs, signal);
  if (abort) {
    init.signal = abort;
  }

  return fetch(withQuery(url, query), init);
}

function withQuery(url: string, query?: QueryParams): string {
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }

  const queryString = params.toString();
  if (!queryString) return url;

  return `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
}

function abortSignal(timeoutMs?: number, signal?: AbortSignal): AbortSignal | undefined {
  if (timeoutMs === undefined) return signal;
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
