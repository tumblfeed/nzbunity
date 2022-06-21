// import { readFileSync } from 'fs';
import { NZBQueueItem, NZBGetHost } from './NZBGetHost';

const host = new NZBGetHost({
  displayName: 'Test NZBGet',
  host: process.env.NZBGET_HOST,
  username: process.env.NZBGET_USERNAME,
  password: process.env.NZBGET_PASSWORD,
});

describe('nzb/NZBGetHost::construct', () => {
  it('Constructor works', () => {
    expect(host).toBeInstanceOf(NZBGetHost);
    expect(host.name).toBe('NZBGet');
    expect(host.displayName).toBe('Test NZBGet');
    expect(host.host).toBe(process.env.NZBGET_HOST);
    expect(host.username).toBe(process.env.NZBGET_USERNAME);
    expect(host.hostParsed).not.toBeNull();
  });
});

// Note, the following tests will fail if sab instance is not running

// abstract call(operation: string, params: Dictionary|Array<any>): Promise<NZBResult>;
describe('nzb/NZBGetHost::call', () => {
  it('Can make a request to NZBGet', async () => {
    const res = await host.call('status');

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
    expect(res).toHaveProperty('result.UpTimeSec');
  });
});

// abstract getCategories(): Promise<string[]>;
describe('nzb/NZBGetHost::getCategories', () => {
  it('Returns expected value', async () => {
    const response = await host.getCategories();

    expect(response).not.toBeNull();
    expect(Array.isArray(response)).toBe(true);
  });
});

// abstract setMaxSpeed(bytes: number): Promise<NZBResult>;
describe('nzb/NZBGetHost::setMaxSpeed', () => {
  it('Returns expected value', async () => {
    const response = await host.setMaxSpeed(75);

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();
  });
});

// abstract getQueue(): Promise<NZBQueueResult>;
describe('nzb/NZBGetHost::getQueue', () => {
  it('Returns expected value', async () => {
    const response = await host.getQueue();

    expect(response).not.toBeNull();
    expect(response).toHaveProperty('queue');
    expect(Array.isArray(response.queue)).toBe(true);
  });
});

// abstract resumeQueue(): Promise<NZBResult>;
// abstract pauseQueue(): Promise<NZBResult>;
describe('nzb/NZBGetHost::pauseQueue / resumeQueue', () => {
  it('Can pause queue', async () => {
    const response = await host.pauseQueue();

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();

    const queue = await host.getQueue();

    expect(queue.status).not.toBeNull();
  });

  it('Can resume queue', async () => {
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

  it('Adds NZB by URL', async () => {
    // abstract addUrl(url: string, options: NZBAddOptions): Promise<NZBAddUrlResult>;
    const response = await host.addUrl(process.env.NZB_URL, {
      category: 'download',
      name: 'Test NZB',
    });

    id = response.result as string;
    item = (await host.getQueue()).queue.find(item => item.id === id);

    expect(response).not.toBeNull();
    expect(id.length).toBeTruthy();
  });

  it('Can pause queue item', async () => {
    // abstract pauseId(id: string): Promise<NZBResult>;
    // abstract pauseItem(id: NZBQueueItem): Promise<NZBResult>;
    // note, pauseItem uses pauseId internally
    const response = await host.pauseItem(item);

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();

    item = (await host.getQueue()).queue.find(item => item.id === id);
  });

  it('Can resume queue item', async () => {
    // abstract resumeId(id: string): Promise<NZBResult>;
    // abstract resumeItem(id: NZBQueueItem): Promise<NZBResult>;
    const response = await host.resumeItem(item);

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();

    item = (await host.getQueue()).queue.find(item => item.id === id);
  });

  it('Can remove queue item', async () => {
    // abstract removeId(id: string): Promise<NZBResult>;
    // abstract removeItem(id: NZBQueueItem): Promise<NZBResult>;
    const response = await host.removeItem(item);

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

// abstract test(): Promise<NZBResult>;
describe('nzb/NZBGetHost::test', () => {
  it('Can construct a NZBGet host', async () => {
    const response = await host.test();

    expect(response).not.toBeNull();
    expect(response.success).toBeTruthy();
  });
});
