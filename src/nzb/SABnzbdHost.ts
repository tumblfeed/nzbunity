import { request, RequestOptions, objectToQuery, humanSize, Kilobyte, Megabyte, Gigabyte, ucFirst } from '../util';
import { NZBAddOptions, NZBAddUrlResult, NZBHost, NZBQueueItem, NZBQueue, NZBResult } from './NZBHost';

export { NZBAddOptions, NZBAddUrlResult, NZBQueueItem, NZBQueue, NZBResult };

export class SABnzbdHost extends NZBHost {
  static getApiUrlSuggestions(host:string):string[] {
    return super.getApiUrlSuggestions(host, ['8080', '9090'], ['', 'api', 'sabnzbd', 'sabnzbd/api']);
  }

  static testApiUrl(url:string, profile:NZBUnityProfileOptions):Promise<NZBResult> {
    const host = new SABnzbdHost({
      host: url, hostAsEntered: true,
      apikey: profile.ProfileApiKey,
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
      const parsed = Util.parseUrl(this.host);
      // If path is empty ('' or '/'), default to /sabnzbd
      if (/^\/*$/i.test(parsed.pathname)) parsed.pathname = '/sabnzbd';
      // If path does not end in /api, add it
      if (!/api$/i.test(parsed.pathname)) parsed.pathname += '/api';

      this.apiUrl = parsed.href;
    }
  }

  async call(operation: string, params: Record<string, unknown> = {}): Promise<NZBResult> {
    const reqParams: RequestOptions = {
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
      reqParams.username = this.hostParsed.username;
      reqParams.password = this.hostParsed.password ?? undefined;
    }

    Object.keys(params).forEach(k => (reqParams.params[k] = String(params[k])));

    try {
      let result = await request(reqParams);

      // check for error conditions
      if (typeof result === 'string') {
        throw Error('Invalid result from host');
      }

      // Collapse single key result
      if (Object.values(result).length === 1) {
        result = Object.values(result)[0];
      }

      return { success: true, operation, result };
    } catch (error) {
      return { success: false, operation, error };
    }
  }

  async getCategories(): Promise<string[]> {
    const res = await this.call('get_cats');
    return res.success ? (res.result as string[]).filter(i => i !== '*') : null;
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
    const res = await this.call('queue');

    if (!res.success) return null;

    let speedBytes: number = null;
    const speedMatch: string[] = res.result['speed'].match(/(\d+)\s+(\w+)/i);
    if (speedMatch) {
      speedBytes = parseInt(speedMatch[1]);

      switch (speedMatch[2].toUpperCase()) {
        case 'G':
          speedBytes *= Gigabyte;
          break;
        case 'M':
          speedBytes *= Megabyte;
          break;
        case 'K':
          speedBytes *= Kilobyte;
          break;
      }
    }

    const maxSpeedBytes: number = parseInt(res.result['speedlimit_abs']);

    const queue: NZBQueue = {
      status: ucFirst(res.result['status']),
      speed: humanSize(speedBytes) + '/s',
      speedBytes,
      maxSpeed: maxSpeedBytes ? humanSize(maxSpeedBytes) : '',
      maxSpeedBytes,
      sizeRemaining: res.result['sizeleft'],
      timeRemaining: speedBytes > 0 ? res.result['timeleft'] : '∞',
      categories: null,
      queue: [],
    };

    queue.queue = res.result['slots'].map((slot: Record<string, string>) => {
      // MB convert to Bytes
      const sizeBytes: number = Math.floor(parseFloat(slot['mb']) * Megabyte);
      const sizeRemainingBytes: number = Math.floor(parseFloat(slot['mbleft']) * Megabyte);

      return {
        id: slot['nzo_id'],
        status: ucFirst(slot['status']),
        name: slot['filename'],
        category: slot['cat'],
        size: humanSize(sizeBytes),
        sizeBytes,
        sizeRemaining: humanSize(sizeRemainingBytes),
        sizeRemainingBytes,
        timeRemaining: speedBytes > 0 ? slot['timeleft'] : '∞',
        percentage: Math.floor(((sizeBytes - sizeRemainingBytes) / sizeBytes) * 100),
      } as NZBQueueItem;
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
    let ids: string[];

    Object.keys(options).forEach(k => {
      const val = String(options[k]);
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
    });

    const res = await this.call('addurl', params);

    if (res.success) {
      ids = res.result['nzo_ids'];
      res.result = ids.length ? ids[0] : null;

      if (options.paused) {
        setTimeout(() => ids.forEach(id => this.pauseId(id)), 100);
      }
    }

    return res as NZBAddUrlResult;
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
    let ids: string[];

    Object.keys(options).forEach(k => {
      const val = String(options[k]);
      switch (k) {
        case 'category':
          params.cat = val;
          break;
        default:
          params[k] = val;
      }
    });

    delete params.content;
    delete params.filename;

    console.debug(params);

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

    try {
      let res = await request(reqParams);

      // Collapse single key result
      if (Object.values(res).length === 1) {
        res = Object.values(res)[0];
      }

      ids = res['nzo_ids'];

      if (options.paused) {
        setTimeout(() => ids.forEach(id => this.pauseId(id)), 100);
      }

      return {
        success: true,
        result: ids.length ? ids[0] : null,
      } as NZBAddUrlResult;
    } catch (error) {
      return { success: false, error };
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
