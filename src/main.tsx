import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Import Tabler CSS from node_modules
import '@tabler/core/dist/css/tabler.min.css'
// Import Tabler themes CSS for theme customization
import '@tabler/core/dist/css/tabler-themes.min.css'
// Import our custom styles after Tabler
import './styles/main.scss'

// Initialize Sentry error monitoring
import { initSentry } from './lib/sentry'

// Initialize offline support
import { initializeOfflineSupport, registerServiceWorkerForOfflineSupport, unregisterServiceWorkers } from './utils/initializeOfflineSupport'

// Initialize Sentry as early as possible
initSentry();

// Apply the specific Tabler theme settings you requested
const html = document.documentElement;
html.setAttribute('data-bs-theme-primary', 'cyan');
html.setAttribute('data-bs-theme-base', 'neutral');
html.setAttribute('data-bs-theme-radius', '1.5');

// Initialize offline support and service worker
const initializeApp = async () => {
  try {
    if (import.meta.env.PROD) {
      // Register service worker first
      await registerServiceWorkerForOfflineSupport();
    } else {
      // Not in development. `vercel dev` serves the built dist/ alongside
      // Vite, so /sw.js answers with the service worker from the last
      // production build. Registering it here puts that worker in charge of
      // the dev page, where it tries to serve a precache of hashed filenames
      // the dev server has never heard of — the console fills with "Failed to
      // fetch" and the page is served from a stale build.
      //
      // A worker registered by an earlier run stays bound to this origin, so
      // clear any that is already there rather than only declining to add one.
      await unregisterServiceWorkers();
    }

    // Then initialize offline storage
    await initializeOfflineSupport();
    
    console.log('🚀 App initialization complete');
  } catch (error) {
    console.error('❌ App initialization failed:', error);
  }
};

// Start initialization
initializeApp();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
