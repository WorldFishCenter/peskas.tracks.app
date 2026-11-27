import type { CatchEvent, MultipleCatchFormData } from '../types';
import i18n from '../i18n';
import { isDemoMode, isAdminMode } from '../utils/demoData';
import { apiFetch } from './httpClient';

/** Stay safely beneath Vercel's 4.5 MB serverless request payload limit. */
export const MAX_REPORT_PAYLOAD_BYTES = 4 * 1024 * 1024;
const MAX_RETRY_ATTEMPTS = 8;
const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 30 * 60 * 1000;
const PERIODIC_FLUSH_MS = 2 * 60 * 1000;

export interface QueuedCatchReport extends MultipleCatchFormData {
  imei: string | null;
  username: string | null;
}

export interface OutboxRecord {
  id: string;
  report: QueuedCatchReport;
  attempts: number;
  nextRetryAt: number;
  lastError?: string;
  createdAt: number;
}

/** Storage seam for the catch-report outbox (IndexedDB in prod, in-memory in tests). */
export interface OutboxStore {
  list(): Promise<OutboxRecord[]>;
  put(record: OutboxRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

/** Transport seam for delivering one catch report (HTTP, demo replay, or test double). */
export interface CatchTransport {
  sendReport(report: QueuedCatchReport): Promise<CatchEvent[]>;
}

export type PhotoRecompressor = (
  base64Photo: string,
  maxDimension: number,
  quality: number
) => Promise<string>;

export class PayloadTooLargeError extends Error {
  constructor(message: string = i18n.t('api.payloadTooLargeError')) {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

export interface CatchOutboxStatus {
  pending: number;
  failed: number;
}

export interface CatchOutbox {
  enqueue(report: QueuedCatchReport): Promise<{ id: string; delivered: boolean; queuedOffline: boolean }>;
  flush(): Promise<{ delivered: number; failed: number; remaining: number }>;
  getStatus(): Promise<CatchOutboxStatus>;
  start(): void;
  stop(): void;
}

/** Serialize Date fields safely for byte-size estimation and storage. */
function normalizeReport(report: QueuedCatchReport): QueuedCatchReport {
  return {
    ...report,
    date: report.date instanceof Date ? report.date : new Date(report.date),
    catches: (report.catches || []).map((entry) => ({
      ...entry,
      photos: entry.photos ? [...entry.photos] : [],
      gps_photo: entry.gps_photo ? [...entry.gps_photo] : []
    }))
  };
}

/** Estimate JSON UTF-8 size in bytes for a catch report. */
export function estimateReportPayloadBytes(report: QueuedCatchReport): number {
  const json = JSON.stringify(report);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(json).length;
  }
  return json.length * 2;
}

/**
 * Proper async canvas image recompression — waits for img.onload instead of
 * reading dimensions synchronously, and preserves a valid JPEG data URL.
 */
export const recompressBase64Photo: PhotoRecompressor = (base64Photo, maxDimension, quality) => {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(base64Photo);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width === 0 || height === 0) {
        resolve(base64Photo);
        return;
      }

      if (width > height && width > maxDimension) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Photo);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error(i18n.t('catch.photoError')));
    img.src = base64Photo;
  });
};

/**
 * Ensure a catch report fits beneath MAX_REPORT_PAYLOAD_BYTES by progressively
 * recompressing photos asynchronously. Throws PayloadTooLargeError if still
 * oversized — never silently drops fisher photos or GPS coordinates.
 */
export async function prepareCatchReport(
  rawReport: QueuedCatchReport,
  recompress: PhotoRecompressor = recompressBase64Photo,
  maxBytes: number = MAX_REPORT_PAYLOAD_BYTES
): Promise<QueuedCatchReport> {
  let report = normalizeReport(rawReport);
  if (estimateReportPayloadBytes(report) <= maxBytes) {
    return report;
  }

  const steps: Array<[number, number]> = [
    [700, 0.65],
    [500, 0.5]
  ];

  for (const [maxDimension, quality] of steps) {
    const catches = await Promise.all(
      report.catches.map(async (entry) => ({
        ...entry,
        photos: await Promise.all(
          (entry.photos || []).map((photo) => recompress(photo, maxDimension, quality))
        )
      }))
    );

    report = { ...report, catches };
    if (estimateReportPayloadBytes(report) <= maxBytes) {
      return report;
    }
  }

  throw new PayloadTooLargeError();
}

