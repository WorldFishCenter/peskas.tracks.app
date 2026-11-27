import React from 'react';
import ReactDOM from 'react-dom/client';
import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react';
import App from './App';
import './index.css';
// The Peskas logo's colours, light and dark (synced from peskas-context/brand).
import './components/peskas-logo.css';
import { initSentry } from './lib/sentry';
import { catchOutbox } from './api/catchOutbox';

// Initialize Sentry as early as possible
initSentry();

// PostHog (EU cloud): page views, clicks and session replays. Off where the token is
// unset, as in local dev and previews. Errors stay with Sentry.
const posthogToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    defaults: '2026-08-30',
  });
}

// Remove any service worker holding this origin, and the caches it filled.
// Used in development, where a worker left over from a production build serves
// a precache of hashed filenames the dev server has never heard of.
const unregisterServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) return;

    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn('Could not remove existing service workers:', error);
  }
};

const initializeApp = async () => {
  try {
    if (import.meta.env.PROD) {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js');
      }
    } else {
      // Not in development. `vercel dev` serves the built dist/ alongside
      // Vite, so /sw.js answers with the service worker from the last
      // production build. Clear any worker registered by an earlier run.
      await unregisterServiceWorkers();
    }

    catchOutbox.start();
  } catch (error) {
    console.error('App initialization failed:', error);
  }
};

initializeApp();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PostHogProvider client={posthog}>
      <App />
    </PostHogProvider>
  </React.StrictMode>
);
