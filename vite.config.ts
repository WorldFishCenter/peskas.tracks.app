import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Disable minification to avoid terser renderChunk failures during build
      minify: false,
      // Files in public/ to precache besides the build output; the manifest icons are added by the plugin
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      // The app's only web manifest (served as /manifest.webmanifest and linked into index.html by the plugin).
      // Icons from the Peskas brand kit (peskas-context/brand/app).
      manifest: {
        name: 'Peskas Tracks',
        short_name: 'Tracks',
        description: 'Track and monitor fishing vessel activities',
        // The colour of the app's top bar (white in Tabler's light theme, the default), so an installed
        // app's status bar matches it; the splash colour is the Peskas navy, as in the Android and iOS apps.
        theme_color: '#ffffff',
        background_color: '#0b2233',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        mode: 'production',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.tiles\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-tiles-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/analytics\.pelagicdata\.com\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pelagic-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 2 // 2 hours
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    }),
    // Sentry plugin for source map upload (only in production builds with auth token)
    ...(process.env.SENTRY_AUTH_TOKEN ? [sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: './dist/assets/**'
      },
      telemetry: false
    })] : [])
  ],
  // No /api proxy: `vercel dev` serves the functions in api/ on the same
  // origin as the frontend, exactly as production does. Running `vite`
  // directly (npm run dev:frontend) therefore has no backend — use that only
  // for work that does not touch the API.
  server: {
    // `vercel dev` owns port 5173 and starts Vite on a random internal port,
    // then proxies HTTP to it. It does not carry the WebSocket upgrade across
    // that hop, so hot reload has nowhere to connect: the browser is told to
    // reach an internal port that changes on every run, and gives up with
    // "failed to connect to websocket".
    //
    // Giving hot reload a fixed port of its own sidesteps the proxy — the
    // browser connects to it directly while the page itself stays on 5173,
    // which is the port the Mapbox token is restricted to.
    hmr: {
      host: 'localhost',
      port: 24678
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000, // Suppress warning for large chunks (mapbox-gl is large)
    rollupOptions: {
      output: {
        manualChunks: undefined,
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
})