// --- Storage adapters ---

/** In-memory store for deterministic tests and SSR/private-mode fallback. */
export function createMemoryOutboxStore(initial: OutboxRecord[] = []): OutboxStore {
  const map = new Map<string, OutboxRecord>();
  for (const record of initial) {
    map.set(record.id, record);
  }

  return {
    async list() {
      return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
    },
    async put(record) {
      map.set(record.id, record);
    },
    async delete(id) {
      map.delete(id);
    }
  };
}

const OUTBOX_DB_NAME = 'TracksExplorerOutbox';
const OUTBOX_STORE_NAME = 'outbox';
const LEGACY_DB_NAME = 'TracksExplorerDB';

/**
 * Single-store IndexedDB adapter. Migrates any unsubmitted records left in the
 * legacy TracksExplorerDB.pendingCatches store once so no offline fisher
 * reports are lost on upgrade, and drops the orphaned pendingPhotos store.
 */
export function createIndexedDbOutboxStore(): OutboxStore {
  let dbPromise: Promise<IDBDatabase> | null = null;
  let migratedLegacy = false;

  const openDb = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(OUTBOX_DB_NAME, 1);
        request.onerror = () => {
          dbPromise = null;
          reject(request.error);
        };
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(OUTBOX_STORE_NAME)) {
            db.createObjectStore(OUTBOX_STORE_NAME, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
      });
    }
    return dbPromise;
  };

  const migrateLegacyIfNeeded = async (db: IDBDatabase): Promise<void> => {
    if (migratedLegacy || typeof indexedDB === 'undefined') return;
    migratedLegacy = true;

    try {
      const legacyDb = await new Promise<IDBDatabase | null>((resolve) => {
        const req = indexedDB.open(LEGACY_DB_NAME, 1);
        req.onerror = () => resolve(null);
        req.onupgradeneeded = () => {
          // Legacy DB did not exist — abort creation rather than leaving an empty DB.
          req.transaction?.abort();
          resolve(null);
        };
        req.onsuccess = () => resolve(req.result);
      });

      if (!legacyDb || !legacyDb.objectStoreNames.contains('pendingCatches')) {
        legacyDb?.close();
        return;
      }

      const legacyItems = await new Promise<Array<{
        id?: number;
        formData?: MultipleCatchFormData;
        imei?: string | null;
        username?: string | null;
        submitted?: boolean;
        timestamp?: string;
      }>>((resolve) => {
        const tx = legacyDb.transaction(['pendingCatches'], 'readonly');
        const req = tx.objectStore('pendingCatches').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });

      const unsubmitted = legacyItems.filter((item) => !item.submitted && item.formData);
      if (unsubmitted.length > 0) {
        const writeTx = db.transaction([OUTBOX_STORE_NAME], 'readwrite');
        const store = writeTx.objectStore(OUTBOX_STORE_NAME);
        for (const item of unsubmitted) {
          const record: OutboxRecord = {
            id: `legacy_${item.id ?? Date.now()}`,
            report: normalizeReport({
              ...item.formData!,
              imei: item.imei ?? null,
              username: item.username ?? null
            }),
            attempts: 0,
            nextRetryAt: Date.now(),
            createdAt: item.timestamp ? Date.parse(item.timestamp) || Date.now() : Date.now()
          };
          store.put(record);
        }
        await new Promise<void>((resolve, reject) => {
          writeTx.oncomplete = () => resolve();
          writeTx.onerror = () => reject(writeTx.error);
        });
      }

      legacyDb.close();
      indexedDB.deleteDatabase(LEGACY_DB_NAME);
    } catch {
      // Legacy migration is best-effort; never block new catch reports.
    }
  };

  const withDb = async (): Promise<IDBDatabase> => {
    const db = await openDb();
    await migrateLegacyIfNeeded(db);
    return db;
  };

  return {
    async list() {
      const db = await withDb();
      const rows = await new Promise<OutboxRecord[]>((resolve, reject) => {
        const tx = db.transaction([OUTBOX_STORE_NAME], 'readonly');
        const req = tx.objectStore(OUTBOX_STORE_NAME).getAll();
        req.onsuccess = () => resolve((req.result as OutboxRecord[]) || []);
        req.onerror = () => reject(req.error);
      });
      return rows
        .map((row) => ({ ...row, report: normalizeReport(row.report) }))
        .sort((a, b) => a.createdAt - b.createdAt);
    },
    async put(record) {
      const db = await withDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([OUTBOX_STORE_NAME], 'readwrite');
        const req = tx.objectStore(OUTBOX_STORE_NAME).put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    async delete(id) {
      const db = await withDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([OUTBOX_STORE_NAME], 'readwrite');
        const req = tx.objectStore(OUTBOX_STORE_NAME).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }
  };
}

