import { describe, it, expect, beforeAll, vi } from 'vitest';
import { DefaultDownloaderOptions } from '@/store';
import { type NZBQueueItem, NZBGet } from '../NZBGet';

const downloaderOptions: typeof DefaultDownloaderOptions = {
  ...DefaultDownloaderOptions,
  Name: 'Test NZBGet',
  ApiUrl: import.meta.env.VITE_NZBGET_APIURL,
  Username: import.meta.env.VITE_NZBGET_USER,
  Password: import.meta.env.VITE_NZBGET_PASS,
}

let apiUrl: string | null;
let client: NZBGet;

beforeAll(async () => {
  apiUrl = (await NZBGet.findApiUrl(downloaderOptions))
    ?? downloaderOptions.ApiUrl;
  console.log('API URL:', apiUrl);
  client = new NZBGet({ ...downloaderOptions, ApiUrl: apiUrl });
});


describe('API discovery / constructor', async () => {
  it('generateApiUrlSuggestions', async () => {
    // Simple test, host should be set and should not be the same as the default
    expect(apiUrl).not.toBeNull();
    // Suggestions should be generated
    const suggestions = NZBGet.generateApiUrlSuggestions(downloaderOptions.ApiUrl!);
    expect(suggestions).not.toBeNull();
    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      expect(suggestion).toContain(downloaderOptions.ApiUrl!);
    }
  });

  it('construct', () => {
    expect(client).toBeInstanceOf(NZBGet);
    expect(client.type).toBe('NZBGet');
    expect(client.name).toBe('Test NZBGet');
    expect(client.url.includes(import.meta.env.VITE_NZBGET_APIURL)).toBeTruthy();
    expect(client.username).toBe(import.meta.env.VITE_NZBGET_USER);
    expect(client.password).toBe(import.meta.env.VITE_NZBGET_PASS);
    expect(client.urlParsed).not.toBeNull();
  });
});


// Note, the following tests will fail if nzbget instance is not running

// abstract call(operation: string, params: Dictionary|Array<any>): Promise<NZBResult>;
describe('General', async () => {
  it.only('call', async () => {
    const res = await client.call('status');

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
    expect(res).toHaveProperty('result.UpTimeSec');
  });

  // abstract test(): Promise<NZBResult>;
  it('test', async () => {
    const response = await client.test();

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();
  });


  // abstract getCategories(): Promise<string[]>;
  it('getCategories', async () => {
    const response = await client.getCategories();

    expect(response).not.toBeNull();
    expect(Array.isArray(response)).toBe(true);
  });

  // abstract setMaxSpeed(bytes: number): Promise<NZBResult>;
  it('setMaxSpeed', async () => {
    const response = await client.setMaxSpeed(75);

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();
  });

  // abstract getQueue(): Promise<NZBQueueResult>;
  it('getQueue', async () => {
    const response = await client.getQueue();

    expect(response).not.toBeNull();
    expect(response).toHaveProperty('queue');
    expect(Array.isArray(response.queue)).toBe(true);
  });
});

// abstract resumeQueue(): Promise<NZBResult>;
// abstract pauseQueue(): Promise<NZBResult>;
describe('Queue', async () => {
  it('Can pause queue', async () => {
    const response = await client.pauseQueue();

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();

    const queue = await client.getQueue();

    expect(queue.status).not.toBeNull();
  });

  it('Can resume queue', async () => {
    const response = await client.resumeQueue();

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();

    const queue = await client.getQueue();

    expect(queue.status).not.toBe('Paused');
  });
});

describe('Queue items', () => {
  let id: string;
  let item: NZBQueueItem;

  it('Adds NZB by URL', async () => {
    // abstract addUrl(url: string, options: NZBAddOptions): Promise<NZBAddUrlResult>;
    const res = await client.addUrl(
      import.meta.env.VITE_NZB_URL,
      {
        category: 'download',
        name: 'Test NZB',
      },
    );

    id = res.result as string;
    item = (await client.getQueue()).queue.find(item => item.id === id);

    expect(res).not.toBeNull();
    expect(id.length).toBeTruthy();
  });

  it('Can pause queue item', async () => {
    // abstract pauseId(id: string): Promise<NZBResult>;
    // abstract pauseItem(id: NZBQueueItem): Promise<NZBResult>;
    // note, pauseItem uses pauseId internally
    const response = await client.pauseItem(item);

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();

    item = (await client.getQueue()).queue.find(item => item.id === id);
  });

  it('Can resume queue item', async () => {
    // abstract resumeId(id: string): Promise<NZBResult>;
    // abstract resumeItem(id: NZBQueueItem): Promise<NZBResult>;
    const response = await client.resumeItem(item);

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();

    item = (await client.getQueue()).queue.find(item => item.id === id);
  });

  it('Can remove queue item', async () => {
    // abstract removeId(id: string): Promise<NZBResult>;
    // abstract removeItem(id: NZBQueueItem): Promise<NZBResult>;
    const response = await client.removeItem(item);

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();
  });

  // This does not work from the node context, figure it out
  it.todo('Adds NZB by file upload, paused');
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
