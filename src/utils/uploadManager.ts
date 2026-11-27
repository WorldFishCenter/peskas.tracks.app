import { submitMultipleCatchEvents } from '../api/catchEventsService';
import { MultipleCatchFormData } from '../types';
import { offlineStorage, type UploadStatus } from './offlineStorage';
import i18n from '../i18n';

export interface UploadProgress {
  id: string;
  type: 'photo' | 'catch';
  status: UploadStatus | 'retrying';
  progress: number; // 0-100
  error?: string;
  retryCount: number;
  nextRetryAt?: Date;
}

export type UploadProgressCallback = (progress: UploadProgress[]) => void;

type CatchUpload = MultipleCatchFormData & { imei: string | null; username: string | null; offlineId?: number };

export class UploadManager {
  private uploads: Map<string, UploadProgress> = new Map();
  private callbacks: Set<UploadProgressCallback> = new Set();
  private retryIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isProcessing = false;

  constructor() {
    this.initializeOfflineStorage();
    this.startPeriodicSync();
  }

  private async initializeOfflineStorage() {
    try {
      await offlineStorage.init();
      console.log('✅ Offline storage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize offline storage:', error);
    }
  }

  // Subscribe to upload progress updates
  onProgressUpdate(callback: UploadProgressCallback) {
    this.callbacks.add(callback);
    // Immediately call with current state
    callback(Array.from(this.uploads.values()));
    
    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  private notifyCallbacks() {
    const progress = Array.from(this.uploads.values());
    this.callbacks.forEach(callback => callback(progress));
  }

  // Check network connectivity
  private isOnline(): boolean {
    return navigator.onLine;
  }

  // Add upload task
  async addUpload(data: CatchUpload, priority: number = 1): Promise<string> {
    const id = `catch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const uploadProgress: UploadProgress = {
      id,
      type: 'catch',
      status: 'pending',
      progress: 0,
      retryCount: 0
    };

    this.uploads.set(id, uploadProgress);
    
    try {
      // Store in IndexedDB for persistence
      // If offlineId is provided, use it; otherwise create new entry
      let catchId = data.offlineId;
      if (!catchId) {
        catchId = await offlineStorage.savePendingCatch(data, data.imei || null, data.username || null);
      }
      await offlineStorage.addToUploadQueue('catch', catchId, priority);
    } catch (error) {
      console.error('Failed to store upload task offline:', error);
    }

    this.notifyCallbacks();
    
    // CRITICAL FIX: Don't process immediately to prevent duplicates
    // Let periodic sync handle all processing for consistency
    console.log(`📝 Upload ${id} queued. Triggering processing in 5 seconds.`);
    
    // Trigger processing after a short delay to allow for deduplication
    setTimeout(() => {
      if (!this.isProcessing && this.isOnline()) {
        this.processPendingUploads();
      }
    }, 5000); // 5 second delay instead of immediate
    
    return id;
  }

  // Process individual upload
  private async processUpload(uploadId: string, data: CatchUpload, isRetry: boolean = false) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return;

    // Prevent duplicate processing
    if (upload.status === 'uploading' || upload.status === 'completed') {
      console.log(`🚫 Upload ${uploadId} already being processed or completed, skipping`);
      return;
    }

    // Clear any existing retry timeout
    const existingTimeout = this.retryIntervals.get(uploadId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.retryIntervals.delete(uploadId);
    }

    console.log(`📤 Processing upload: ${uploadId} (retry: ${isRetry})`);
    upload.status = isRetry ? 'retrying' : 'uploading';
    upload.progress = 10;
    this.notifyCallbacks();

    try {
      // Simulate progress updates during upload
      const progressInterval = setInterval(() => {
        if (upload.progress < 90) {
          upload.progress += Math.random() * 20;
          this.notifyCallbacks();
        }
      }, 200);

      if (upload.type === 'catch') {
        await submitMultipleCatchEvents(data, data.imei, data.username);
        
        // CRITICAL: Mark as submitted in offline storage to prevent reprocessing
        if (data.offlineId) {
          try {
            await offlineStorage.markCatchSubmitted(data.offlineId);
            console.log(`✅ Marked offline catch ${data.offlineId} as submitted`);
          } catch (error) {
            console.warn('Failed to mark catch as submitted:', error);
          }
        }
      } else if (upload.type === 'photo') {
        // For photos, we need to integrate with the catch submission
        // This is a simplified approach
        // For photos, we need to integrate with the catch submission
        // This is a simplified approach
        console.log('Photo upload completed');
      }

      clearInterval(progressInterval);
      
      upload.status = 'completed';
      upload.progress = 100;
      upload.error = undefined;
      
      console.log(`✅ Upload completed: ${uploadId}`);
      
      // Remove from offline storage after successful upload
      this.cleanupCompletedUpload(uploadId);
      
    } catch (error) {
      upload.status = 'failed';
      upload.error = this.getErrorMessage(error as Error);
      upload.retryCount++;
      
      console.error(`❌ Upload failed: ${uploadId}`, error);
      
      // Schedule retry with exponential backoff
      this.scheduleRetry(uploadId, data);
    }

    this.notifyCallbacks();
  }

  private getErrorMessage(error: Error | { message?: string }): string {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return i18n.t('uploadManager.networkConnectionFailed');
    }
    if (error.message?.includes('timeout')) {
      return i18n.t('uploadManager.uploadTimedOut');
    }
    if (error.message?.includes('500')) {
      return i18n.t('uploadManager.serverErrorRetry');
    }
    return error.message || i18n.t('uploadManager.uploadFailedRetry');
  }

  private scheduleRetry(uploadId: string, data: CatchUpload) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return;

    // Max 5 retries
    if (upload.retryCount >= 5) {
      upload.status = 'failed';
      upload.error = i18n.t('uploadManager.maxRetriesReached');
      this.notifyCallbacks();
      return;
    }

    // Exponential backoff: 2^retryCount minutes, max 30 minutes
    const delayMinutes = Math.min(Math.pow(2, upload.retryCount), 30);
    const delayMs = delayMinutes * 60 * 1000;
    
    upload.nextRetryAt = new Date(Date.now() + delayMs);
    upload.status = 'pending';
    
    console.log(`📅 Scheduling retry for ${uploadId} in ${delayMinutes} minutes`);

    const timeout = setTimeout(() => {
      if (this.isOnline()) {
        console.log(`🔄 Retrying upload: ${uploadId} (attempt ${upload.retryCount + 1})`);
        this.processUpload(uploadId, data, true);
      } else {
        // Reschedule if still offline
        this.scheduleRetry(uploadId, data);
      }
    }, delayMs);

    this.retryIntervals.set(uploadId, timeout);
    this.notifyCallbacks();
  }

  private async cleanupCompletedUpload(uploadId: string) {
    // Remove from memory
    setTimeout(() => {
      this.uploads.delete(uploadId);
      this.notifyCallbacks();
    }, 5000); // Keep success message for 5 seconds
  }

  // Manual retry for failed uploads
  async retryUpload(uploadId: string) {
    const upload = this.uploads.get(uploadId);
    if (!upload || upload.status !== 'failed') return;

    // We'd need to retrieve the original data from offline storage
    // For now, just mark as pending to be picked up by periodic sync
    upload.status = 'pending';
    upload.retryCount = Math.max(0, upload.retryCount - 1); // Reduce retry count for manual retry
    this.notifyCallbacks();
  }

  // Cancel upload
  async cancelUpload(uploadId: string) {
    const upload = this.uploads.get(uploadId);
    if (!upload) return;

    // Clear retry timeout if exists
    const timeout = this.retryIntervals.get(uploadId);
    if (timeout) {
      clearTimeout(timeout);
      this.retryIntervals.delete(uploadId);
    }

    this.uploads.delete(uploadId);
    this.notifyCallbacks();
  }

  // Process pending uploads from offline storage
  private async processPendingUploads() {
    if (this.isProcessing || !this.isOnline()) return;

    this.isProcessing = true;
    
    try {
      const queue = await offlineStorage.getUploadQueue();
      const stats = await offlineStorage.getStorageStats();
      
      console.log(`📊 Processing ${queue.length} queued uploads. Stats:`, stats);

      for (const queueItem of queue) {
        const uploadId = `queue_${queueItem.id}`;
        
        // Skip if already being processed or retry time not reached
        if (this.uploads.has(uploadId)) {
          const existingUpload = this.uploads.get(uploadId);
          if (existingUpload?.status === 'uploading' || existingUpload?.status === 'completed') {
            console.log(`🚫 Skipping queue item ${queueItem.id} - already processing/completed`);
            continue;
          }
        }
        
        if (queueItem.nextRetryAt && new Date() < new Date(queueItem.nextRetryAt)) {
          console.log(`⏰ Skipping queue item ${queueItem.id} - retry time not reached`);
          continue;
        }

        let data: CatchUpload | undefined;
        if (queueItem.type === 'photo') {
          // Retrieve photo data from offline storage
          // This is simplified - would need proper implementation
          continue;
        } else if (queueItem.type === 'catch') {
          // Retrieve catch data from offline storage
          const catches = await offlineStorage.getPendingCatches();
          const catchData = catches.find(c => c.id === queueItem.itemId);
          
          // CRITICAL: Skip if already submitted or not found
          if (!catchData || catchData.submitted) {
            console.log(`🚫 Skipping queue item ${queueItem.id} - already submitted or not found`);
            // Remove from queue since it's no longer needed
            await offlineStorage.removeFromQueue(queueItem.id || 0);
            continue;
          }
          
          const formData = catchData.formData;
          data = {
            ...formData,
            imei: catchData.imei || null,
            username: catchData.username || null,
            offlineId: catchData.id // Include offline ID for marking as submitted
          };
        }

        const queueUploadId = `queue_${queueItem.id}`;
        const uploadProgress: UploadProgress = {
          id: queueUploadId,
          type: queueItem.type,
          status: 'pending',
          progress: 0,
          retryCount: queueItem.retryCount || 0
        };

        this.uploads.set(queueUploadId, uploadProgress);
        this.notifyCallbacks();

        // Process the upload
        if (data) {
          await this.processUpload(queueUploadId, data);
        }
      }
    } catch (error) {
      console.error('Error processing pending uploads:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Periodic sync for offline uploads
  private startPeriodicSync() {
    // Reduced frequency: Check every 2 minutes to prevent spam
    setInterval(() => {
      if (!this.isProcessing) {
        this.processPendingUploads();
      } else {
        console.log('⏰ Periodic sync skipped - already processing uploads');
      }
    }, 120000); // 2 minutes instead of 30 seconds

    // Also check when coming back online
    window.addEventListener('online', () => {
      console.log('📶 Connection restored, processing pending uploads...');
      setTimeout(() => this.processPendingUploads(), 1000);
    });

    window.addEventListener('offline', () => {
      console.log('📵 Connection lost, uploads will be queued...');
    });
  }

  // Get current upload statistics
  async getStats() {
    const memoryStats = {
      active: Array.from(this.uploads.values()).filter(u => u.status !== 'completed').length,
      completed: Array.from(this.uploads.values()).filter(u => u.status === 'completed').length,
      failed: Array.from(this.uploads.values()).filter(u => u.status === 'failed').length,
    };

    try {
      const offlineStats = await offlineStorage.getStorageStats();
      return {
        ...memoryStats,
        ...offlineStats,
        isOnline: this.isOnline()
      };
    } catch {
      return memoryStats;
    }
  }

  // Clear all completed uploads
  clearCompleted() {
    const completed = Array.from(this.uploads.entries())
      .filter(([, upload]) => upload.status === 'completed')
      .map(([id]) => id);
    
    completed.forEach(id => this.uploads.delete(id));
    this.notifyCallbacks();
  }
}

// Global instance
export const uploadManager = new UploadManager();