// --- Transport adapters ---

async function postSingleCatchEvent(payload: Record<string, unknown>, isNoCatch: boolean): Promise<CatchEvent> {
  const response = await apiFetch('/catch-events', {
    method: 'POST',
    body: payload
  });

  if (!response.ok) {
    let errorMessage = isNoCatch
      ? i18n.t('api.failedToSubmitNoCatch', { status: response.status })
      : i18n.t('api.failedToSubmitCatch', { status: response.status });

    if (response.status === 413) {
      errorMessage = i18n.t('api.payloadTooLargeError');
    } else if (response.status === 400) {
      errorMessage = i18n.t('api.invalidDataError');
    } else if (response.status === 500) {
      errorMessage = i18n.t('api.serverError');
    } else {
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Keep translated fallback.
      }
    }

    throw new Error(errorMessage);
  }

  return response.json() as Promise<CatchEvent>;
}

export const httpCatchTransport: CatchTransport = {
  async sendReport(rawReport: QueuedCatchReport): Promise<CatchEvent[]> {
    const report = normalizeReport(rawReport);
    const adminFlag = isAdminMode();

    if (report.noCatch) {
      const event = await postSingleCatchEvent(
        {
          tripId: report.tripId,
          date: report.date.toISOString(),
          catch_outcome: 0,
          imei: report.imei,
          username: report.username,
          reportId: report.reportId,
          fuel_liters: report.fuel_liters,
          isAdmin: adminFlag
        },
        true
      );
      return [event];
    }

    const results: CatchEvent[] = [];
    for (const entry of report.catches) {
      if (entry.quantity <= 0) continue;
      const event = await postSingleCatchEvent(
        {
          tripId: report.tripId,
          date: report.date.toISOString(),
          catch_outcome: 1,
          imei: report.imei,
          username: report.username,
          reportId: report.reportId,
          entryId: entry.id,
          fuel_liters: report.fuel_liters,
          isAdmin: adminFlag,
          fishGroup: entry.fishGroup,
          quantity: entry.quantity,
          photos: entry.photos,
          gps_photo: entry.gps_photo
        },
        false
      );
      results.push(event);
    }

    return results;
  }
};

export const demoCatchTransport: CatchTransport = {
  async sendReport(rawReport: QueuedCatchReport): Promise<CatchEvent[]> {
    const report = normalizeReport(rawReport);
    const nowIso = new Date().toISOString();

    if (report.noCatch) {
      return [
        {
          _id: `demo-no-catch-${Date.now()}`,
          tripId: report.tripId,
          quantity: 0,
          date: report.date.toISOString(),
          reportedAt: nowIso,
          imei: report.imei ?? undefined,
          username: report.username ?? undefined,
          catch_outcome: 0,
          photos: [],
          gps_photo: undefined
        }
      ];
    }

    return report.catches
      .filter((entry) => entry.quantity > 0)
      .map((entry, index) => ({
        _id: `demo-catch-${Date.now()}-${index}`,
        tripId: report.tripId,
        fishGroup: entry.fishGroup,
        quantity: entry.quantity,
        date: report.date.toISOString(),
        reportedAt: nowIso,
        imei: report.imei ?? undefined,
        username: report.username ?? undefined,
        catch_outcome: 1,
        photos: entry.photos || [],
        gps_photo: entry.gps_photo
      }));
  }
};

// --- Deep CatchOutbox factory ---

export interface CatchOutboxOptions {
  store: OutboxStore;
  transport: CatchTransport;
  now?: () => number;
  isOnline?: () => boolean;
  recompressPhoto?: PhotoRecompressor;
  maxPayloadBytes?: number;
  maxAttempts?: number;
  baseBackoffMs?: number;
  periodicFlushMs?: number;
}

