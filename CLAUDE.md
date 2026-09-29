# tracks-explorer

Fisher-facing tracks app (PESKAS|tracks). Fishers see where their vessels went, report catches, save waypoints and compare their results against their community. It is a React + Vite + TypeScript frontend, with Vercel functions in `api/` and a Capacitor wrapper for Android and iOS (`android/`, `ios/`, `capacitor.config.ts`, `webDir: dist`).
Ecosystem context (other repos, data flow, cross-repo contracts): loaded by the `peskas` Claude Code plugin (repo `peskas-context`).

## Commands

- `npm run dev:all` (alias `npm run start`) serves the frontend and the `api/` functions on one origin through `vercel dev`. `npm run dev` runs Vite only, so `/api/...` does not resolve there. The first run needs a one-time `npx vercel login && npx vercel link`. There is no separate backend process: local development runs the same functions production runs.
- `dev:all` pins port 5173 on purpose. The Mapbox token is URL-restricted to the Vite default port and the production domain, so on any other port the base map returns 403.
- `npm run build` (runs `tsc -b` then `vite build`), `npm run lint`, `npm run test` (Vitest, which includes the `api/*.test.js` roundtrips), `npm run preview`.
- `npm run db:check` checks MongoDB connectivity and collection counts. `npm run db:explore-fishers` reports the shape of the fisher stats collections.

### Choosing the database
`MONGODB_DATABASE` selects the database for everything and defaults to `portal-prod`. Set it to `portal-dev` in `.env` to work against the populated dev copy instead of writing real records. `appName` in the connection string is only a label in MongoDB's logs. A string reading `pds-dev` there does not mean you are on the dev database.

`portal-dev` has its own accounts, so an administrator created in one database does not exist in the other: `MONGODB_DATABASE=portal-dev npm run admin:create -- <username>`.

### Demo mode
`npm run demo:snapshot -- --imei <imei> --from YYYY-MM-DD --to YYYY-MM-DD` rebuilds the demo's tracks.

The demo signs in as nobody (`DEMO_USER` in `api/auth/demo-login.js`) and replays `public/demo/snapshot.json`. The snapshot holds real tracks, frozen once, with IMEI, names, community and trip ids stripped. They are shifted forward so the last trip always ended within the past day. The demo never calls Pelagic and must not: its placeholder IMEI is not a real one, and Pelagic answers an `imeis` filter that is not a real IMEI with the whole fleet. Run `npm run test` after rebuilding, because a test fails if the file holds any text beyond what the demo needs. See `docs/adr/0002-the-demo-replays-a-frozen-snapshot.md`.

### Administrators
`npm run admin:create -- <username>` creates an administrator, and `-- --list` lists them. An administrator is a `users` document with `role: 'admin'` and no IMEI or Boat: a person, not a vessel. `api/auth/login.js` reads that field, and `api/users.js` keeps such accounts out of the vessel picker. The script prompts for the password without echoing it and asks you to confirm the database name, because the usual connection string points at production.

Administrators have no tracking device of their own. Call `hasTrackingDevice()` in `src/utils/userInfo.ts` rather than reading `hasImei` directly, since for an administrator the answer is about the vessel they selected.

## Architecture

- `api/` holds the whole backend. Read the directory for the routes, and `api/_utils/` for the shared Mongo connection, tokens, rate limiting, validation and fisher identity resolution (`fisherIdentity.js`).
- The frontend calls Pelagic Analytics directly for trips, points and live locations (`src/api/pelagicDataService.ts`). `api/fallback/points.js` serves a parquet copy of the tracks from GCS when Pelagic is unavailable.
- MongoDB collections, in `portal-prod` / `portal-dev`:
  - read and written by the app: `users`, `catch-events`, `waypoints`, `feedback`.
  - read only: `fishers-stats` and `fishers-performance`, written by `peskas.coasts::export_fishers_stats()`. A change to their shape there needs a matching change here.
- Env vars: see `.env.example`. Key facts:
  - Server functions read `MONGODB_URI`, `MONGODB_DATABASE`, `AUTH_TOKEN_SECRET` (session tokens), `GLOBAL_PASSW`, `ALLOWED_ORIGINS`, and for the parquet fallback `GCP_SA_KEY` with `FALLBACK_PARQUET_BUCKET`/`_OBJECT` or `FALLBACK_PARQUET_URL`.
  - The client reads `VITE_MAPBOX_TOKEN`, `VITE_API_TOKEN`/`VITE_API_SECRET` (Pelagic historical data), `VITE_PELAGIC_*` (live locations) and `VITE_SENTRY_DSN`. The Sentry build plugin needs `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`.
  - Anything prefixed `VITE_` is compiled into the public bundle.
- i18n uses react-i18next with `src/i18n/locales/{en,sw,pt}.json`.
- Domain vocabulary is defined in `CONTEXT.md` (fisher, vessel, fisher identity, trip, ...). `docs/` is gitignored and exists only on machines that have a local copy. Decisions are recorded in `docs/adr/`. Pelagic API notes are in `docs/pelagic_api_documentation.md`, deployment notes in `docs/VERCEL_DEPLOYMENT.md`.
- Catch, waypoint and admin rules: `.claude/rules/business-rules.md`.

## Rules

- Style with Tabler components and classes, and avoid custom element styling unless nothing in Tabler fits.
- Use the terms in `CONTEXT.md` in code, UI copy and docs.
- Add every new UI string to all three locale files.
- Read `docs/API-AUTH-PLAN.md` before touching auth, admin identity, or any handler that takes a `userId`.

## Gotchas

- The API does not yet enforce who is calling. `identifyCaller()` (`api/_utils/requireFisher.js`) only logs whether a token was present, and handlers still trust caller-supplied identifiers. See `docs/API-AUTH-PLAN.md`.
- `GLOBAL_PASSW` signs in as any user by IMEI, boat name or username, and `api/auth/login.js` returns `role: 'admin'` for that session. Set it only in the Vercel Development environment. Real administrators use their own `role: 'admin'` accounts. It has no `VITE_` copy because the value would ship in the client bundle.
