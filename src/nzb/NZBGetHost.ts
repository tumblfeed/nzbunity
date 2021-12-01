import {
  request,
  RequestOptions,
  humanSeconds,
  humanSize,
  ucFirst,
  Kilobyte,
  Megabyte,
} from '../util';
import { Dictionary, StringDictionary } from '../util/interfaces';
import {
  NZBAddOptions,
  NZBAddUrlResult,
  NZBHost,
  NZBPriority,
  NZBQueueItem,
  NZBQueue,
  NZBResult,
} from '.';

export class NZBGetHost extends NZBHost {
    name: string = 'NZBGet';
    username: string;
    password: string;

    constructor(options: Dictionary = {}) {
      super(options);
      this.username = (options.username || '') as string;
      this.password = (options.password || '') as string;

      if (this.hostAsEntered) {
        this.apiUrl = this.host;
      } else {
        const pathname = `${this.hostParsed.pathname}/jsonrpc`.replace(/\/+/g, '/');
        this.apiUrl = `${this.hostParsed.protocol}//${this.hostParsed.hostname}:${this.hostParsed.port}${pathname}`;
      }
    }

    async call(operation: string, params: Array<any> = []): Promise<NZBResult> {
      const reqParams: RequestOptions = {
        method: 'POST',
        url: this.apiUrl,
        username: this.username,
        password: this.password,
        json: true,
        params: {
          method: operation,
          params: params,
        },
      };

      Object.keys(params).forEach((k) => reqParams.params[k] = String(params[k]));

      try {
        const result = await request(reqParams)
        // check for error conditions
        if (typeof result === 'string') {
          throw Error('Invalid result from host');
        }

        if (result.error) {
          throw Error(`${result.error.name}: ${result.error.message}`);
        }

        return { success: true, operation, result: result.result };
      } catch(error) {
        return { success: false, operation, error };
      }
    }

    async getCategories(): Promise<string[]> {
      // NZBGet API does not have a method to get categories, but the
      // categories are listed in the config, so let's get them there.
      const res = await this.call('config');

      return res.success
        ? (res.result as StringDictionary[])
          .filter(i => /Category\d+\.Name/i.test(i.Name))
          .map(i => i.Value)
        : null;
    }

    async setMaxSpeed(bytes: number): Promise<NZBResult> {
      const speed = bytes ? bytes / Kilobyte : 0;
      const res = await this.call('rate', [speed]);

      if (res.success) {
        res.result = true;
      }
      return res;
    }

    async getHistory(): Promise<NZBQueueItem[]> {
      return [];
    }

    async getQueue(): Promise<NZBQueue> {
      const res = await this.call('status');

      if (!res.success) return null;

      const status: string = res.result['ServerStandBy']
        ? 'idle'
        : res.result['DownloadPaused']
          ? 'paused'
          : 'downloading';

      const speedBytes: number = res.result['DownloadRate']; // in Bytes / Second
      const maxSpeedBytes: number = parseInt(res.result['DownloadLimit']);
      const sizeRemaining: number = Math.floor(res.result['RemainingSizeMB'] * Megabyte); // MB convert to Bytes
      const timeRemaining: number = Math.floor(sizeRemaining / speedBytes); // Seconds

      const queue: NZBQueue = {
        status: ucFirst(status),
        speed: humanSize(speedBytes) + '/s',
        speedBytes,
        maxSpeed: maxSpeedBytes ? humanSize(maxSpeedBytes) : '',
        maxSpeedBytes,
        sizeRemaining: humanSize(sizeRemaining),
        timeRemaining: speedBytes > 0 ? humanSeconds(timeRemaining) : '∞',
        categories: null,
        queue: []
      };

      const groups = await this.call('listgroups');

      if (!(groups && groups.success)) return null;

      queue.queue = (groups.result as Dictionary[])
        .map((slot) => {
          const sizeBytes: number = Math.floor((<number> slot['FileSizeMB']) * Megabyte); // MB convert to Bytes
          const sizeRemainingBytes: number = Math.floor((<number> slot['RemainingSizeMB']) * Megabyte); // MB convert to Bytes
          const timeRemaining: number = Math.floor(sizeRemainingBytes / queue.speedBytes); // Seconds

          return {
            id: String(slot['NZBID']),
            status: ucFirst(slot['Status'] as string),
            name: slot['NZBNicename'] as string,
            category: slot['Category'] as string,
            size: humanSize(sizeBytes),
            sizeBytes,
            sizeRemaining: humanSize(sizeRemainingBytes),
            sizeRemainingBytes,
            timeRemaining: queue.speedBytes > 0 ? humanSeconds(timeRemaining) : '∞',
            percentage: Math.floor(((sizeBytes - sizeRemainingBytes) / sizeBytes) * 100)
          } as NZBQueueItem;
        });

      queue.categories = await this.getCategories();
      return queue;
    }

