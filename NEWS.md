# tracks-explorer 2.9

### New Features
- **Administrator Accounts**: Administrators sign in with an account of their own instead of a shared global password, so their waypoints, catch events, and feedback are attributed to them. Created with `npm run admin:create`.
- **Session Tokens**: Signing in now issues a signed token that the app sends with every API request, and the server records who is calling. Nothing is rejected yet.

### Improvements
- **One API Client**: All frontend requests go through a single module, which is where the session token is attached; third-party calls stay separate so credentials never leave our own origin.
- **Database Selection**: `MONGODB_DATABASE` now chooses the database for every endpoint, so local development can run against `portal-dev` rather than writing production records.
- **Dev Server Fixes**: Hot reload works behind `vercel dev`, and a service worker left by an old production build no longer takes over the development page.

# tracks-explorer 2.8

### New Features
- **Waypoints on the Map**: Add, categorize, and manage private waypoints with a dedicated modal, crosshair selection mode, and GPS pickup; see colored pins with tooltips on the map, toggle visibility, and jump the view to any saved spot.
- **Waypoint API + Hook**: New `/api/waypoints` CRUD endpoints with per-user access checks, type validation, and demo-mode safeguards, plus a `useWaypoints` client hook and service layer for fetching, creating, updating, and deleting markers.
- **User Feedback System**: Simple feedback form accessible from user menu allowing fishers to share opinions, report problems, make suggestions, or ask questions. Supports all user types (PDS, non-PDS, demo mode) with full i18n support (English, Portuguese, Swahili).

### Improvements
- **API Hardening**: Shared CORS, rate limiting, validation, and error-handling utilities applied to waypoint routes; Mongo index creation script added to keep lookups fast as data grows.
- **Observability & Build Tooling**: Frontend Sentry initialization with release tagging and optional replay sampling, Vite Sentry plugin for source map upload, and updated `.env.example` variables for safer production setups.
- **Map & Layout Polish**: New waypoint controls in map UI, mobile-friendly tooltips, and layout scroll fixes to keep the dashboard stable during long sessions.
- **Security Fixes**: Fixed regex injection vulnerability in login, added password type and length validation on registration, improved input validation across feedback and catch event APIs.

# tracks-explorer 2.7

### New Features
- **User Registration System**: New users can now create accounts with username, country, vessel type, main gear type, and boat name
- **User Profile Management**: Users can view and edit their profile information and change passwords
- **Non-PDS User Support**: Full support for users without tracking devices (non-PDS users)
  - GPS device location support with "Get My Location" feature
  - Direct catch reporting without trip selection
  - Dedicated dashboard views for non-PDS users
- **Enhanced Map Visibility**: Map is always visible even when no trips are available, allowing users to explore bathymetry and other map features
- **Flexible Authentication**: Login support using IMEI, Boat name, or Username
- **Catch Events API**: New endpoints for retrieving user catch events by IMEI or username
- **Improved Map UI**: 
  - Removed Mapbox default controls for cleaner interface
  - Subtle "No trips" banner when no data is available
  - Enhanced glassmorphic design for better integration

### Improvements
- Enhanced error handling and validation across registration and login
- Improved data fetching for both PDS and non-PDS users
- Better tooltip content and mobile responsiveness
- Updated localization for English, Portuguese, and Swahili

## Features

- View vessel tracks on an interactive map
- Filter trips by date and vessel
- Analyze vessel speed with color-coded tracks
- User registration and profile management
- Support for both PDS (tracking device) and non-PDS users
- Device GPS location support
- MongoDB-based authentication system using IMEI, boat name, or username


# tracks-explorer 2.6

## New Features

- **Manual Refresh Control**: Added refresh button to map controls for on-demand data updates
  - Compact icon-only button positioned at bottom-right of map
  - Cyan color for better visibility against map background
  - Clear cache and refetch data functionality
  - Loading state with spinner during refresh operation
  - Mobile-optimized 44x44px button size for easy thumb access

- **Trips API Endpoint**: Implemented `/v1/trips` endpoint support for efficient trip metadata fetching
  - New `fetchTripsFromAPI()` function for lightweight trip summaries
  - CSV parser for trips data format
  - Foundation for future trips-first data flow optimization
  - Reduces payload size compared to fetching all GPS points

## Enhancements

- **Dynamic Cache System**: Intelligent caching based on data recency
  - Today's data: 1-minute cache (80% faster updates vs. previous 5-minute cache)
  - Last 24 hours: 3-minute cache
  - Historical data: 10-minute cache
  - Automatic cache duration adjustment based on query date range

- **Cache Management Improvements**: Enhanced cache reliability and performance
  - LRU (Least Recently Used) eviction with 50-entry limit prevents memory leaks
  - Exported `clearCache()` function for manual cache control
  - Cache statistics logging for debugging (duration, size, evictions)
  - Re-enabled live locations cache with 1-minute duration

- **Data Freshness Optimization**: Fixed timezone handling to capture recent trips
  - Added +1 day buffer for "today" queries to handle timezone interpretation
  - Prevents missing recent trips when API interprets dates in UTC
  - Documented timezone ambiguity issue with explanatory comments

