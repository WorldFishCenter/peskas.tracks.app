# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start frontend development server (Vite)
- `npm run dev:server` - Start backend server with auto-reload
- `npm run dev:all` - Start both frontend and backend concurrently (recommended)
- `npm run start` - Alias for dev:all

### Build & Deploy
- `npm run build` - Build production version (TypeScript compilation + Vite build)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint on codebase

### Server
- `npm run server` - Run backend server in production mode

## Architecture

### Full-Stack Structure
This is a full-stack application with:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js server with MongoDB authentication
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
- `SERVER_PORT`: Backend server port (default: 3001)
- `GLOBAL_PASSW`: Server-side global admin password
- `DEMO_IMEI`: Demo mode IMEI (optional)
- `DEMO_PASSWORD`: Demo mode password (optional)

### Backend API
Express server ([server/server.js](server/server.js)) provides:
- `POST /api/auth/login` - IMEI/boat name + password authentication
- `POST /api/auth/demo-login` - Demo mode login
- `GET /api/users` - Fetch all users/boats
- `POST /api/catch-events` - Create catch event
- `GET /api/catch-events/trip/:tripId` - Get catch events by trip
- `GET /api/catch-events/user/:imei` - Get catch events by user
- `GET /api/test-db` - Database connection test (development only)

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
1. Run `npm run dev:all` to start both frontend and backend
2. Frontend runs on Vite dev server (usually port 5173)
3. Backend API server runs on port 3001
4. Use ESLint for code quality: `npm run lint`
5. TypeScript compilation is part of build process

### Production Deployment
- Configured for Vercel deployment with serverless functions
- API routes in `/api` directory for Vercel integration
- PWA support with offline caching for maps and core functionality
- Optimized build with asset hashing and code splitting
- See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for deployment instructions

## Claude Code Configuration

This project uses a structured Claude Code setup for code quality, security, and efficient AI-assisted development.

### Quick Commands

- `/code-review` - Comprehensive code quality review (uses Code Reviewer agent)
- `/plan` - Create implementation plan for new features (uses Architect agent)
- `/build-fix` - Fix TypeScript/ESLint errors automatically
- `/ui-check` - Validate UI implementation uses Tabler components
- `/document` - Document significant changes (updates architecture-decisions.md, session-context.json)

### Documentation

- `.claude/QUICK_START.md` - Quick reference guide
- `.claude/agents/` - Specialized review agents (Code Reviewer, Security Reviewer, Architect)
- `.claude/commands/` - Slash command definitions (plan, code-review, build-fix, ui-check, document)
- `.claude/skills/` - Code patterns and best practices
  - `frontend-patterns/` - React, TypeScript, Tabler UI, Mapbox/Deck.gl, Offline PWA
  - `backend-patterns/` - Express API, MongoDB, Vercel Serverless, Authentication
  - `coding-standards/` - TypeScript standards, Immutability patterns
- `.claude/contexts/` - Mode-based behavior (dev.md, review.md)

### Memory & Token Optimization

- `.claude/memory/session-context.json` - Current patterns & framework decisions
- `.claude/memory/architecture-decisions.md` - Decision log with rationale
- Reference documentation instead of re-reading code (~2000-3000 tokens saved per reference)
- Use skills for established patterns

### Quick Start

For new developers or when starting work:
1. Read `.claude/QUICK_START.md` for common workflows
2. Check `session-context.json` for current architecture
3. Review relevant skills in `.claude/skills/` for your task
4. Use `/plan` command for complex features
5. Run `/code-review` before committing

## Development Guidelines

### CRITICAL RULES - ALWAYS FOLLOW BEFORE EDITING

#### 1. Pre-Edit Checklist
Before making ANY code changes:
- [ ] **READ `.claude/FEATURE_IMPLEMENTATION_GUIDE.md` FIRST** (ensures coherent development)
- [ ] Check `.claude/memory/data-models.md` (understand data structures)
- [ ] Check `.claude/memory/session-context.json` for current patterns
- [ ] Read relevant skills in `.claude/skills/` directory
- [ ] Check existing patterns in similar components (copy the pattern!)
- [ ] Verify the change aligns with architecture
- [ ] Ensure consistency with Tabler CSS theme (NO custom styling unless necessary)
- [ ] Read the file you're about to edit completely first

#### 2. Styling Rules (STRICT)
- ✅ ALWAYS use Tabler CSS classes first (see `.claude/skills/frontend-patterns/tabler-ui.md`)
- ✅ ALWAYS use Bootstrap utilities for layout
- ✅ Run `/ui-check` to verify Tabler compliance
- ❌ NEVER add custom CSS when Tabler equivalent exists
- ❌ NEVER use inline styles except for dynamic values (e.g., positioning based on state)
- 🔍 If you need custom styles, check if Tabler has a solution first
- 📝 Document why custom styles are necessary if you must use them