    async pauseQueue(): Promise<NZBResult> {
      const res = await this.call('pausedownload');

      if (res.success) {
        res.result = true;
      }
      return res;
    }

    async resumeQueue(): Promise<NZBResult> {
      const res = await this.call('resumedownload');

      if (res.success) {
        res.result = true;
      }
      return res;
    }

    async addUrl(url: string, options: NZBAddOptions = {}): Promise<NZBAddUrlResult> {
      const params: Array<any> = [
        '', // NZBFilename,
        url, // NZBContent,
        options.category || '', // Category,
        options.priority || NZBPriority.normal, // Priority,
        false, // AddToTop,
        false, // AddPaused,
        '', // DupeKey,
        0, // DupeScore,
        'SCORE', // DupeMode,
        [], // PPParameters
      ];

      const res = await this.call('append', params);

      if (res.success) {
        res.result = String(res.result);
      }
      return res as NZBAddUrlResult;
    }

    async addFile(filename: string, content: string, options: NZBAddOptions = {}): Promise<NZBAddUrlResult> {
      const params: Array<any> = [
        filename, // NZBFilename,
        btoa(content), // NZBContent,
        options.category || '', // Category,
        options.priority || NZBPriority.normal, // Priority,
        false, // AddToTop,
        false, // AddPaused,
        '', // DupeKey,
        0, // DupeScore,
        'SCORE', // DupeMode,
        [], // PPParameters
      ];

      const res = await this.call('append', params);

      if (res.success) {
        res.result = String(res.result);
      }
      return res as NZBAddUrlResult;
    }

    async removeId(value: string): Promise<NZBResult> {
      const params: Array<any> = [
        'GroupDelete', // Command
        '', // Param
        [value], // IDs
      ];

      const res = await this.call('editqueue', params);

      if (res.success) {
        res.result = true;
      }
      return res;
    }

    async removeItem(item: NZBQueueItem): Promise<NZBResult> {
      return await this.removeId(item.id);
    }

    async pauseId(value: string): Promise<NZBResult> {
      const params: Array<any> = [
        'GroupPause', // Command
        '', // Param
        [value], // IDs
      ];

      const res = await this.call('editqueue', params);

      if (res.success) {
        res.result = true;
      }
      return res;
    }

    async pauseItem(item: NZBQueueItem): Promise<NZBResult> {
      return await this.pauseId(item.id);
    }

    async resumeId(value: string): Promise<NZBResult> {
      const params: Array<any> = [
        'GroupResume', // Command
        '', // Param
        [value], // IDs
      ];

      const res = await this.call('editqueue', params);

      if (res.success) {
        res.result = true;
      }
      return res;
    }

    async resumeItem(item: NZBQueueItem): Promise<NZBResult> {
      return await this.resumeId(item.id);
    }

    async test(): Promise<NZBResult> {
      const res = await this.call('status');

      if (res.success) {
        res.result = true;
      }
      return res;
    }
  }