- **Map Controls UI Polish**: Improved mobile experience with better visual hierarchy
  - Bathymetry and Live Location buttons now 85% opacity on mobile (< 768px screens)
  - Refresh button repositioned from top-right stack to bottom-right corner
  - Reduced visual clutter while maintaining full functionality
  - Consistent 44px minimum touch target size across all controls

- **API Integration**: Enhanced Pelagic Data Service integration
  - Applied dynamic caching to both trips and points endpoints
  - Consistent error handling across all API functions
  - Improved logging with cache hit/miss indicators

## Fixes

- **Cache Debug Code**: Removed debug code disabling live locations cache
  - Re-enabled production caching for live locations endpoint
  - Improved API load efficiency while keeping data fresh

- **Memory Safety**: Implemented cache size limits to prevent unbounded growth
  - Automatic eviction of oldest entries when 50-entry limit reached
  - Prevents memory leaks during long user sessions with multiple queries

## Performance Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Today's data freshness | 5 min stale | 1 min stale | 80% faster |
| Cache memory usage | Unlimited | 50-entry limit | No leaks |
| Live locations API load | Every request | 1-min cache | Reduced load |
| Timezone accuracy | May miss hours | +1 day buffer | All trips shown |

---

# tracks-explorer 2.5

## New Features

- **Fisher Statistics Dashboard**: Added comprehensive statistics and performance analytics feature
  - `Stats.tsx`: Main statistics page with tabbed interface for catches and efficiency metrics
  - `CatchesTab.tsx`: Displays catch statistics including total catch, success rate, and species distribution
  - `EfficiencyTab.tsx`: Shows performance metrics (CPUE, fuel efficiency, search ratio) with comparison capabilities
  - `StatsControls.tsx`: Date range selector with quick presets (7/30/90 days) and comparison toggle

- **Performance Metrics System**: Implemented fisher performance tracking and comparison
  - `useFisherStats.ts`: Custom hook for fetching catch statistics data
  - `useFisherPerformance.ts`: Custom hook for fetching performance metrics
  - `fisherStatsService.ts`: API service layer with demo mode support for testing

- **Statistics API Integration**: Added backend endpoints for fisher statistics
  - Comparison against community averages
  - Previous period comparison support
  - Trip type classification (offshore, mid-range, nearshore)
  - Best trips tracking with CPUE calculations

- **Bathymetry Layer Visualization**: Added depth contour mapping for fishing zone identification
  - GeoJSON-based contour rendering (6.5MB GEBCO data for Western Indian Ocean)
  - Interactive toggle control with loading indicators
  - Depth-based color gradient (light cyan to purple, 0-500m)
  - Labeled contours for key fishing depths (5, 10, 20, 50, 100, 200, 500m)
  - Full zoom level support (Z4-Z22) with smooth rendering
  - PWA-compatible offline caching for bathymetry data
  - Performance optimizations for slow connectivity areas

## Enhancements

- **Map clarity**: Trip tracks now show in a single highlight color, and activity grids vary transparency by intensity for easier reading. Legend hides speed info when only trips are shown.
- **Translations**: Added the missing labels so species stats read correctly in all languages.
- **Layout Consistency**: Standardized page header structure across Dashboard and Stats pages
  - Added date range pretitle to Stats page matching Dashboard format
  - Removed excessive padding from page-wrapper
  - Fixed double container-xl nesting issues

- **TypeScript Type Safety**: Updated comparison types throughout the application
  - Changed from `'community' | 'all' | 'previous'` to `'community' | 'previous'`
  - Updated 4 interfaces: `FisherStatsComparison`, `FisherStatsParams`, `FisherPerformanceComparison`, `FisherPerformanceParams`

- **Map Controls Enhancement**: Improved map control panel with new bathymetry toggle
  - Added IconMathMaxMin button for bathymetry layer control
  - Integrated spinner for loading state feedback
  - Consistent styling with existing controls (activity grid, live locations)
  - Responsive design with mobile-optimized layout

- **Internationalization**: Added comprehensive translation support for statistics feature
  - `stats.performance.noDataMessage`: User-friendly message for empty performance data
  - Replaced hardcoded English text with translation keys
  - Maintained English/Swahili support across all new components
  - Added bathymetry translations: `map.bathymetry`, `map.showBathymetry`, `map.depthLabel`

## Fixes

- **Layout Spacing**: Resolved excessive blank space between header and main content
  - Removed `padding: 1.5rem 0` from `.page-wrapper` in main.scss
  - Standardized page-header classes (removed custom `py-0 border-bottom-0`)

- **Mock Data Consistency**: Fixed property name mismatches in demo mode
  - Changed `started`/`ended` to `date` in bestTrips mock data
  - Changed `trip_type` to `tripType` to match TypeScript interface

- **Code Quality**: Removed debug console.log statements from production code
  - Cleaned up logging in `useFisherStats.ts` (3 statements)
  - Cleaned up logging in `useFisherPerformance.ts` (3 statements)
  - Cleaned up logging in `Dashboard.tsx` (5 statements)
  - Kept console.error for proper error handling

## Configuration

- **Demo Mode**: Added demo data support for statistics features without backend dependency
  - Mock fisher statistics with realistic catch data
  - Mock performance metrics including trip types and best trips
  - Enables testing and development without database connection