#### 3. Component Rules
- ✅ ALWAYS use functional components with hooks (see `.claude/skills/frontend-patterns/react-typescript.md`)
- ✅ ALWAYS define TypeScript interfaces for props
- ✅ ALWAYS follow established patterns (check `.claude/memory/session-context.json`)
- ✅ ALWAYS make new fields optional (`field?: type`) - see `.claude/skills/coding-standards/backwards-compatibility.md`
- ✅ ALWAYS use null checks when rendering optional fields (`field?.method()` or `{field && <div>...}</div>}`)
- ❌ NEVER create class components
- ❌ NEVER use `any` type (see `.claude/skills/coding-standards/typescript.md`)
- ❌ NEVER add required fields to existing database types (breaks old data)
- 📁 Place new components in appropriate directory (dashboard/, map/, catch-form/)

#### 4. State Management Rules
- ✅ Use `useState` for local component state only (see `.claude/skills/frontend-patterns/react-hooks.md`)
- ✅ Use `useContext` (AuthContext) for global state
- ✅ Use custom hooks for reusable data fetching logic (useTripData, useLiveLocations, useWaypoints)
- ✅ Follow immutability patterns (see `.claude/skills/coding-standards/immutability.md`)
- ❌ NEVER duplicate data fetching logic across components
- ❌ NEVER lift state higher than necessary

#### 5. API Integration Rules
- ✅ ALWAYS use service layer functions (src/api/) with caching (see `.claude/skills/frontend-patterns/react-hooks.md`)
- ✅ Backend: Use shared utilities from `api/_utils/` (see `.claude/skills/backend-patterns/vercel-serverless.md`)
- ✅ ALWAYS implement error handling with try/catch
- ✅ ALWAYS show user-friendly error messages
- ❌ NEVER make direct fetch calls from components
- ❌ NEVER expose API credentials in frontend code

#### 6. Code Quality Rules
- ✅ ALWAYS run `/build-fix` to resolve TypeScript/ESLint errors
- ✅ ALWAYS run `/code-review` before committing
- ✅ ALWAYS use meaningful variable names
- ✅ ALWAYS add comments for complex logic
- ✅ ALWAYS handle loading and error states in UI
- ❌ NEVER leave console.logs in production code (except intentional logging)
- ❌ NEVER ignore TypeScript errors

#### 7. Testing Before Committing
- ✅ Test in browser (desktop + mobile view)
- ✅ Test map interactions (if applicable) - see `.claude/skills/frontend-patterns/mapbox-deckgl.md`
- ✅ Test offline behavior (if applicable) - see `.claude/skills/frontend-patterns/offline-pwa.md`
- ✅ Test all user interactions affected by your change
- ✅ Verify no console errors
- ✅ Check that existing functionality still works
- ✅ Test error scenarios (network failures, invalid input)

### Workflow for Making Changes

```
1. REFERENCE - Check `.claude/memory/session-context.json` for patterns
2. PLAN - Use `/plan` command for complex features
3. READ - Check relevant skills in `.claude/skills/`
4. UNDERSTAND - Review similar components in codebase
5. IMPLEMENT - Follow guidelines and established patterns
6. FIX - Run `/build-fix` for TypeScript/ESLint errors
7. CHECK - Run `/ui-check` if UI changes
8. REVIEW - Run `/code-review` for quality check
9. TEST - Thoroughly test (desktop, mobile, map, offline)
10. DOCUMENT - Use `/document` for significant changes
11. COMMIT - Meaningful commit message
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
- ❓ Multiple valid approaches exist (consider using `/plan` to present options)
- ❓ Unclear requirements or acceptance criteria
- ❓ Breaking changes would affect existing functionality
- ❓ Architectural decision needed (consult Architect agent via `/plan`)
- ❓ Design/UX decision required

### Documentation to Reference

Before making changes, check in this order (saves tokens):
1. **Claude Code Memory**: `.claude/memory/session-context.json` - Quick architecture reference
2. **Claude Code Skills**: `.claude/skills/` - Established patterns for your task
3. **Architecture Decisions**: `.claude/memory/architecture-decisions.md` - Why decisions were made
4. **This File**: Current section - High-level project overview
5. **Codebase**: Only when implementation details needed

**Pro Tip**: Use `/plan` for complex features - it will reference all relevant documentation for you.