export function createCatchOutbox(options: CatchOutboxOptions): CatchOutbox {
  const {
    store,
    transport,
    now = () => Date.now(),
    isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine),
    recompressPhoto = recompressBase64Photo,
    maxPayloadBytes = MAX_REPORT_PAYLOAD_BYTES,
    maxAttempts = MAX_RETRY_ATTEMPTS,
    baseBackoffMs = BASE_BACKOFF_MS,
    periodicFlushMs = PERIODIC_FLUSH_MS
  } = options;

  let activeFlush: Promise<{ delivered: number; failed: number; remaining: number }> | null = null;
  let periodicTimer: ReturnType<typeof setInterval> | null = null;
  let listenersAttached = false;

  const computeBackoffMs = (attempts: number): number =>
    Math.min(baseBackoffMs * Math.pow(2, Math.max(0, attempts - 1)), MAX_BACKOFF_MS);

  const runFlush = async (): Promise<{ delivered: number; failed: number; remaining: number }> => {
    const records = await store.list();
    if (!isOnline()) {
      return { delivered: 0, failed: 0, remaining: records.length };
    }

    const currentTime = now();
    let delivered = 0;
    let failed = 0;

    for (const record of records) {
      if (record.attempts >= maxAttempts || record.nextRetryAt > currentTime) {
        continue;
      }

      try {
        await transport.sendReport(record.report);
        await store.delete(record.id);
        delivered += 1;
      } catch (error) {
        const nextAttempts = record.attempts + 1;
        const message = error instanceof Error ? error.message : String(error);
        const updated: OutboxRecord = {
          ...record,
          attempts: nextAttempts,
          lastError: message,
          nextRetryAt:
            nextAttempts >= maxAttempts
              ? Number.MAX_SAFE_INTEGER
              : currentTime + computeBackoffMs(nextAttempts)
        };
        await store.put(updated);
        failed += 1;
      }
    }

    const remaining = (await store.list()).length;
    return { delivered, failed, remaining };
  };

  const flush = (): Promise<{ delivered: number; failed: number; remaining: number }> => {
    if (!activeFlush) {
      activeFlush = runFlush().finally(() => {
        activeFlush = null;
      });
    }
    return activeFlush;
  };

  const handleOnlineOrVisible = () => {
    if (isOnline() && (typeof document === 'undefined' || !document.hidden)) {
      void flush();
    }
  };

  return {
    async enqueue(rawReport: QueuedCatchReport) {
      const prepared = await prepareCatchReport(rawReport, recompressPhoto, maxPayloadBytes);
      const id =
        prepared.reportId ||
        `catch_${now()}_${Math.random().toString(36).slice(2, 10)}`;

      const record: OutboxRecord = {
        id,
        report: { ...prepared, reportId: id },
        attempts: 0,
        nextRetryAt: now(),
        createdAt: now()
      };

      await store.put(record);

      if (!isOnline()) {
        return { id, delivered: false, queuedOffline: true };
      }

      await flush();
      const stillQueued = (await store.list()).some((item) => item.id === id);
      return { id, delivered: !stillQueued, queuedOffline: stillQueued };
    },

    flush,

    async getStatus(): Promise<CatchOutboxStatus> {
      const records = await store.list();
      const failed = records.filter((r) => r.attempts >= maxAttempts).length;
      return {
        pending: records.length - failed,
        failed
      };
    },

    start() {
      if (listenersAttached || typeof window === 'undefined') return;
      listenersAttached = true;

      window.addEventListener('online', handleOnlineOrVisible);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', handleOnlineOrVisible);
      }

      periodicTimer = setInterval(() => {
        if (isOnline()) {
          void flush();
        }
      }, periodicFlushMs);

      if (isOnline()) {
        void flush();
      }
    },

    stop() {
      if (!listenersAttached || typeof window === 'undefined') return;
      listenersAttached = false;

      window.removeEventListener('online', handleOnlineOrVisible);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleOnlineOrVisible);
      }

      if (periodicTimer !== null) {
        clearInterval(periodicTimer);
        periodicTimer = null;
      }
    }
  };
}

/** Default app-wide outbox routing through IndexedDB (or memory fallback) and active transport. */
const defaultStore: OutboxStore =
  typeof indexedDB !== 'undefined' ? createIndexedDbOutboxStore() : createMemoryOutboxStore();

const modeAwareTransport: CatchTransport = {
  sendReport: (report) =>
    (isDemoMode() ? demoCatchTransport : httpCatchTransport).sendReport(report)
};

export const catchOutbox: CatchOutbox = createCatchOutbox({
  store: defaultStore,
  transport: modeAwareTransport
});
