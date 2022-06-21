// import { readFileSync } from 'fs';
import { NZBQueueItem, SABnzbdHost } from './SABnzbdHost';

// Queue operations need a little time in between or then don't work
jest.setTimeout(15000);

const host = new SABnzbdHost({
  displayName: 'Test SAB',
  host: process.env.SABNZBD_HOST,
  apikey: process.env.SABNZBD_APIKEY,
});

describe('nzb/SABnzbdHost::construct', () => {
  it('Constructor works', () => {
    expect(host).toBeInstanceOf(SABnzbdHost);
    expect(host.name).toBe('SABnzbd');
    expect(host.displayName).toBe('Test SAB');
    expect(host.host).toBe(process.env.SABNZBD_HOST);
    expect(host.apikey).toBe(process.env.SABNZBD_APIKEY);
    expect(host.hostParsed).not.toBeNull();
  });
});

// Note, the following tests will fail if sab instance is not running

// abstract call(operation: string, params: Dictionary|Array<any>): Promise<NZBResult>;
describe('nzb/SABnzbdHost::call', () => {
  it('Can make a request to SABnzbd', async () => {
    const res = await host.call('fullstatus', { skip_dashboard: 1 });

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
    expect(res).toHaveProperty('result.pid');
  });
});

// abstract test(): Promise<NZBResult>;
describe('nzb/SABnzbdHost::test', () => {
  it('Can construct a SABnzbd host', async () => {
    const res = await host.test();

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
  });
});

// abstract getCategories(): Promise<string[]>;
describe('nzb/SABnzbdHost::getCategories', () => {
  it('Returns expected value', async () => {
    const res = await host.getCategories();

    expect(res).not.toBeNull();
    expect(Array.isArray(res)).toBe(true);
  });
});

// abstract setMaxSpeed(bytes: number): Promise<NZBResult>;
describe('nzb/SABnzbdHost::setMaxSpeed', () => {
  it('Returns expected value', async () => {
    const res = await host.setMaxSpeed(45000000);

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
  });
});

// abstract getQueue(): Promise<NZBQueueResult>;
describe('nzb/SABnzbdHost::getQueue', () => {
  it('Returns expected value', async () => {
    const res = await host.getQueue();

    expect(res).not.toBeNull();
    expect(res).toHaveProperty('queue');
    expect(Array.isArray(res.queue)).toBe(true);
  });
});

// abstract resumeQueue(): Promise<NZBResult>;
// abstract pauseQueue(): Promise<NZBResult>;
describe('nzb/SABnzbdHost::pauseQueue / resumeQueue', () => {
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

describe('Queue manipulation', () => {
  let id: string;
  let item: NZBQueueItem;

  it('Adds NZB by URL', async () => {
    // abstract addUrl(url: string, options: NZBAddOptions): Promise<NZBAddUrlResult>;
    const res = await host.addUrl(process.env.NZB_URL, {
      category: 'download',
      name: 'Test NZB',
    });

    id = res.result as string;
    item = (await host.getQueue()).queue.find(item => item.id === id);

    expect(res).not.toBeNull();
    expect(id.length).toBeTruthy();
  });

  it('Can pause queue item', async () => {
    // abstract pauseId(id: string): Promise<NZBResult>;
    // abstract pauseItem(id: NZBQueueItem): Promise<NZBResult>;
    // note, pauseItem uses pauseId internally
    const res = await host.pauseItem(item);

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();

    item = (await host.getQueue()).queue.find(item => item.id === id);
  });

  it('Can resume queue item', async () => {
    // abstract resumeId(id: string): Promise<NZBResult>;
    // abstract resumeItem(id: NZBQueueItem): Promise<NZBResult>;
    const res = await host.resumeItem(item);

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();

    item = (await host.getQueue()).queue.find(item => item.id === id);
  });

  it('Can remove queue item', async () => {
    // abstract removeId(id: string): Promise<NZBResult>;
    // abstract removeItem(id: NZBQueueItem): Promise<NZBResult>;
    const res = await host.removeItem(item);

    expect(res).not.toBeNull();
    expect(res.success).toBeTruthy();
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
