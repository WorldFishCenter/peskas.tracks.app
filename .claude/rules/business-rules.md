---
paths:
  - "api/**"
  - "src/api/**"
  - "src/components/catch-form/**"
  - "src/contexts/AuthContext.tsx"
---

# Business rules

These facts were checked against the code on 2026-09-24. Re-check them before relying on one in a change.

## Who signs in
- Login (`api/auth/login.js`) matches the identifier to `users.IMEI` exactly, and falls back to a case-insensitive match on `Boat`, then on `username`, with regex input escaped. Passwords are compared in plain text against `users.password`.
- Session role: `'admin'` for `role: 'admin'` accounts or a `GLOBAL_PASSW` login, `'user'` otherwise, and `'demo'` for the demo session.
- A self-registered fisher (`api/auth/register.js`) has a username and no IMEI, so there are no Pelagic trips for that fisher. Records are resolved through `api/_utils/fisherIdentity.js` (see ADR 0001: `userId` stays a fisher identifier).

## Catch reports
- `catch_outcome` is 1 for a catch and 0 for no catch. A catch needs `fishGroup` (one of `FishGroup` in `src/types/index.ts`: reef fish, sharks/rays, small pelagics, large pelagics, tuna/tuna-like) and `quantity` in kg. Photos and `gps_photo` are optional.
- Each catch entry is stored as its own `catch-events` document, one POST per entry. Since 2.12 the documents of one catch report share a `reportId` and each carries its entry's `entryId` (`null` for no catch); older documents have neither. The API stores a repeated `reportId` + `entryId` once, so a retried upload does not duplicate. A trip can still be reported more than once in separate reports, and nothing merges them.
- The form allows at most 3 photos per entry and rejects files over 10 MB before compression. Photos are stored base64 inside the document.
- Admin submissions (`isAdmin: true` in the body) are stored with `imei`, `username`, `boatName` and `community` set to `'admin'`, plus `isAdminSubmission: true`. Exclude them from anything fisher-facing.
- Demo sessions never write: the services return mock results before any request goes out.
- Trip ids starting with `standalone_` mean the catch was reported without a Pelagic trip.
- `fuel_liters` (since 2.12) is optional and belongs to the trip, not the fish group: every document of one catch report carries the same value. Take it once per `reportId`, never sum it across fish groups. When a trip has several reports, nothing says which fuel is right; the latest report with a value is the safer pick.

## Waypoints
- Types are listed in `WaypointType` (`src/types/index.ts`). Every waypoint is private (`isPrivate: true`) and is returned only to its owner, resolved through `fisherIdentity.js`.

## Rate limits
- The presets in `api/_utils/rateLimit.js` are AUTH 5 per 15 min, WRITE 30 per min and READ 100 per min. The counters live in memory, so each function instance keeps its own.
