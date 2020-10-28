// import { readFileSync } from 'fs';
import { NZBQueueItem } from '.';
import { NZBGetHost } from './NZBGetHost';
import * as env from '../../.env.json'

// Queue operations need a little time in between or then don't work
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
jest.setTimeout(15000);

let host: NZBGetHost;

beforeAll(() => {
  host = new NZBGetHost({
    displayName: 'Test NZBGet',
    host: env.NZBGet.host,
    hostAsEntered: env.NZBGet.hostAsEntered,
    username: env.NZBGet.username,
    password: env.NZBGet.password,
  });
});

describe('nzb/NZBGetHost::construct', () => {
  test('Constructor works', () => {
    expect(host).toBeInstanceOf(NZBGetHost);
    expect(host.name).toBe('NZBGet');
    expect(host.displayName).toBe('Test NZBGet');
    expect(host.host).toBe(env.NZBGet.host);
    expect(host.username).toBe(env.NZBGet.username);
    expect(host.hostParsed).not.toBeNull();
  });
});

// Note, the following tests will fail if sab instance is not running

// abstract call(operation: string, params: Dictionary|Array<any>): Promise<NZBResult>;
describe('nzb/NZBGetHost::call', () => {
  test('Can make a request to NZBGet', async () => {
    expect.assertions(3);

    const res = await host.call('status');

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
    expect(res).toHaveProperty('result.UpTimeSec');
  });
});

// abstract getCategories(): Promise<string[]>;
describe('nzb/NZBGetHost::getCategories', () => {
  test('Returns expected value', async () => {
    expect.assertions(2);

    const response = await host.getCategories();

    expect(response).not.toBeNull();
    expect(Array.isArray(response)).toBe(true);
  });
});

// abstract setMaxSpeed(bytes: number): Promise<NZBResult>;
describe('nzb/NZBGetHost::setMaxSpeed', () => {
  test('Returns expected value', async () => {
    expect.assertions(2);

    const response = await host.setMaxSpeed(75);

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();
  });
});

// abstract getQueue(): Promise<NZBQueueResult>;
describe('nzb/NZBGetHost::getQueue', () => {
  test('Returns expected value', async () => {
    expect.assertions(3);

    const response = await host.getQueue();

    expect(response).not.toBeNull();
    expect(response).toHaveProperty('queue');
    expect(Array.isArray(response.queue)).toBe(true);
  });
});

// abstract resumeQueue(): Promise<NZBResult>;
// abstract pauseQueue(): Promise<NZBResult>;
describe('nzb/NZBGetHost::pauseQueue / resumeQueue', () => {
  test('Can pause queue', async () => {
    expect.assertions(3);

    const response = await host.pauseQueue();

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();

    const queue = await host.getQueue();

    expect(queue.status).not.toBeNull();
  });

  test('Can resume queue', async () => {
    expect.assertions(3);

    const response = await host.resumeQueue();

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();

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
    const response = await host.addUrl(
      env.nzb.url,
      {
        category: 'download',
        name: 'Test NZB'
      },
    );

    id = response.result as string;
    item = (await host.getQueue()).queue.find((item) => item.id === id);

    expect(response).not.toBeNull();
    expect(id.length).toBeTruthy();
  });

  test('Can pause queue item', async () => {
    expect.assertions(2);

    await sleep(1000); // wait for previous ops

    // abstract pauseId(id: string): Promise<NZBResult>;
    // abstract pauseItem(id: NZBQueueItem): Promise<NZBResult>;
    // note, pauseItem uses pauseId internally
    const response = await host.pauseItem(item);

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();

    item = (await host.getQueue()).queue.find((item) => item.id === id);
  });

  test('Can resume queue item', async () => {
    expect.assertions(2);

    await sleep(2000); // wait for previous ops

    // abstract resumeId(id: string): Promise<NZBResult>;
    // abstract resumeItem(id: NZBQueueItem): Promise<NZBResult>;
    const response = await host.resumeItem(item);

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();

    item = (await host.getQueue()).queue.find((item) => item.id === id);
  });

  test('Can remove queue item', async () => {
    expect.assertions(2);

    await sleep(3000); // wait for previous ops

    // abstract removeId(id: string): Promise<NZBResult>;
    // abstract removeItem(id: NZBQueueItem): Promise<NZBResult>;
    const response = await host.removeItem(item);

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();
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

// abstract test(): Promise<NZBResult>;
describe('nzb/NZBGetHost::test', () => {
  test('Can construct a NZBGet host', async () => {
    expect.assertions(2);

    const response = await host.test();

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();
  });
});
