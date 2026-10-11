const CACHE_NAME = 'tracks-explorer-v3-' + Date.now();
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/index.css',
  '/assets/index.js'
];

// IndexedDB helper functions for background sync
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TracksExplorerDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains('pendingPhotos')) {
        const photoStore = db.createObjectStore('pendingPhotos', { keyPath: 'id', autoIncrement: true });
        photoStore.createIndex('timestamp', 'timestamp', { unique: false });
        photoStore.createIndex('catchEntryId', 'catchEntryId', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('pendingCatches')) {
        const catchStore = db.createObjectStore('pendingCatches', { keyPath: 'id', autoIncrement: true });
        catchStore.createIndex('timestamp', 'timestamp', { unique: false });
        catchStore.createIndex('imei', 'imei', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('uploadQueue')) {
        const queueStore = db.createObjectStore('uploadQueue', { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('priority', 'priority', { unique: false });
        queueStore.createIndex('status', 'status', { unique: false });
      }
    };
  });
};

// Background sync for failed uploads
const syncFailedUploads = async () => {
  try {
    const db = await openDB();
    const transaction = db.transaction(['uploadQueue'], 'readonly');
    const store = transaction.objectStore('uploadQueue');
    
    const request = store.getAll();
    const queue = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log(`📋 Background sync: Found ${queue.length} queued uploads`);

    for (const item of queue) {
      if (item.status === 'pending' || item.status === 'failed') {
        try {
          await processQueuedUpload(item);
        } catch (error) {
          console.error('Failed to process queued upload:', error);
        }
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
};

// Process individual queued upload
const processQueuedUpload = async (queueItem) => {
  try {
    const db = await openDB();
    
    if (queueItem.type === 'catch') {
      // Get catch data
      const catchTransaction = db.transaction(['pendingCatches'], 'readonly');
      const catchStore = catchTransaction.objectStore('pendingCatches');
      const catchRequest = catchStore.get(queueItem.itemId);
      
      const catchData = await new Promise((resolve, reject) => {
        catchRequest.onsuccess = () => resolve(catchRequest.result);
        catchRequest.onerror = () => reject(catchRequest.error);
      });

      if (catchData && !catchData.submitted) {
        // Attempt upload
        const response = await fetch('/api/catch-events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tripId: catchData.formData.tripId,
            date: catchData.formData.date,
            catch_outcome: catchData.formData.noCatch ? 0 : 1,
            imei: catchData.imei,
            ...(catchData.formData.noCatch ? {} : {
              catches: catchData.formData.catches
            })
          }),
        });

        if (response.ok) {
          // Mark as completed
          const updateTransaction = db.transaction(['pendingCatches', 'uploadQueue'], 'readwrite');
          
          // Update catch as submitted
          const updateCatchStore = updateTransaction.objectStore('pendingCatches');
          catchData.submitted = true;
          catchData.submittedAt = new Date().toISOString();
          updateCatchStore.put(catchData);
          
          // Remove from queue
          const updateQueueStore = updateTransaction.objectStore('uploadQueue');
          updateQueueStore.delete(queueItem.id);
          
          console.log('✅ Background sync: Successfully uploaded catch', queueItem.itemId);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      }
    }
  } catch (error) {
    console.error('Failed to process upload:', error);
    
    // Update retry count and schedule next attempt
    const db = await openDB();
    const transaction = db.transaction(['uploadQueue'], 'readwrite');
    const store = transaction.objectStore('uploadQueue');
    
    queueItem.retryCount = (queueItem.retryCount || 0) + 1;
    queueItem.status = 'failed';
    queueItem.lastError = error.message;
    
    // Exponential backoff
    const delayMinutes = Math.min(Math.pow(2, queueItem.retryCount), 30);
    queueItem.nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    
    store.put(queueItem);
  }
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  // Skip waiting to immediately activate new version
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  // Claim all clients immediately
  self.clients.claim();
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-uploads') {
    console.log('🔄 Background sync triggered for uploads');
    event.waitUntil(syncFailedUploads());
  }
});

// Periodic sync for upload attempts (when supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-upload-sync') {
    console.log('⏰ Periodic sync triggered for uploads');
    event.waitUntil(syncFailedUploads());
  }
});

// Message from main thread to trigger manual sync
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_UPLOADS') {
    console.log('📨 Manual sync requested from main thread');
    syncFailedUploads().then(() => {
      // Send back success message
      event.ports[0].postMessage({ success: true });
    }).catch((error) => {
      event.ports[0].postMessage({ success: false, error: error.message });
    });
  }
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle API calls specially - allow them to pass through but add offline handling
  if (event.request.url.includes('/api/catch-events') && event.request.method === 'POST') {
    event.respondWith(
      fetch(event.request.clone()).catch(async (error) => {
        console.log('📵 API request failed, will be handled by upload manager:', error);
        
        // Return a custom response indicating offline mode
        return new Response(
          JSON.stringify({ 
            error: 'Offline - submission queued',
            offline: true,
            queued: true
          }), 
          {
            status: 503, // Service Unavailable
            statusText: 'Offline',
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // Skip other API calls but allow Mapbox events and tiles
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Allow Mapbox events and tiles to pass through
  if (event.request.url.includes('mapbox.com')) {
    // Let Mapbox requests go through without caching
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        // Clone the request because it's a one-time use stream
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then((response) => {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response because it's a one-time use stream
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
}); 