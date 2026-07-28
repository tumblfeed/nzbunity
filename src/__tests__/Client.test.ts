import { describe, it, expect, vi } from 'vitest';
import { Client } from '../Client';
import {
  Downloader,
  DefaultNZBQueue,
  DefaultNZBQueueItem,
  type NZBQueue,
  type NZBQueueItem,
  type NZBResult,
  type NZBAddUrlResult,
} from '../downloader';
import { DownloaderType, type DownloaderOptions } from '../store';

/**
 * A minimal in-memory Downloader used to drive Client's refresh/completion
 * logic without hitting a real SABnzbd/NZBGet instance.
 */
class FakeDownloader extends Downloader {
  queueResult: NZBQueue = { ...DefaultNZBQueue, queue: [] };
  historyResult: NZBQueueItem[] = [];

  async call(): Promise<NZBResult> {
    return { success: true };
  }
  async getCategories(): Promise<string[]> {
    return [];
  }
  async setMaxSpeed(): Promise<NZBResult> {
    return { success: true };
  }
  async getHistory(): Promise<NZBQueueItem[]> {
    return this.historyResult;
  }
  async getQueue(): Promise<NZBQueue> {
    return this.queueResult;
  }
  async pauseQueue(): Promise<NZBResult> {
    return { success: true };
  }
  async resumeQueue(): Promise<NZBResult> {
    return { success: true };
  }
  async addUrl(): Promise<NZBAddUrlResult> {
    return { success: true };
  }
  async addFile(): Promise<NZBAddUrlResult> {
    return { success: true };
  }
  async removeId(): Promise<NZBResult> {
    return { success: true };
  }
  async removeItem(): Promise<NZBResult> {
    return { success: true };
  }
  async pauseId(): Promise<NZBResult> {
    return { success: true };
  }
  async pauseItem(): Promise<NZBResult> {
    return { success: true };
  }
  async resumeId(): Promise<NZBResult> {
    return { success: true };
  }
  async resumeItem(): Promise<NZBResult> {
    return { success: true };
  }
  async test(): Promise<NZBResult> {
    return { success: true };
  }
}

function makeItem(id: string, overrides: Partial<NZBQueueItem> = {}): NZBQueueItem {
  return { ...DefaultNZBQueueItem, id, name: `Item ${id}`, ...overrides };
}

/**
 * Build a Client instance wired directly to a FakeDownloader, bypassing the
 * async store-driven downloader resolution (and the singleton) so tests are
 * fast, isolated, and don't depend on storage.
 */
function makeClient(): { client: Client; downloader: FakeDownloader } {
  const client = new Client(false); // Don't auto-start the refresh timer
  const downloader = new FakeDownloader({
    Type: DownloaderType.SABnzbd,
    ApiUrl: 'http://localhost/api',
  } as DownloaderOptions);

  // These assignments run synchronously, before the constructor's dangling
  // getActiveDownloader() promise can resolve and touch _syncDownloader.
  client._syncDownloader = downloader;
  client._downloader = Promise.resolve(downloader);

  return { client, downloader };
}

describe('Client completion detection', () => {
  it('does not fire completion listeners on the very first refresh', async () => {
    const { client, downloader } = makeClient();
    downloader.queueResult = { ...DefaultNZBQueue, queue: [makeItem('1')] };

    const listener = vi.fn();
    client.addCompletionListener(listener);

    await client.refresh();

    expect(listener).not.toHaveBeenCalled();
  });

  it('fires a success completion when a queued item completes', async () => {
    const { client, downloader } = makeClient();
    const listener = vi.fn();
    client.addCompletionListener(listener);

    downloader.queueResult = {
      ...DefaultNZBQueue,
      queue: [makeItem('1'), makeItem('2')],
    };
    await client.refresh(); // seed previous ids, no notification expected

    downloader.queueResult = { ...DefaultNZBQueue, queue: [makeItem('2')] }; // '1' left the queue
    downloader.historyResult = [makeItem('1', { status: 'Completed' })];
    await client.refresh();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', status: 'Completed' }),
      true,
    );
  });

  it('fires a failure completion when history reports a failed download', async () => {
    const { client, downloader } = makeClient();
    const listener = vi.fn();
    client.addCompletionListener(listener);

    downloader.queueResult = { ...DefaultNZBQueue, queue: [makeItem('1')] };
    await client.refresh();

    downloader.queueResult = { ...DefaultNZBQueue, queue: [] };
    downloader.historyResult = [makeItem('1', { status: 'Failed' })];
    await client.refresh();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', status: 'Failed' }),
      false,
    );
  });

  it('assumes success when the finished item has no matching history entry', async () => {
    const { client, downloader } = makeClient();
    const listener = vi.fn();
    client.addCompletionListener(listener);

    downloader.queueResult = { ...DefaultNZBQueue, queue: [makeItem('1')] };
    await client.refresh();

    downloader.queueResult = { ...DefaultNZBQueue, queue: [] };
    downloader.historyResult = []; // Downloader has no history support / entry missing
    await client.refresh();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), true);
  });

  it('does not fire for items still present in the queue', async () => {
    const { client, downloader } = makeClient();
    const listener = vi.fn();
    client.addCompletionListener(listener);

    downloader.queueResult = { ...DefaultNZBQueue, queue: [makeItem('1')] };
    await client.refresh();

    // Same item, still downloading (e.g. percentage changed)
    downloader.queueResult = {
      ...DefaultNZBQueue,
      queue: [makeItem('1', { percentage: 50 })],
    };
    await client.refresh();

    expect(listener).not.toHaveBeenCalled();
  });

  it('fires once per item when multiple items finish in the same refresh', async () => {
    const { client, downloader } = makeClient();
    const listener = vi.fn();
    client.addCompletionListener(listener);

    downloader.queueResult = {
      ...DefaultNZBQueue,
      queue: [makeItem('1'), makeItem('2'), makeItem('3')],
    };
    await client.refresh();

    downloader.queueResult = { ...DefaultNZBQueue, queue: [makeItem('3')] };
    downloader.historyResult = [
      makeItem('1', { status: 'Completed' }),
      makeItem('2', { status: 'Failed' }),
    ];
    await client.refresh();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), true);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }), false);
  });

  it('passes through a failure reason from history, when present', async () => {
    const { client, downloader } = makeClient();
    const listener = vi.fn();
    client.addCompletionListener(listener);

    downloader.queueResult = { ...DefaultNZBQueue, queue: [makeItem('1')] };
    await client.refresh();

    downloader.queueResult = { ...DefaultNZBQueue, queue: [] };
    downloader.historyResult = [
      makeItem('1', { status: 'Failed', message: 'Par verification failed' }),
    ];
    await client.refresh();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', message: 'Par verification failed' }),
      false,
    );
  });

  it('stops notifying a removed listener', async () => {
    const { client, downloader } = makeClient();
    const listener = vi.fn();
    client.addCompletionListener(listener);
    client.removeCompletionListener(listener);

    downloader.queueResult = { ...DefaultNZBQueue, queue: [makeItem('1')] };
    await client.refresh();

    downloader.queueResult = { ...DefaultNZBQueue, queue: [] };
    downloader.historyResult = [makeItem('1', { status: 'Completed' })];
    await client.refresh();

    expect(listener).not.toHaveBeenCalled();
  });
});
