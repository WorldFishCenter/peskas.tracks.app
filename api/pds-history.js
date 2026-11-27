import { createEndpoint, ValidationError, ForbiddenError, HttpError } from './_utils/endpoint.js';

const PDS_API = 'https://analytics.pelagicdata.com/api';
const DATE_RANGE = /^(trips|points)\/\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/;
const TRIP_POINTS = /^trips\/[A-Za-z0-9_-]+\/points$/;
const FORWARDED = ['imeis', 'deviceInfo', 'withLastSeen', 'errant', 'tags'];

/**
 * GET /api/pds-history?path=trips/<from>/<to>&imeis=<imei>,<imei>
 * GET /api/pds-history?path=points/<from>/<to>&imeis=…
 * GET /api/pds-history?path=trips/<tripId>/points
 *
 * Pelagic's historical trips and points as CSV, streamed as PDS sends them.
 * The PDS token and secret stay here; the browser never sees them.
 */
export default createEndpoint({ methods: ['GET'], db: false }, async (req, res, { caller }) => {
  const path = String(req.query.path ?? '');
  const isDateRange = DATE_RANGE.test(path);
  if (!isDateRange && !TRIP_POINTS.test(path)) {
    throw new ValidationError('Unknown path');
  }

  const imeis = req.query.imeis ? String(req.query.imeis) : '';
  if (imeis && !/^\d+(,\d+)*$/.test(imeis)) {
    throw new ValidationError('imeis must be IMEI numbers separated by commas');
  }

  // Without an IMEI filter PDS answers for the whole fleet.
  if (isDateRange && !imeis && caller?.role !== 'admin') {
    throw new ForbiddenError('Only an administrator can ask for the whole fleet');
  }

  const { PDS_TOKEN, PDS_SECRET } = process.env;
  if (!PDS_TOKEN || !PDS_SECRET) {
    console.error('[pds-history] PDS_TOKEN or PDS_SECRET is not set');
    throw new HttpError(503, 'Track data is unavailable');
  }

  const query = new URLSearchParams();
  for (const key of FORWARDED) {
    if (req.query[key]) {
      query.set(key, String(req.query[key]));
    }
  }

  try {
    const upstream = await fetch(`${PDS_API}/${PDS_TOKEN}/v1/${path}?${query}`, {
      headers: { 'X-API-SECRET': PDS_SECRET },
      signal: AbortSignal.timeout(30000)
    });

    // The app reads some PDS errors by their text, so pass it on, without our credentials.
    if (!upstream.ok) {
      const text = (await upstream.text()).replaceAll(PDS_TOKEN, '[token]').replaceAll(PDS_SECRET, '[secret]');
      console.error(`[pds-history] PDS answered ${upstream.status} for ${path}`);
      return res.status(upstream.status).json({ error: text });
    }

    // Streamed, because a buffered response over 4.5 MB is refused by Vercel.
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/csv');
    res.status(200);
    for await (const chunk of upstream.body) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    console.error('[pds-history] PDS request failed:', error.message);
    if (res.headersSent) {
      res.end();
    } else {
      throw new HttpError(502, 'Track data is unavailable');
    }
  }
});
