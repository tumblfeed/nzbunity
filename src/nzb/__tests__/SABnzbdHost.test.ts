import { describe, it, expect, beforeAll, vi } from 'vitest';
import { DefaultDownloaderOptions } from '@/store';
import { type NZBQueueItem, SABnzbdHost } from '../SABnzbdHost';

// Queue operations need a little time in between or then don't work
vi.setConfig({ testTimeout: 15000 });

const downloaderOptions = {
  ...DefaultDownloaderOptions,
  Name: 'Test SAB',
  Host: import.meta.env.VITE_SABNZBD_HOST,
  ApiKey: import.meta.env.VITE_SABNZBD_APIKEY,
}

let hostUrl: string | null;
let host: SABnzbdHost;

beforeAll(async () => {
  hostUrl = await SABnzbdHost.findApiUrl(downloaderOptions);

  console.log(hostUrl);

  host = new SABnzbdHost({
    displayName: 'Test SAB',
    host: hostUrl,
    apikey: downloaderOptions.ApiKey,
  });
});

describe('API discovery / constructor', async () => {
  it('generateApiUrlSuggestions', async () => {
    // Simple test, host should be set and should not be the same as the default
    expect(hostUrl).not.toBeNull();
    // Suggestions should be generated
    const suggestions = SABnzbdHost.generateApiUrlSuggestions(downloaderOptions.Host!);
    expect(suggestions).not.toBeNull();
    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      expect(suggestion).toContain(downloaderOptions.Host!);
    }
  });

  it('construct', () => {
    expect(host).toBeInstanceOf(SABnzbdHost);
    expect(host.name).toBe('SABnzbd');
    expect(host.displayName).toBe('Test SAB');
    expect(host.host.includes(import.meta.env.VITE_SABNZBD_HOST)).toBeTruthy();
    expect(host.apikey).toBe(import.meta.env.VITE_SABNZBD_APIKEY);
    expect(host.hostParsed).not.toBeNull();
  });
});

  // Note, the following tests will fail if sab instance is not running

describe('General', async () => {
  it('call', async () => {
    const res = await host.call('fullstatus', { skip_dashboard: 1 });

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
    expect(res).toHaveProperty('result.pid');
  });

  // abstract test(): Promise<NZBResult>;
  it('test', async () => {
    const res = await host.test();

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
  });

  // abstract getCategories(): Promise<string[]>;
  it('getCategories', async () => {
    const res = await host.getCategories();

    expect(res).not.toBeNull();
    expect(Array.isArray(res)).toBe(true);
  });

  // abstract setMaxSpeed(bytes: number): Promise<NZBResult>;
  it('setMaxSpeed', async () => {
    const res = await host.setMaxSpeed(45000000);

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
  });

  // abstract getQueue(): Promise<NZBQueueResult>;
  it('getQueue', async () => {
    const res = await host.getQueue();

    expect(res).not.toBeNull();
    expect(res).toHaveProperty('queue');
    expect(Array.isArray(res.queue)).toBe(true);
  });
});

// abstract resumeQueue(): Promise<NZBResult>;
// abstract pauseQueue(): Promise<NZBResult>;
describe('Queue', async () => {
  it('Can pause queue', async () => {
    const res = await host.pauseQueue();

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();

    const queue = await host.getQueue();

    expect(queue.status).toBe('Paused');
  });

  it('Can resume queue', async () => {
    const res = await host.resumeQueue();

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();

    const queue = await host.getQueue();

    expect(queue.status).not.toBe('Paused');
  });
});

describe('Queue items', async () => {
  let id: string | undefined;
  let item: NZBQueueItem | undefined;

  it('Adds NZB by URL', async () => {
    // abstract addUrl(url: string, options: NZBAddOptions): Promise<NZBAddUrlResult>;
    const res = await host.addUrl(
      import.meta.env.VITE_NZB_URL,
      {
        category: 'download',
        name: 'Test NZB',
      },
    );

    id = res.result as string;
    item = (await host.getQueue()).queue.find(item => item.id === id);

    expect(res).not.toBeNull();
    expect(id.length).toBeTruthy();
  });

  it('Can pause queue item', async () => {
    // abstract pauseId(id: string): Promise<NZBResult>;
    // abstract pauseItem(id: NZBQueueItem): Promise<NZBResult>;
    // note, pauseItem uses pauseId internally
    const res = await host.pauseItem(item!);

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();

    item = (await host.getQueue()).queue.find(item => item.id === id);
  });

  it('Can resume queue item', async () => {
    // abstract resumeId(id: string): Promise<NZBResult>;
    // abstract resumeItem(id: NZBQueueItem): Promise<NZBResult>;
    const res = await host.resumeItem(item!);

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();

    item = (await host.getQueue()).queue.find(item => item.id === id);
  });

  it('Can remove queue item', async () => {
    // abstract removeId(id: string): Promise<NZBResult>;
    // abstract removeItem(id: NZBQueueItem): Promise<NZBResult>;
    const res = await host.removeItem(item!);

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
  });

  // This does not work from the node context, figure it out
  // it.todo('Adds NZB by file upload, paused');
  // test('Adds NZB by file upload, paused', async () => {
  //     //   const content = readFileSync(env.nzb.file);

  //   // abstract addFile(filename: string, content: string, options: NZBAddOptions): Promise<NZBAddUrlResult>;
  //   const response = await host.addFile(
  //     'testnzb.nzb',
  //     content,
  //     {
  //       category: 'download',
  //       name: 'Test NZB',
  //       paused: true,
  //     },
  //   );

  // });
});
