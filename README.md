# PESKAS Tracks Explorer

A web application for viewing and analyzing vessel tracking data.

## Version 2.9.0 - Latest Updates

### New Features
- **Administrator Accounts**: Administrators sign in with their own account rather than a shared global password, created with `npm run admin:create`
- **Session Tokens**: Signing in issues a signed token sent with every API request, so the server knows who is calling

### Improvements
- **One API Client**: All frontend requests go through a single module; third-party calls stay separate so credentials never leave our own origin
- **Database Selection**: `MONGODB_DATABASE` chooses the database for every endpoint, so development can run against `portal-dev`
- **Dev Server Fixes**: Hot reload works behind `vercel dev`; a stale service worker no longer takes over the development page

## Features

- View vessel tracks on an interactive map
- Filter trips by date and vessel
- Analyze vessel speed with color-coded tracks
- **Save private waypoints** for ports, fishing grounds, and favorite spots
- Report catches with photos and GPS data
- View performance statistics and compare with community
- User registration and profile management
- Support for both PDS (tracking device) and non-PDS users
- Device GPS location support
- Bathymetry layer showing ocean depth contours
- MongoDB-based authentication system using IMEI, boat name, or username
- Multi-language support (English, Portuguese, Swahili)

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Make sure you have a valid `.env` file with the required environment variables:
   ```
   VITE_MAPBOX_TOKEN=your_mapbox_token
   MONGODB_URI=your_mongodb_connection_string
   ```

   `vercel dev` reads this file, so the same values serve the frontend and
   the API functions.

### Running the Application

#### Development Mode

Local development runs the same serverless functions that production runs,
rather than a separate Express implementation of them. That requires the
project to be linked once:

```bash
npx vercel login
npx vercel link
```

Then, to run the frontend and the API together:

```bash
npm run dev:all
```

This serves the frontend and the functions in `api/` on a single origin, the
way they are served in production, so `/api/...` needs no proxy.

#### Frontend Only

For work that does not touch the API:

```bash
npm run dev
```

This runs Vite alone, so requests to `/api/...` will not resolve.

### Authentication

The application authenticates users against a MongoDB database. You can log in using:

- **Vessel IMEI**: The 15-digit IMEI number of a registered vessel
- **Password**: The corresponding password in the MongoDB database

## Deployment

### Vercel Deployment

This application is configured for easy deployment to Vercel. For detailed instructions, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md).

Quick steps:
1. Push your code to a Git repository
2. Import the project in Vercel Dashboard
3. Set the environment variables (`VITE_MONGODB_URI` and `VITE_MAPBOX_TOKEN`)
4. Deploy

The application uses:
- Vercel Serverless Functions for the backend API
- Vite build for the frontend
- Environment variables for configuration

## Documentation

- [Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md) - Instructions for deploying to Vercel
- [Production Readiness Report](./PRODUCTION_READINESS_REPORT.md) - Comprehensive production readiness audit

## Version History

### Version 2.8.0
- Waypoints on the map, with a `/api/waypoints` CRUD API and `useWaypoints` hook
- User feedback system for all user types, fully localised
- API hardening: shared CORS, rate limiting, validation, and error handling
- Sentry observability and build tooling

### Version 2.7.0 (December 2024)
- User registration and profile management system
- Non-PDS user support with GPS device location
- Enhanced map visibility (always visible, even without trips)
- Flexible authentication (IMEI, boat name, or username)
- User catch events API endpoints
- Improved map UI with cleaner controls
- Enhanced localization (English, Portuguese, Swahili)

### Previous Versions
See git commit history for earlier versions.
