# Peskas Tracks

An app for small-scale fishers to see where their vessel has been, record what they caught, and compare their results with their community.

[tracks.peskas.org](https://tracks.peskas.org)

## What it is

Peskas Tracks is for fishers in Kenya, Tanzania (including Zanzibar) and Mozambique. It runs in the web browser at tracks.peskas.org and as an Android and iOS app. It is available in English, Portuguese and Swahili.

Fishers sign in with their vessel's tracker number (IMEI), the vessel's name or their username, together with a password. Fishers whose vessel has no tracker can register themselves and use their phone's location instead. A demo mode with sample data lets anyone try the app without an account.

## What you can do

- See your trips on a map: where your vessel went, when, and how fast.
- See where your vessel is now, as last reported by its tracker.
- Report your catch after a trip, with photos, including trips where you caught nothing.
- Save private waypoints: ports, anchorages, fishing grounds and favourite spots.
- Compare your catch and fishing effort with the rest of your community.
- Send feedback to the Peskas team.

## Where the data comes from

- **GPS trackers (Pelagic Data Systems).** Small solar-powered devices on vessels record where they travel. The app reads trips and live locations directly from Pelagic Data Systems.
- **What fishers enter.** Catch reports, waypoints and feedback are stored in the Peskas database.
- **Community comparisons.** The [Peskas Coasts data pipeline](https://github.com/WorldFishCenter/peskas.coasts) recalculates each fisher's catch and effort, and their community's, once a day.

A community is the landing site a fisher works from. The demo shows real tracks recorded once, with names and identifiers removed.

## Who runs it

Peskas Tracks is developed by [WorldFish](https://worldfishcenter.org), with tracking data from [Pelagic Data Systems](https://www.pelagicdata.com). For questions, write to <peskas.platform@gmail.com>.

## Part of Peskas

Peskas is WorldFish's open-source platform for monitoring small-scale fisheries (https://peskas.org).

- [Peskas Zanzibar](https://zanzibar.peskas.org), [Peskas Kenya](https://peskas-dashboard-kenya.vercel.app/en), [Peskas Mozambique](https://peskas-dashboard-mozambique.vercel.app): country dashboards
- [Peskas Timor-Leste](https://timor.peskas.org): Timor-Leste portal
- [Peskas Coasts](https://coasts.peskas.org): regional comparison across countries
- [Peskas Kenya BMU dashboard](https://digitalfisheries.kenya.peskas.org): dashboard for Beach Management Units in Kenya
- [Peskas Management Platform](https://validation.peskas.org): data review and download for survey teams
- [Peskas Fishery Data API](https://api.peskas.org/docs): programmatic access to landing data
- Data pipelines: [Kenya](https://github.com/WorldFishCenter/peskas.kenya.data.pipeline), [Zanzibar](https://github.com/WorldFishCenter/peskas.zanzibar.data.pipeline), [Mozambique](https://github.com/WorldFishCenter/peskas.mozambique.data.pipeline), [Timor-Leste](https://github.com/WorldFishCenter/peskas.timor.data.pipeline), [Coasts](https://github.com/WorldFishCenter/peskas.coasts)

## For developers

A React + TypeScript app built with Vite. The backend is the set of Vercel functions in `api/`, which use MongoDB. Capacitor wraps the built app for Android and iOS (`android/`, `ios/`, `capacitor.config.ts`, app name `PESKAS|tracks`). Use the terms in [`CONTEXT.md`](CONTEXT.md) (fisher, vessel, trip, catch event, waypoint) in code, UI text and docs.

**Requirements:** Node.js 20 or later (CI uses 22) and a Vercel account with access to the project.

**Setup**

```bash
npm install
cp .env.example .env              # then fill in the values
npx vercel login && npx vercel link   # once
npm run dev:all                   # frontend and api/ functions at http://localhost:5173
```

`MONGODB_DATABASE` defaults to `portal-prod`, the production database. Set `MONGODB_DATABASE=portal-dev` in `.env` for local work so you do not write real records. `npm run dev` runs the frontend alone, without the `api/` functions. Keep port 5173: the Mapbox token only works there and on the production domain.

**Environment variables.** Anything prefixed `VITE_` is compiled into the public JavaScript bundle that every visitor downloads, so never give a database connection string or other server secret a `VITE_` name. Set these server-only variables in the Vercel project, without the prefix:

- `MONGODB_URI`: MongoDB connection string.
- `MONGODB_DATABASE`: `portal-prod` in production.
- `AUTH_TOKEN_SECRET`: signs session tokens.
- `ALLOWED_ORIGINS`: origins allowed to call the API.
- `GCP_SA_KEY` with `FALLBACK_PARQUET_BUCKET` and `FALLBACK_PARQUET_OBJECT`, or `FALLBACK_PARQUET_URL`: backup copy of the tracks, used when Pelagic Data Systems is unavailable.
- `GLOBAL_PASSW`: signs in as any fisher. Set it only in the Vercel Development environment.

The client reads `VITE_MAPBOX_TOKEN`, the Pelagic Data Systems settings (`VITE_API_TOKEN`, `VITE_API_SECRET`, `VITE_PELAGIC_*`) and `VITE_SENTRY_DSN`. `.env.example` lists them all.

**Main commands**

- `npm run dev:all` (or `npm run start`): frontend and API together.
- `npm run build`, `npm run lint`, `npm run preview`.
- `npm run test`: Vitest, including round-trip tests of the `api/` functions against an in-memory MongoDB.
- `npm run admin:create -- <username>`: create an administrator account (`-- --list` lists them). Administrators are people, not vessels, and can view any vessel. Accounts are per database, so add `MONGODB_DATABASE=portal-dev` in front to create one for development.
- `npm run demo:snapshot -- --imei <imei> --from YYYY-MM-DD --to YYYY-MM-DD`: rebuild the demo's sample tracks, then run `npm run test`.
- `npm run db:check`: check the MongoDB connection and collection counts.

Session tokens are issued at sign-in and sent with every API request, but the API does not verify them yet: handlers still trust the identifiers the caller sends.

**Production.** Vercel deploys `main` to production. `.github/workflows/ci.yaml` builds, tests and lints every pull request and push to `main`.

**Releases:** add a block at the top of [`NEWS.md`](NEWS.md). On every push to `main`, `.github/workflows/release.yaml` publishes it as a GitHub release.

**AI-assisted work:** see [`CLAUDE.md`](CLAUDE.md).
