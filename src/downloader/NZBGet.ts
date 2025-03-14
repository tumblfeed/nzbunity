import {
  request,
  parseUrl,
  objectToQuery,
  humanSeconds,
  humanSize,
  Kilobyte,
  Megabyte,
  Gigabyte,
  ucFirst,
} from '@/utils';
import { Downloader, DownloaderType, DefaultNZBQueue, DefaultNZBQueueItem, NZBPriority } from '.';

import type { RequestOptions } from '@/utils';
import type {
  DownloaderOptions,
  NZBAddOptions,
  NZBAddUrlResult,
  NZBQueueItem,
  NZBQueue,
  NZBResult,
} from '.';
export type { NZBAddOptions, NZBAddUrlResult, NZBQueueItem, NZBQueue, NZBResult };

export interface NZBGetResult extends NZBResult {
  version?: string;
}

export class NZBGet extends Downloader {
  static generateApiUrlSuggestions(url: string): string[] {
    return super.generateApiUrlSuggestions(url, ['6789'], ['', 'jsonrpc']);
  }

  static testApiUrl(url: string, options: DownloaderOptions): Promise<NZBResult> {
    const host = new NZBGet({ ...options, ApiUrl: url });
    return host.test();
  }

  type: DownloaderType = DownloaderType.NZBGet;
  username: string;
  password: string;

  constructor(options: DownloaderOptions) {
    super(options);
    this.username = options.Username ?? this.urlParsed.username ?? '';
    this.password = options.Password ?? this.urlParsed.password ?? '';
  }

  async call(operation: string, params: unknown[] = []): Promise<NZBGetResult> {
    const req: RequestOptions = {
      method: 'POST',
      url: this.url,
      username: this.username,
      password: this.password,
      json: true,
      params: {
        method: operation,
        params: params,
      },
      debug: import.meta.env.VITE_DEBUG ?? false,
    };

    try {
      const result = await request(req);

      // check for error conditions
      if (typeof result === 'string') {
        throw Error('Invalid result from host');
      }

      // Collapse the nested result
      const { version, result: data } = result as { version: string; result: unknown };

      return { success: true, operation, version, result: data };
    } catch (error) {
      return { success: false, operation, error: `${error}` };
    }
  }

  async getCategories(): Promise<string[]> {
    // NZBGet API does not have a method to get categories, but the
    // categories are listed in the config, so let's get them there.
    const res = await this.call('config');

    return res.success
      ? (res.result as Record<string, string>[])
          .filter((i) => /Category\d+\.Name/i.test(i.Name))
          .map((i) => i.Value)
      : [];
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
    const nzbResult = await this.call('status');

    if (!nzbResult.success) {
      return { ...DefaultNZBQueue, status: 'Error' };
    }

    const result = nzbResult.result! as Record<string, unknown>;

    const serverStandBy = result['ServerStandBy'] as boolean;
    const downloadPaused = result['DownloadPaused'] as boolean;
    const status =
      serverStandBy && downloadPaused ? 'paused' : serverStandBy ? 'idle' : 'downloading';

    const speedBytes = result['DownloadRate'] as number; // in Bytes / Second
    const maxSpeedBytes = result['DownloadLimit'] as number;
    const sizeRemaining = (result['RemainingSizeMB'] as number) * Megabyte; // MB convert to Bytes
    const timeRemaining = Math.floor(sizeRemaining / speedBytes); // Seconds

    const queue: NZBQueue = {
      ...DefaultNZBQueue,
      status: ucFirst(status),
      speed: humanSize(speedBytes) + '/s',
      speedBytes,
      maxSpeed: maxSpeedBytes ? humanSize(maxSpeedBytes) : '',
      maxSpeedBytes,
      sizeRemaining: humanSize(sizeRemaining),
      timeRemaining: speedBytes > 0 ? humanSeconds(timeRemaining) : '∞',
      categories: [],
      queue: [],
    };

    const groups = await this.call('listgroups');

    if (!groups?.success) return queue;

    const slots = groups.result as Record<string, unknown>[];

    queue.queue = slots.map((slot) => {
      // MB convert to Bytes
      const sizeBytes: number = Math.floor(<number>slot['FileSizeMB'] * Megabyte);
      const sizeRemainingBytes: number = Math.floor(<number>slot['RemainingSizeMB'] * Megabyte);
      // Seconds
      const timeRemaining: number = Math.floor(sizeRemainingBytes / queue.speedBytes);

      return {
        ...DefaultNZBQueueItem,
        id: String(slot['NZBID']),
        status: ucFirst(slot['Status'] as string),
        name: slot['NZBNicename'] as string,
        category: slot['Category'] as string,
        size: humanSize(sizeBytes),
        sizeBytes,
        sizeRemaining: humanSize(sizeRemainingBytes),
        sizeRemainingBytes,
        timeRemaining: queue.speedBytes > 0 ? humanSeconds(timeRemaining) : '∞',
        percentage: Math.floor(((sizeBytes - sizeRemainingBytes) / sizeBytes) * 100),
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

  async addFile(
    filename: string,
    content: string,
    options: NZBAddOptions = {},
  ): Promise<NZBAddUrlResult> {
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
