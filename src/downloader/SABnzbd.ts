import {
  request,
  parseUrl,
  objectToQuery,
  humanSize,
  Kilobyte,
  Megabyte,
  Gigabyte,
  ucFirst,
} from '~/utils';
import { Downloader, DownloaderType, DefaultNZBQueue, DefaultNZBQueueItem } from '.';

import type { RequestOptions } from '~/utils';
import type {
  DownloaderOptions,
  NZBAddOptions,
  NZBAddUrlResult,
  NZBQueueItem,
  NZBQueue,
  NZBResult,
} from '.';
export type { NZBAddOptions, NZBAddUrlResult, NZBQueueItem, NZBQueue, NZBResult };

export class SABnzbd extends Downloader {
  static generateApiUrlSuggestions(url: string): string[] {
    return super.generateApiUrlSuggestions(
      url,
      ['8080', '9090'],
      ['', 'api', 'sabnzbd', 'sabnzbd/api'],
    );
  }

  static testApiUrl(url: string, options: DownloaderOptions): Promise<NZBResult> {
    const host = new SABnzbd({ ...options, ApiUrl: url });
    return host.test();
  }

  key: string;

  constructor(options: DownloaderOptions) {
    super(options);
    this.key = options.ApiKey ?? '';
  }

  async call(
    operation: string,
    params: Record<string, unknown> = {},
  ): Promise<NZBResult> {
    const req: RequestOptions = {
      method: 'GET',
      url: this.url,
      params: {
        output: 'json',
        apikey: this.key,
        mode: operation,
      },
      debug: Boolean(params.debug),
    };

    if (this.urlParsed.username) {
      req.username = this.urlParsed.username;
      req.password = this.urlParsed.password ?? undefined;
    }

    for (const [k, v] of Object.entries(params)) {
      req.params![k] = v;
    }

    try {
      let result = await request(req);

      this.logger.debug(`SABnzbd.call ${operation}`, params, result);

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
    return res.success ? (res.result as string[]).filter((i) => i !== '*') : [];
  }

  async setMaxSpeed(bytes: number): Promise<NZBResult> {
    const value = bytes ? `${bytes / Kilobyte}K` : 0;
    const res = await this.call('config', { name: 'speedlimit', value });

    if (res.success) {
      res.result = true;
    }
    return res;
  }

  async getHistory(): Promise<NZBQueueItem[]> {
    return [];
  }

  async getQueue(): Promise<NZBQueue> {
    const nzbResult = await this.call('queue');

    if (!nzbResult.success) {
      return { ...DefaultNZBQueue, status: 'Error' };
    }

    const result = nzbResult.result! as Record<string, string>;

    let speedBytes: number = 0;
    const [, speedNumeric, speedUnit] = result.speed.match(/([\d\.]+)\s+(\w+)/i) ?? [];
    if (speedNumeric) {
      speedBytes = parseFloat(speedNumeric);
      speedBytes *=
        {
          G: Gigabyte,
          M: Megabyte,
          K: Kilobyte,
        }[speedUnit.toUpperCase()] || 1;
    }

    const maxSpeedBytes: number = parseInt(result.speedlimit_abs);

    const queue: NZBQueue = {
      ...DefaultNZBQueue,
      status: ucFirst(result.status),
      speed: humanSize(speedBytes) + '/s',
      speedBytes,
      maxSpeed: maxSpeedBytes ? humanSize(maxSpeedBytes) : '',
      maxSpeedBytes,
      sizeRemaining: result.sizeleft || '∞',
      timeRemaining: speedBytes > 0 ? result.timeleft : '∞',
      categories: [],
      queue: [],
    };

    const slots = result.slots as unknown as Record<string, string>[];

    queue.queue = slots.map((slot) => {
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
      switch (k) {
        case 'name':
          params.nzbname = v;
          break;
        case 'category':
          params.cat = v;
          break;
        default:
          params[k] = v;
      }
    }

    const nzbResult = await this.call('addurl', params);

    if (nzbResult.success) {
      const result = nzbResult.result! as Record<string, unknown>;
      const ids = result.nzo_ids as string[];
      nzbResult.result = ids.length ? ids[0] : null;

      if (options.paused) {
        setTimeout(() => ids.forEach((id) => this.pauseId(id)), 100);
      }
    }

    return nzbResult as NZBAddUrlResult;
  }

  async addFile(
    filename: string,
    content: string | Buffer | File,
    options: NZBAddOptions = {},
  ): Promise<NZBAddUrlResult> {
    // Upload NZB using POST multipart/form-data. In your form, set the value of the field mode to addfile;
    // the file data should be in the field name or the field nzbfile.

    const params: Record<string, string> = {
      apikey: this.key,
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

    const req: RequestOptions = {
      method: 'POST',
      multipart: true,
      url: `${this.url}?${objectToQuery(params)}`,
      params,
      files: {
        nzbfile: {
          filename,
          type: 'application/nzb',
          content,
        },
      },
      debug: true,
    };

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

      const ids = (result as Record<string, string[]>).nzo_ids;

      return { success: true, result: ids.length ? ids[0] : undefined };
    } catch (error) {
      return { success: false, error: `${error}` };
    }
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
