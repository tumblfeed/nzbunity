import { request, parseUrl, objectToQuery, humanSize, Kilobyte, Megabyte, Gigabyte, ucFirst } from '@/utils';
import { NZBHost, DefaultNZBQueue, DefaultNZBQueueItem } from './NZBHost';

import type { DownloaderOptions } from '@/store';
import type { RequestOptions } from '@/utils';

import type { NZBAddOptions, NZBAddUrlResult, NZBQueueItem, NZBQueue, NZBResult } from './NZBHost';
export type { NZBAddOptions, NZBAddUrlResult, NZBQueueItem, NZBQueue, NZBResult };

export class SABnzbdHost extends NZBHost {
  static generateApiUrlSuggestions(host:string):string[] {
    return super.generateApiUrlSuggestions(host, ['8080', '9090'], ['', 'api', 'sabnzbd', 'sabnzbd/api']);
  }

  static testApiUrl(url: string, downloader: DownloaderOptions): Promise<NZBResult> {
    const host = new SABnzbdHost({
      host: url,
      hostAsEntered: true,
      apikey: downloader.ApiKey,
    });
    return host.test();
  }

  name: string = 'SABnzbd';
  apikey: string;

  constructor(options: Record<string, unknown> = {}) {
    super(options);
    this.apikey = (options.apikey || '') as string;

    if (this.hostAsEntered) {
      this.apiUrl = this.host;
    } else {
      // This is maintained for legacy compatibility, but the preferred method is to let the
      // Options page test a list of suggested API URLs and lock in the correct one.
      const parsed = parseUrl(this.host);
      // If path is empty ('' or '/'), default to /sabnzbd
      if (/^\/*$/i.test(parsed.pathname)) parsed.pathname = '/sabnzbd';
      // If path does not end in /api, add it
      if (!/api$/i.test(parsed.pathname)) parsed.pathname += '/api';

      this.apiUrl = parsed.href;
    }
  }

  async call(operation: string, params: Record<string, unknown> = {}): Promise<NZBResult> {
    const req: RequestOptions = {
      method: 'GET',
      url: this.apiUrl,
      json: true,
      params: {
        output: 'json',
        apikey: this.apikey,
        mode: operation,
      },
      debug: Boolean(params.debug),
    };

    if (this.hostParsed.username) {
      req.username = this.hostParsed.username;
      req.password = this.hostParsed.password ?? undefined;
    }

    for (const [k, v] of Object.entries(params)) {
      req.params![k] = String(v);
    }

    try {
      let result = await request(req);

      // check for error conditions
      if (typeof result === 'string') {
        throw Error('Invalid result from host');
      }

      // SABnzbd returns an object with the operation as the key and the result as the value
      // for most operations. Collapse these into just the value if there is only one key.
      if (Object.values(result as object).length === 1) {
        result = Object.values(result as object)[0];
      }

      return { success: true, operation, result };
    } catch (error) {
      return { success: false, operation, error: `${error}` };
    }
  }

  async getCategories(): Promise<string[]> {
    const res = await this.call('get_cats');
    return res.success ? (res.result as string[]).filter(i => i !== '*') : [];
  }

  async setMaxSpeed(bytes: number): Promise<NZBResult> {
    const value = bytes ? bytes / Kilobyte : 100;
    const res = await this.call('config', { name: 'speedlimit', value });

    if (res.success) {
      res.result = true;
    }
    return res;
  }

  async getHistory(): Promise<NZBQueueItem[]> {
    // TODO: Useful for done notifications?
    return [];
  }

  async getQueue(): Promise<NZBQueue> {
    const nzbResult = await this.call('queue');

    if (!nzbResult.success) {
      return { ...DefaultNZBQueue, status: 'Error' };
    };

    const result = nzbResult.result! as Record<string, string>;

    let speedBytes: number = 0;
    const speedMatch = result.speed.match(/(\d+)\s+(\w+)/i);
    if (speedMatch) {
      speedBytes = parseInt(speedMatch[1]);
      speedBytes *= ({
        G: Gigabyte,
        M: Megabyte,
        K: Kilobyte,
      }[speedMatch[2].toUpperCase()] || 1);
    }

    const maxSpeedBytes: number = parseInt(result.speedlimit_abs);

    const queue: NZBQueue = {
      ...DefaultNZBQueue,
      status: ucFirst(result.status),
      speed: humanSize(speedBytes) + '/s',
      speedBytes,
      maxSpeed: maxSpeedBytes ? humanSize(maxSpeedBytes) : '',
      maxSpeedBytes,
      sizeRemaining: (result.sizeleft) || '∞',
      timeRemaining: speedBytes > 0 ? result.timeleft : '∞',
      categories: [],
      queue: [],
    };

    const slots = result.slots as unknown as Record<string, string>[];

    queue.queue = slots.map(slot => {
      // MB convert to Bytes
      const sizeBytes: number = Math.floor(parseFloat(slot.mb) * Megabyte);
      const sizeRemainingBytes: number = Math.floor(parseFloat(slot.mbleft) * Megabyte);

      return {
        ...DefaultNZBQueueItem,
        id: slot.nzo_id,
        status: ucFirst(slot.status),
        name: slot.filename,
        category: slot.cat,
        size: humanSize(sizeBytes),
        sizeBytes,
        sizeRemaining: humanSize(sizeRemainingBytes),
        sizeRemainingBytes,
        timeRemaining: speedBytes > 0 ? slot.timeleft : '∞',
        percentage: Math.floor(((sizeBytes - sizeRemainingBytes) / sizeBytes) * 100),
      };
    });

    queue.categories = await this.getCategories();
    return queue;
  }

  async pauseQueue(): Promise<NZBResult> {
    const res = await this.call('pause');

    if (res.success) {
      res.result = true;
    }
    return res;
  }

  async resumeQueue(): Promise<NZBResult> {
    const res = await this.call('resume');

    if (res.success) {
      res.result = true;
    }
    return res;
  }

  async addUrl(url: string, options: NZBAddOptions = {}): Promise<NZBAddUrlResult> {
    const params: Record<string, string> = { name: url };

    for (const [k, v] of Object.entries(options)) {
      const val = String(v);
      switch (k) {
        case 'name':
          params.nzbname = val;
          break;
        case 'category':
          params.cat = val;
          break;
        default:
          params[k] = val;
      }
    }

    const nzbResult = await this.call('addurl', params);

    if (nzbResult.success) {
      const result = nzbResult.result! as Record<string, unknown>;
      const ids = result.nzo_ids as string[];
      nzbResult.result = ids.length ? ids[0] : null;

      if (options.paused) {
        setTimeout(() => ids.forEach(id => this.pauseId(id)), 100);
      }
    }

    return nzbResult as NZBAddUrlResult;
  }

  async addFile(
    filename: string,
    content: string | Buffer | File,
    options: NZBAddOptions = {},
  ): Promise<NZBAddUrlResult> {
    const params: Record<string, string> = {
      apikey: this.apikey,
      mode: 'addfile',
      nzbname: filename,
      output: 'json',
    };

    for (const [k, v] of Object.entries(options)) {
      const val = String(v);
      switch (k) {
        case 'category':
          params.cat = val;
          break;
        default:
          params[k] = val;
      }
    }

    delete params.content;
    delete params.filename;

    const reqParams: RequestOptions = {
      method: 'POST',
      multipart: true,
      url: `${this.apiUrl}?${objectToQuery(params)}`,
      params,
      files: {
        name: {
          filename,
          type: 'application/nzb',
          content,
        },
      },
      debug: true,
    };

    const nzbResult = await this.call('addurl', params);

    if (nzbResult.success) {
      const result = nzbResult.result! as Record<string, unknown>;
      const ids = result.nzo_ids as string[];
      nzbResult.result = ids.length ? ids[0] : null;

      if (options.paused) {
        setTimeout(() => ids.forEach(id => this.pauseId(id)), 100);
      }
    }

    return nzbResult as NZBAddUrlResult;
  }

  async removeId(value: string): Promise<NZBResult> {
    const res = await this.call('queue', { name: 'delete', value });

    if (res.success) {
      res.result = true;
    }
    return res;
  }

  async removeItem(item: NZBQueueItem): Promise<NZBResult> {
    return await this.removeId(item.id);
  }

  async pauseId(value: string): Promise<NZBResult> {
    const res = await this.call('queue', { name: 'pause', value });

    if (res.success) {
      res.result = true;
    }
    return res;
  }

  async pauseItem(item: NZBQueueItem): Promise<NZBResult> {
    return await this.pauseId(item.id);
  }

  async resumeId(value: string): Promise<NZBResult> {
    const res = await this.call('queue', { name: 'resume', value });

    if (res.success) {
      res.result = true;
    }
    return res;
  }

  async resumeItem(item: NZBQueueItem): Promise<NZBResult> {
    return await this.resumeId(item.id);
  }

  async test(): Promise<NZBResult> {
    const res = await this.call('fullstatus', { skip_dashboard: 1 });

    if (res.success) {
      res.result = true;
    }
    return res;
  }
}
