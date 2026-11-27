import { MultipleCatchFormData, GPSCoordinate } from '../types';

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

interface PhotoRecord {
  id?: number;
  catchEntryId: string;
  base64Photo: string;
  gpsCoordinate?: GPSCoordinate;
  timestamp: string;
  retryCount?: number;
  uploaded?: boolean;
  uploadedAt?: string;
}

interface CatchRecord {
  id?: number;
  formData: MultipleCatchFormData;
  imei: string | null;
  username: string | null;
  timestamp: string;
  submitted?: boolean;
  retryCount?: number;
  lastError?: string | null;
}

interface UploadQueueItem {
  id?: number;
  type: 'photo' | 'catch';
  itemId: number;
  priority: number;
  status: UploadStatus;
  retryCount: number;
  nextRetryAt: string;
  createdAt: string;
}

// IndexedDB wrapper for offline photo and catch data storage
export class OfflineStorage {
  private dbName = 'TracksExplorerDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Store for pending photo uploads
        if (!db.objectStoreNames.contains('pendingPhotos')) {
          const photoStore = db.createObjectStore('pendingPhotos', { keyPath: 'id', autoIncrement: true });
          photoStore.createIndex('timestamp', 'timestamp', { unique: false });
          photoStore.createIndex('catchEntryId', 'catchEntryId', { unique: false });
        }
        
        // Store for pending catch submissions
        if (!db.objectStoreNames.contains('pendingCatches')) {
          const catchStore = db.createObjectStore('pendingCatches', { keyPath: 'id', autoIncrement: true });
          catchStore.createIndex('timestamp', 'timestamp', { unique: false });
          catchStore.createIndex('imei', 'imei', { unique: false });
        }
        
        // Store for upload queue management
        if (!db.objectStoreNames.contains('uploadQueue')) {
          const queueStore = db.createObjectStore('uploadQueue', { keyPath: 'id', autoIncrement: true });
          queueStore.createIndex('priority', 'priority', { unique: false });
          queueStore.createIndex('status', 'status', { unique: false });
          queueStore.createIndex('retryCount', 'retryCount', { unique: false });
        }
      };
    });
  }

  // Photo storage methods
  async savePhoto(catchEntryId: string, base64Photo: string, gpsCoordinate?: GPSCoordinate): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['pendingPhotos'], 'readwrite');
    const store = transaction.objectStore('pendingPhotos');
    
    const photoData: PhotoRecord = {
      catchEntryId,
      base64Photo,
      gpsCoordinate,
      timestamp: new Date().toISOString(),
      uploaded: false,
      retryCount: 0
    };
    
    return new Promise((resolve, reject) => {
      const request = store.add(photoData);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getPhotosByCatchEntry(catchEntryId: string): Promise<PhotoRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['pendingPhotos'], 'readonly');
    const store = transaction.objectStore('pendingPhotos');
    const index = store.index('catchEntryId');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(catchEntryId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markPhotoUploaded(photoId: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['pendingPhotos'], 'readwrite');
    const store = transaction.objectStore('pendingPhotos');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(photoId);
      getRequest.onsuccess = () => {
        const photo = getRequest.result;
        if (photo) {
          photo.uploaded = true;
          photo.uploadedAt = new Date().toISOString();
          const updateRequest = store.put(photo);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve(); // Photo not found, consider it handled
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async removePhoto(photoId: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['pendingPhotos'], 'readwrite');
    const store = transaction.objectStore('pendingPhotos');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(photoId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Catch submission storage methods
  async savePendingCatch(formData: MultipleCatchFormData, imei: string | null, username: string | null = null): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['pendingCatches'], 'readwrite');
    const store = transaction.objectStore('pendingCatches');
    
    const catchData = {
      formData,
      imei: imei || null,
      username: username || null,
      timestamp: new Date().toISOString(),
      submitted: false,
      retryCount: 0,
      lastError: null
    };
    
    return new Promise((resolve, reject) => {
      const request = store.add(catchData);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingCatches(): Promise<CatchRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['pendingCatches'], 'readonly');
    const store = transaction.objectStore('pendingCatches');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.filter(catchData => !catchData.submitted));
      request.onerror = () => reject(request.error);
    });
  }

  async markCatchSubmitted(catchId: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['pendingCatches'], 'readwrite');
    const store = transaction.objectStore('pendingCatches');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(catchId);
      getRequest.onsuccess = () => {
        const catchData = getRequest.result;
        if (catchData) {
          catchData.submitted = true;
          catchData.submittedAt = new Date().toISOString();
          const updateRequest = store.put(catchData);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Upload queue methods
  async addToUploadQueue(type: 'photo' | 'catch', itemId: number, priority: number = 1): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['uploadQueue'], 'readwrite');
    const store = transaction.objectStore('uploadQueue');
    
    const queueItem: UploadQueueItem = {
      type,
      itemId,
      priority,
      status: 'pending',
      retryCount: 0,
      nextRetryAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
      const request = store.add(queueItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUploadQueue(): Promise<UploadQueueItem[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['uploadQueue'], 'readonly');
    const store = transaction.objectStore('uploadQueue');
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        // Sort by priority (higher first) and creation time
        const results = request.result
          .filter(item => item.status === 'pending')
          .sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          });
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateQueueItemStatus(queueId: number, status: UploadStatus, error?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['uploadQueue'], 'readwrite');
    const store = transaction.objectStore('uploadQueue');
    
    return new Promise((resolve, reject) => {
      const getRequest = store.get(queueId);
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.status = status;
          if (error) item.lastError = error;
          if (status === 'failed') {
            item.retryCount = (item.retryCount || 0) + 1;
            // Exponential backoff: 2^retryCount minutes
            const delayMinutes = Math.pow(2, item.retryCount);
            item.nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
          }
          item.updatedAt = new Date().toISOString();
          
          const updateRequest = store.put(item);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async removeFromQueue(queueId: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction(['uploadQueue'], 'readwrite');
    const store = transaction.objectStore('uploadQueue');
    
    return new Promise((resolve, reject) => {
      const request = store.delete(queueId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Network status and stats
  async getStorageStats(): Promise<{
    pendingPhotos: number;
    pendingCatches: number;
    queuedUploads: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');
    
    const [photos, catches, queue] = await Promise.all([
      this.getAllFromStore('pendingPhotos'),
      this.getAllFromStore('pendingCatches'),
      this.getUploadQueue()
    ]);
    
    return {
      pendingPhotos: (photos as PhotoRecord[]).filter(p => !p.uploaded).length,
      pendingCatches: (catches as CatchRecord[]).filter(c => !c.submitted).length,
      queuedUploads: queue.length
    };
  }

  private async getAllFromStore(storeName: string): Promise<PhotoRecord[] | CatchRecord[] | UploadQueueItem[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Global instance
export const offlineStorage = new OfflineStorage();