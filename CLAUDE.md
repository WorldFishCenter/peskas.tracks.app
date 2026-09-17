# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev:all` - Frontend + API functions on one origin via `vercel dev` (recommended)
- `npm run dev` - Frontend only (Vite); `/api/...` will not resolve
- `npm run start` - Alias for dev:all

Requires a one-time `npx vercel login && npx vercel link`. There is no separate
backend process: local development runs the same functions in `api/` that
production runs.

`dev:all` pins port 5173. That is load-bearing, not cosmetic: the Mapbox token
is URL-restricted and its allow-list covers the Vite default port and the
production domain only, so the base map returns 403 on any other port.

### Build & Deploy
- `npm run build` - Build production version (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint on codebase
- `npm run test` - Run the Vitest suite

### Diagnostics
- `npm run db:check` - Verify MongoDB connectivity and report collection counts
- `npm run db:explore-fishers` - Report the shape of the fisher stats collections

### Choosing the database
`MONGODB_DATABASE` selects which database everything talks to, defaulting to
`portal-prod` when unset. Set it to `portal-dev` in `.env` to develop against
the populated dev copy instead of writing real records while testing.

Note that `appName` in the connection string selects nothing — it is only a
label MongoDB shows in its own logs, and a string reading `pds-dev` there does
not mean you are on the dev database.

`portal-dev` is a separate database with its own accounts, so administrators
created in one do not exist in the other. Create them where you need them:
`MONGODB_DATABASE=portal-dev npm run admin:create -- <username>`.

### Demo mode
- `npm run demo:snapshot -- --imei <imei> --from YYYY-MM-DD --to YYYY-MM-DD` - Rebuild the demo's tracks

The demo signs in as nobody and replays `public/demo/snapshot.json`: real
tracks frozen once, with the IMEI, names, community and trip ids stripped, and
shifted forward so the last trip always ended within the past day. It never
calls Pelagic, and it must not — its placeholder IMEI is not a real one, and
Pelagic answers an `imeis` filter that is not a real IMEI with the whole fleet. Run
`npm run test` after rebuilding; a test fails if the file holds any text beyond
what the demo needs. See [ADR 0002](docs/adr/0002-the-demo-replays-a-frozen-snapshot.md).

### Administrators
- `npm run admin:create -- <username>` - Create an administrator account
- `npm run admin:create -- --list` - List the administrators that exist

An administrator is a `users` document with `role: 'admin'` and no IMEI or
Boat: a person, not a vessel. `api/auth/login.js` reads that field, and
`api/users.js` keeps such accounts out of the vessel picker. The script prompts
for the password without echoing it and makes you confirm the database name
before writing, because the usual connection string points at production.

Administrators have no tracking device of their own, so ask
`hasTrackingDevice()` in `src/utils/userInfo.ts` rather than reading `hasImei`
directly — for an administrator the answer is about the vessel they selected.

## Architecture

### Full-Stack Structure
This is a full-stack application with:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Vercel serverless functions (`api/`) with MongoDB authentication
- **UI Framework**: Tabler CSS with Bootstrap components
- **Maps**: Mapbox GL + Deck.gl for vessel tracking visualization
- **PWA**: Progressive Web App with service worker support

### Key Architectural Patterns

#### Authentication Flow
- IMEI-based authentication against MongoDB users collection
- Global admin password support via environment variables
- Context-based authentication state management ([src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx))
- Protected routes with automatic redirects
- User data stored in localStorage for persistence
- Demo mode support with special credentials

#### Component Organization
- **Pages**: Main application screens ([Dashboard](src/pages/Dashboard.tsx), [Login](src/pages/Login.tsx))
- **Layouts**: [MainLayout](src/layouts/MainLayout.tsx) for consistent app structure
- **Components**: Reusable UI components organized by feature
  - `dashboard/`: Dashboard-specific components
  - `map/`: Map-related components (controls, layers, tooltip)
  - `catch-form/`: Catch reporting form components
- **Hooks**: Custom React hooks for shared logic (useTripData, useLiveLocations, useVesselSelection, useLanguage)
- **Contexts**: React contexts for global state management

#### Data Layer
- **Pelagic Data Service**: Main data source for vessel tracking ([src/api/pelagicDataService.ts](src/api/pelagicDataService.ts))
  - Implements request caching (5-minute cache duration)
  - Fetches trip data, trip points, live locations from Pelagic Analytics API
  - Requires VITE_PELAGIC_* environment variables for API access
- **Auth Service**: Handles login requests ([src/api/authService.ts](src/api/authService.ts))
- **Catch Events Service**: Manages catch reporting ([src/api/catchEventsService.ts](src/api/catchEventsService.ts))

#### Map & Visualization
- Deck.gl layers for vessel track visualization with speed-based coloring
- Mapbox GL for base map rendering
- Responsive design with mobile-optimized tooltips
- Real-time location tracking capabilities
- Map controls for layer management and styling
- Offline tile caching via service worker

#### Catch Reporting System
- Multi-step catch reporting workflow (trip selection, catch details, photo upload)
- Supports both "catch" and "no catch" outcomes
- Photo upload with GPS metadata extraction
- Network-aware with offline submission support
- Admin mode with anonymization for demo/test submissions

#### Internationalization
- React-i18next for English/Swahili/Portuguese support
- Responsive language switchers (desktop dropdown, mobile toggle)
- Custom useLanguage hook for language management
- Organized translation keys in [src/i18n/locales/](src/i18n/locales/)

### Environment Configuration
Required environment variables:
- `VITE_MONGODB_URI`: MongoDB connection string
- `VITE_MAPBOX_TOKEN`: Mapbox API token
- `VITE_PELAGIC_API_BASE_URL`: Pelagic Analytics API base URL
- `VITE_PELAGIC_USERNAME`: Pelagic API username
- `VITE_PELAGIC_PASSWORD`: Pelagic API password
- `VITE_PELAGIC_CUSTOMER_ID`: Pelagic customer ID
- `GLOBAL_PASSW`: Global admin password read by `api/auth/login.js`. Set in
  Development only; administrators sign in with their own accounts. There is
  deliberately no `VITE_` copy — a `VITE_` variable is compiled into the client
  bundle and readable by anyone who loads the page.

### Backend API
Serverless functions in [api/](api/), served by `vercel dev` locally and by
Vercel in production — one implementation, not two:
- `POST /api/auth/login` - IMEI/boat name + password authentication
- `POST /api/auth/demo-login` - Demo mode login
- `GET /api/users` - Fetch all users/boats
- `POST /api/catch-events` - Create catch event
- `GET /api/catch-events/trip/:tripId` - Get catch events by trip
- `GET /api/catch-events/user/:imei` - Get catch events by user

MongoDB collections:
- `users` - User accounts with IMEI, Boat name, Community, Region
- `catch-events` - Catch reporting data with trip associations

### Styling & Design
- SCSS modules with component-specific stylesheets
- Tabler CSS framework for consistent UI components
- Responsive design with mobile-first approach
- Bootstrap utilities for layout and spacing
- Theme-aware color system
- **Important**: Always stick to the Tabler theme context. Avoid custom element styling unless strictly necessary.

### Development Workflow
1. Run `npm run dev:all` to serve the frontend and the API on one origin
2. Use ESLint for code quality: `npm run lint`
3. Run `npm run test` for the Vitest suite
4. TypeScript compilation is part of build process

### Production Deployment
- Configured for Vercel deployment with serverless functions
- API routes in `/api` directory for Vercel integration
- PWA support with offline caching for maps and core functionality
- Optimized build with asset hashing and code splitting
- See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for deployment instructions

## Development Guidelines

### CRITICAL RULES - ALWAYS FOLLOW BEFORE EDITING

#### 1. Pre-Edit Checklist
Before making ANY code changes:
- [ ] Read the relevant documentation in `docs/` directory
- [ ] Check existing patterns in similar components
- [ ] Verify the change aligns with architecture (see docs/ARCHITECTURE.md)
- [ ] Ensure consistency with Tabler CSS theme (NO custom styling unless necessary)
- [ ] Read the file you're about to edit completely first

#### 2. Styling Rules (STRICT)
- ✅ ALWAYS use Tabler CSS classes first
- ✅ ALWAYS use Bootstrap utilities for layout
- ❌ NEVER add custom CSS when Tabler equivalent exists
- ❌ NEVER use inline styles except for dynamic values (e.g., positioning based on state)
- 🔍 If you need custom styles, check if Tabler has a solution first
- 📝 Document why custom styles are necessary if you must use them

#### 3. Component Rules
- ✅ ALWAYS use functional components with hooks
- ✅ ALWAYS define TypeScript interfaces for props
- ✅ ALWAYS follow the component structure in docs/COMPONENTS.md
- ❌ NEVER create class components
- ❌ NEVER use `any` type (use proper TypeScript types)
- 📁 Place new components in appropriate directory (dashboard/, map/, catch-form/)

#### 4. State Management Rules
- ✅ Use `useState` for local component state only
- ✅ Use `useContext` (AuthContext) for global state
- ✅ Use custom hooks for reusable data fetching logic
- ❌ NEVER duplicate data fetching logic across components
- ❌ NEVER lift state higher than necessary

#### 5. API Integration Rules
- ✅ ALWAYS use service layer functions (src/api/)
- ✅ ALWAYS implement error handling with try/catch
- ✅ ALWAYS show user-friendly error messages
- ❌ NEVER make direct fetch calls from components
- ❌ NEVER expose API credentials in frontend code

#### 6. Code Quality Rules
- ✅ ALWAYS run `npm run lint` before committing
- ✅ ALWAYS use meaningful variable names
- ✅ ALWAYS add comments for complex logic
- ✅ ALWAYS handle loading and error states in UI
- ❌ NEVER leave console.logs in production code (except intentional logging)
- ❌ NEVER ignore TypeScript errors

#### 7. Testing Before Committing
- ✅ Test in browser (desktop + mobile view)
- ✅ Test all user interactions affected by your change
- ✅ Verify no console errors
- ✅ Check that existing functionality still works
- ✅ Test error scenarios (network failures, invalid input)

### Workflow for Making Changes

```
1. READ relevant documentation (docs/)
2. UNDERSTAND existing patterns (check similar components)
3. PLAN your changes (consider impact)
4. IMPLEMENT following guidelines above
5. TEST thoroughly (see testing checklist)
6. LINT your code (npm run lint)
7. COMMIT with meaningful message
```

### Common Patterns to Follow

#### Adding a New Component
```typescript
// 1. Create file in appropriate directory
// src/components/feature/MyComponent.tsx

import React, { useState } from 'react';

// 2. Define props interface
interface MyComponentProps {
  data: DataType;
  onAction: (id: string) => void;
}

// 3. Functional component with typed props
const MyComponent: React.FC<MyComponentProps> = ({ data, onAction }) => {
  // 4. Hooks at top
  const [state, setState] = useState<StateType>();

  // 5. Event handlers
  const handleClick = () => {
    // ...
  };

  // 6. Return JSX with Tabler classes
  return (
    <div className="card">
      <div className="card-body">
        <button className="btn btn-primary" onClick={handleClick}>
          Click Me
        </button>
      </div>
    </div>
  );
};

export default MyComponent;
```

#### Making API Calls
```typescript
// Use service layer
import { fetchTripData } from '../api/pelagicDataService';

const MyComponent = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchTripData(params);
        setData(result);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dependencies]);

  // Show loading state
  if (loading) return <div className="spinner-border" />;

  // Show error state
  if (error) return <div className="alert alert-danger">{error}</div>;

  // Show data
  return <div>{/* render data */}</div>;
};
```

### When to Ask Questions

Ask the user before proceeding if:
- ❓ Multiple valid approaches exist (e.g., which pattern to use)
- ❓ Unclear requirements or acceptance criteria
- ❓ Breaking changes would affect existing functionality
- ❓ Architectural decision needed (e.g., new external dependency)
- ❓ Design/UX decision required

### Documentation to Reference

- **Authenticating the API**: [docs/API-AUTH-PLAN.md](docs/API-AUTH-PLAN.md) — no endpoint checks who is calling; read before touching auth, admin identity, or any handler that takes a `userId`

Before making changes, check:
- **Architecture decisions**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Data flow patterns**: [docs/DATA_FLOW.md](docs/DATA_FLOW.md)
- **Component patterns**: [docs/COMPONENTS.md](docs/COMPONENTS.md)
- **Development conventions**: [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md)