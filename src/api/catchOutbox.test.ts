import { describe, it, expect, vi } from 'vitest';
import {
  createCatchOutbox,
  createMemoryOutboxStore,
  PayloadTooLargeError,
  type CatchTransport,
  type QueuedCatchReport
} from './catchOutbox';

const makeReport = (overrides: Partial<QueuedCatchReport> = {}): QueuedCatchReport => ({
  tripId: 'trip-101',
  reportId: 'report-1',
  date: new Date('2026-09-15T10:00:00Z'),
  noCatch: false,
  imei: '861508035295419',
  username: 'kito',
  catches: [
    {
      id: 'entry-1',
      fishGroup: 'reef fish',
      quantity: 12,
      photos: [],
      gps_photo: []
    }
  ],
  ...overrides
});

describe('CatchOutbox', () => {
  it('delivers immediately when online and leaves the outbox empty', async () => {
    const store = createMemoryOutboxStore();
    const sent: QueuedCatchReport[] = [];
    const transport: CatchTransport = {
      sendReport: vi.fn(async (report) => {
        sent.push(report);
        return [];
      })
    };

    const outbox = createCatchOutbox({ store, transport, isOnline: () => true });
    const outcome = await outbox.enqueue(makeReport());

    expect(outcome).toEqual({ id: 'report-1', delivered: true, queuedOffline: false });
    expect(sent).toHaveLength(1);
    expect(await store.list()).toEqual([]);
    expect(await outbox.getStatus()).toEqual({ pending: 0, failed: 0 });
  });

  it('queues durably while offline and delivers once back online', async () => {
    let online = false;
    const store = createMemoryOutboxStore();
    const transport: CatchTransport = {
      sendReport: vi.fn(async () => [])
    };

    const outbox = createCatchOutbox({ store, transport, isOnline: () => online });

    const queued = await outbox.enqueue(makeReport());
    expect(queued).toEqual({ id: 'report-1', delivered: false, queuedOffline: true });
    expect(transport.sendReport).not.toHaveBeenCalled();
    expect(await outbox.getStatus()).toEqual({ pending: 1, failed: 0 });

    online = true;
    const flushed = await outbox.flush();
    expect(flushed).toEqual({ delivered: 1, failed: 0, remaining: 0 });
    expect(transport.sendReport).toHaveBeenCalledTimes(1);
    expect(await store.list()).toEqual([]);
  });

  it('persists exponential backoff on transient failures and retries once due', async () => {
    let clock = 1_000_000;
    let shouldFail = true;
    const store = createMemoryOutboxStore();
    const transport: CatchTransport = {
      sendReport: vi.fn(async () => {
        if (shouldFail) throw new Error('503 Service Unavailable');
        return [];
      })
    };

    const outbox = createCatchOutbox({
      store,
      transport,
      now: () => clock,
      isOnline: () => true,
      baseBackoffMs: 5_000
    });

    const outcome = await outbox.enqueue(makeReport());
    expect(outcome.delivered).toBe(false);
    expect(outcome.queuedOffline).toBe(true);

    // Immediately flushing again must respect nextRetryAt instead of hammering the server.
    const tooEarly = await outbox.flush();
    expect(tooEarly).toEqual({ delivered: 0, failed: 0, remaining: 1 });
    expect(transport.sendReport).toHaveBeenCalledTimes(1);

    // Advance past the 5s first backoff window -> still failing -> next backoff doubles to 10s.
    clock += 5_000;
    const secondAttempt = await outbox.flush();
    expect(secondAttempt).toEqual({ delivered: 0, failed: 1, remaining: 1 });
    const [persisted] = await store.list();
    expect(persisted.attempts).toBe(2);
    expect(persisted.nextRetryAt).toBe(clock + 10_000);

    // Advance past 10s backoff window and recover network.
    shouldFail = false;
    clock += 10_000;
    const recovered = await outbox.flush();
    expect(recovered).toEqual({ delivered: 1, failed: 0, remaining: 0 });
    expect(await store.list()).toEqual([]);
  });

  it('deduplicates concurrent flush calls so one report is never double-sent', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const store = createMemoryOutboxStore();
    let online = false;
    const transport: CatchTransport = {
      sendReport: vi.fn(async () => {
        await gate;
        return [];
      })
    };

    const outbox = createCatchOutbox({ store, transport, isOnline: () => online });
    await outbox.enqueue(makeReport());

    online = true;
    const first = outbox.flush();
    const second = outbox.flush();
    release();

    await Promise.all([first, second]);
    expect(transport.sendReport).toHaveBeenCalledTimes(1);
  });

  it('recompresses oversized photos asynchronously and preserves them', async () => {
    const store = createMemoryOutboxStore();
    const received: QueuedCatchReport[] = [];
    const transport: CatchTransport = {
      sendReport: vi.fn(async (report) => {
        received.push(report);
        return [];
      })
    };

    const bigPhoto = `data:image/jpeg;base64,${'A'.repeat(2_000)}`;
    const recompressPhoto = vi.fn(async (_photo: string, maxDim: number) =>
      `data:image/jpeg;base64,${'B'.repeat(maxDim <= 700 ? 100 : 2_000)}`
    );

    const outbox = createCatchOutbox({
      store,
      transport,
      isOnline: () => true,
      recompressPhoto,
      maxPayloadBytes: 1_000
    });

    const gps = [{ latitude: -4.4, longitude: 39.6, accuracy: 10, timestamp: '2026-09-15T10:00:00Z' }];
    await outbox.enqueue(
      makeReport({
        catches: [
          {
            id: 'entry-1',
            fishGroup: 'reef fish',
            quantity: 5,
            photos: [bigPhoto],
            gps_photo: gps
          }
        ]
      })
    );

    expect(recompressPhoto).toHaveBeenCalledWith(bigPhoto, 700, 0.65);
    expect(received[0].catches[0].photos).toHaveLength(1);
    expect(received[0].catches[0].gps_photo).toEqual(gps);
  });

  it('rejects with PayloadTooLargeError instead of silently dropping photos when still oversized', async () => {
    const store = createMemoryOutboxStore();
    const transport: CatchTransport = {
      sendReport: vi.fn(async () => [])
    };

    const hugePhoto = `data:image/jpeg;base64,${'X'.repeat(2_000)}`;
    const recompressPhoto = vi.fn(async (photo: string) => photo);

    const outbox = createCatchOutbox({
      store,
      transport,
      isOnline: () => true,
      recompressPhoto,
      maxPayloadBytes: 500
    });

    await expect(
      outbox.enqueue(
        makeReport({
          catches: [
            {
              id: 'entry-1',
              fishGroup: 'reef fish',
              quantity: 5,
              photos: [hugePhoto],
              gps_photo: []
            }
          ]
        })
      )
    ).rejects.toBeInstanceOf(PayloadTooLargeError);

    expect(await store.list()).toEqual([]);
    expect(transport.sendReport).not.toHaveBeenCalled();
  });

  it('marks a record failed once max retry attempts are exhausted', async () => {
    let clock = 10_000;
    const store = createMemoryOutboxStore();
    const transport: CatchTransport = {
      sendReport: vi.fn(async () => {
        throw new Error('Server error');
      })
    };

    const outbox = createCatchOutbox({
      store,
      transport,
      now: () => clock,
      isOnline: () => true,
      maxAttempts: 2,
      baseBackoffMs: 1_000
    });

    await outbox.enqueue(makeReport());
    clock += 1_000;
    await outbox.flush();

    expect(await outbox.getStatus()).toEqual({ pending: 0, failed: 1 });

    clock += 10_000_000;
    await outbox.flush();
    expect(transport.sendReport).toHaveBeenCalledTimes(2);
  });
});
