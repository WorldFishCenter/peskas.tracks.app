import { offlineStorage } from './offlineStorage';

// Initialize offline support for the application
export const initializeOfflineSupport = async () => {
  try {
    console.log('🚀 Initializing offline support...');
    
    // Initialize offline storage
    await offlineStorage.init();
    console.log('✅ Offline storage initialized');
    
    // Get storage stats
    const stats = await offlineStorage.getStorageStats();
    console.log('📊 Storage stats:', stats);
    
    if (stats.pendingPhotos > 0 || stats.pendingCatches > 0 || stats.queuedUploads > 0) {
      console.log(`📤 Found ${stats.queuedUploads} queued uploads, ${stats.pendingPhotos} pending photos, ${stats.pendingCatches} pending catches`);
      console.log('🔄 Upload manager will attempt to process these automatically when online');
    }
    
    // Register background sync if supported
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // @ts-expect-error - sync API might not be fully typed
        await registration.sync.register('background-sync-uploads');
        console.log('✅ Background sync registered');
      } catch (syncError) {
        console.log('⚠️ Background sync registration failed:', syncError);
        console.log('Using periodic sync fallback instead');
      }
    } else {
      console.log('⚠️ Background sync not supported, using periodic sync instead');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize offline support:', error);
    return false;
  }
};

// Register service worker and setup background sync
export const registerServiceWorkerForOfflineSupport = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registered:', registration);
      
      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Message from service worker:', event.data);
      });
      
      return registration;
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
      return null;
    }
  } else {
    console.warn('⚠️ Service Workers not supported');
    return null;
  }
};

// Remove any service worker holding this origin, and the caches it filled.
// Used in development, where a worker left over from a production build serves
// a precache of files the dev server does not have.
export const unregisterServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      return;
    }

    await Promise.all(registrations.map((registration) => registration.unregister()));

    // The registration going away does not empty the caches it created, and a
    // stale precache would still be there for the next worker to adopt.
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    console.log(`🧹 Removed ${registrations.length} service worker(s) left over from a build`);
  } catch (error) {
    console.warn('Could not remove existing service workers:', error);
  }
};

// Trigger manual sync with service worker
export const triggerManualSync = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Send message to service worker to trigger sync
      return new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        
        channel.port1.onmessage = (event) => {
          if (event.data.success) {
            console.log('✅ Manual sync completed');
            resolve(true);
          } else {
            console.error('❌ Manual sync failed:', event.data.error);
            reject(new Error(event.data.error));
          }
        };
        
        if (registration.active) {
          registration.active.postMessage(
            { type: 'SYNC_UPLOADS' },
            [channel.port2]
          );
        } else {
          reject(new Error('Service worker not active'));
        }
      });
    } catch (error) {
      console.error('❌ Failed to trigger manual sync:', error);
      throw error;
    }
  } else {
    throw new Error('Service workers not supported');
  }
};