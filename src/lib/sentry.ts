/**
 * Sentry Error Monitoring Configuration
 * Optimized for Vercel deployment with minimal performance overhead
 */

import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry error monitoring
 * Safe to call multiple times - Sentry handles duplicate initialization
 */
export function initSentry() {
  // Only initialize if DSN is provided
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    // No DSN configured - skip Sentry initialization (local development)
    console.info('Sentry DSN not configured, skipping error monitoring');
    return;
  }

  const environment = import.meta.env.MODE; // 'development' or 'production'
  const isDevelopment = environment === 'development';

  Sentry.init({
    dsn,
    environment,

    // Integrations configuration
    integrations: [
      // Browser tracing for performance monitoring
      Sentry.browserTracingIntegration({
        // Track navigation timing
        enableInp: true,
      }),
      // Breadcrumbs for user actions
      Sentry.breadcrumbsIntegration({
        console: true, // Log console messages
        dom: true, // Log DOM events (clicks, inputs)
        fetch: true, // Log fetch requests
        history: true, // Log navigation
        sentry: true, // Log Sentry SDK events
        xhr: true, // Log XHR requests
      }),
      // HTTP client errors
      Sentry.httpClientIntegration(),
    ],

    // Performance Monitoring
    // Sample 10% of transactions to minimize overhead while still getting insights
    tracesSampleRate: isDevelopment ? 1.0 : 0.1, // 100% in dev, 10% in production

    // Session Replay
    // Only capture replays on errors, not all sessions (saves bandwidth and performance)
    replaysSessionSampleRate: 0, // Don't record normal sessions
    replaysOnErrorSampleRate: isDevelopment ? 1.0 : 0.1, // Record 10% of sessions with errors

    // Error Filtering
    // Ignore common benign errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'canvas.contentDocument',

      // Common React/browser errors that are harmless
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',

      // Network errors (users going offline)
      'NetworkError',
      'Failed to fetch',
      'Load failed',

      // Canceled requests (normal behavior)
      'Request aborted',
      'AbortError',

      // Non-Error promise rejections (often harmless)
      'Non-Error promise rejection captured',
    ],

    // Breadcrumb filtering
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
        // Don't log console.log breadcrumbs (too noisy)
        return null;
      }

      // Filter out certain UI events
      if (breadcrumb.category === 'ui.click') {
        // Only log clicks on important elements
        const target = breadcrumb.message;
        if (target && (
          target.includes('button') ||
          target.includes('link') ||
          target.includes('submit')
        )) {
          return breadcrumb;
        }
        return null;
      }

      return breadcrumb;
    },

    // Event filtering and enrichment
    beforeSend(event, hint) {
      // In development, log errors to console as well
      if (isDevelopment) {
        console.error('Sentry captured error:', event, hint);
      }

      // Add custom context
      if (event.user) {
        // Remove sensitive data from user context
        delete event.user.email;
        delete event.user.ip_address;
      }

      // Filter out errors from browser extensions
      const error = hint.originalException;
      if (error && typeof error === 'object' && 'stack' in error) {
        const stack = String(error.stack);
        if (
          stack.includes('chrome-extension://') ||
          stack.includes('moz-extension://') ||
          stack.includes('safari-extension://')
        ) {
          return null; // Don't send to Sentry
        }
      }

      return event;
    },

    // Transport options
    transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),

    // Limit breadcrumbs to reduce memory usage
    maxBreadcrumbs: 50, // Default is 100

    // Attach stack traces to non-error messages
    attachStacktrace: true,

    // Enable debug mode in development
    debug: isDevelopment,

    // Release tracking (falls back to package.json version when env override is unset)
    release: import.meta.env.VITE_SENTRY_RELEASE || `tracks-explorer@${__APP_VERSION__}`,
  });

  // Set global context
  Sentry.setContext('app', {
    name: 'tracks-explorer',
    version: import.meta.env.VITE_APP_VERSION || __APP_VERSION__,
    build_time: import.meta.env.VITE_BUILD_TIME || 'unknown',
  } as Record<string, unknown>);

  console.info(`Sentry initialized in ${environment} mode`);
}

/**
 * Manually capture an exception
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value as Record<string, unknown>);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Manually capture a message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context
 */
export function setUser(user: { id: string; username?: string; role?: string } | null) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(message: string, category: string, level: Sentry.SeverityLevel = 'info', data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a performance transaction
 * Note: Use Sentry.startSpan() instead in newer Sentry versions
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startSpan({
    name,
    op,
  }, (span) => span);
}

/**
 * Wrap async function with error boundary
 */
export function withErrorBoundary<A extends unknown[], R>(
  fn: (...args: A) => R,
  context?: string
): (...args: A) => R {
  return (...args: A) => {
    try {
      const result = fn(...args);

      // Handle promises
      if (result instanceof Promise) {
        return result.catch((error: Error) => {
          captureException(error, { context, args });
          throw error;
        }) as R;
      }

      return result;
    } catch (error) {
      captureException(error as Error, { context, args });
      throw error;
    }
  };
}
