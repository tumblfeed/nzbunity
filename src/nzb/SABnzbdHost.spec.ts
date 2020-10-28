// import { readFileSync } from 'fs';
import { NZBQueueItem } from '.';
import { SABnzbdHost } from './SABnzbdHost';
import * as env from '../../.env.json'

// Queue operations need a little time in between or then don't work
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
jest.setTimeout(15000);

let host: SABnzbdHost;

beforeAll(() => {
  host = new SABnzbdHost({
    displayName: 'Test SAB',
    host: env.SABnzbd.host,
    hostAsEntered: env.SABnzbd.hostAsEntered,
    apikey: env.SABnzbd.apikey,
  });
});

describe('nzb/SABnzbdHost::construct', () => {
  test('Constructor works', () => {
    expect(host).toBeInstanceOf(SABnzbdHost);
    expect(host.name).toBe('SABnzbd');
    expect(host.displayName).toBe('Test SAB');
    expect(host.host).toBe(env.SABnzbd.host);
    expect(host.apikey).toBe(env.SABnzbd.apikey);
    expect(host.hostParsed).not.toBeNull();
  });
});

// Note, the following tests will fail if sab instance is not running

// abstract call(operation: string, params: Dictionary|Array<any>): Promise<NZBResult>;
describe('nzb/SABnzbdHost::call', () => {
  test('Can make a request to SABnzbd', async () => {
    expect.assertions(3);

    const res = await host.call('fullstatus', { skip_dashboard: 1 });

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
    expect(res).toHaveProperty('result.pid');
  });
});

// abstract test(): Promise<NZBResult>;
describe('nzb/SABnzbdHost::test', () => {
  test('Can construct a SABnzbd host', async () => {
    expect.assertions(2);

    const res = await host.test();

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
  });
});

// abstract getCategories(): Promise<string[]>;
describe('nzb/SABnzbdHost::getCategories', () => {
  test('Returns expected value', async () => {
    expect.assertions(2);

    const res = await host.getCategories();

    expect(res).not.toBeNull();
    expect(Array.isArray(res)).toBe(true);
  });
});

// abstract setMaxSpeed(bytes: number): Promise<NZBResult>;
describe('nzb/SABnzbdHost::setMaxSpeed', () => {
  test('Returns expected value', async () => {
    expect.assertions(2);

    const res = await host.setMaxSpeed(45000000);

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
  });
});

// abstract getQueue(): Promise<NZBQueueResult>;
describe('nzb/SABnzbdHost::getQueue', () => {
  test('Returns expected value', async () => {
    expect.assertions(3);

    const res = await host.getQueue();

    expect(res).not.toBeNull();
    expect(res).toHaveProperty('queue');
    expect(Array.isArray(res.queue)).toBe(true);
  });
});

// abstract resumeQueue(): Promise<NZBResult>;
// abstract pauseQueue(): Promise<NZBResult>;
describe('nzb/SABnzbdHost::pauseQueue / resumeQueue', () => {
  test('Can pause queue', async () => {
    expect.assertions(3);

    const res = await host.pauseQueue();

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();

    const queue = await host.getQueue();

    expect(queue.status).toBe('Paused');
  });

  test('Can resume queue', async () => {
    expect.assertions(3);

    const res = await host.resumeQueue();

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();

    const queue = await host.getQueue();

    expect(queue.status).not.toBe('Paused');
  });
});

describe('Queue manipulation', () => {
  let id: string;
  let item: NZBQueueItem;

  test('Adds NZB by URL', async () => {
    expect.assertions(2);

    // abstract addUrl(url: string, options: NZBAddOptions): Promise<NZBAddUrlResult>;
    const res = await host.addUrl(
      env.nzb.url,
      {
        category: 'download',
        name: 'Test NZB'
      },
    );

    id = res.result as string;
    item = (await host.getQueue()).queue.find((item) => item.id === id);

    expect(res).not.toBeNull();
    expect(id.length).toBeTruthy();
  });

  test('Can pause queue item', async () => {
    expect.assertions(2);

    await sleep(500); // wait for previous ops

    // abstract pauseId(id: string): Promise<NZBResult>;
    // abstract pauseItem(id: NZBQueueItem): Promise<NZBResult>;
    // note, pauseItem uses pauseId internally
    const res = await host.pauseItem(item);

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();

    item = (await host.getQueue()).queue.find((item) => item.id === id);
  });

  test('Can resume queue item', async () => {
    expect.assertions(2);

    await sleep(1000); // wait for previous ops

    // abstract resumeId(id: string): Promise<NZBResult>;
    // abstract resumeItem(id: NZBQueueItem): Promise<NZBResult>;
    const res = await host.resumeItem(item);

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();

    item = (await host.getQueue()).queue.find((item) => item.id === id);
  });

  test('Can remove queue item', async () => {
    expect.assertions(2);

    await sleep(1500); // wait for previous ops

    // abstract removeId(id: string): Promise<NZBResult>;
    // abstract removeItem(id: NZBQueueItem): Promise<NZBResult>;
    const res = await host.removeItem(item);

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
  });

  // TODO: This does not work from the node context, figure it out
  // test('Adds NZB by file upload, paused', async () => {
  //   expect.assertions(2);

  //   await sleep(2000); // wait for previous ops

  //   const content = readFileSync(env.nzb.file);

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
