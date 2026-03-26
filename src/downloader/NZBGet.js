import { request, humanSeconds, humanSize, Kilobyte, Megabyte, ucFirst } from '~/utils';
import { Downloader, DefaultNZBQueue, DefaultNZBQueueItem, NZBPriority } from '.';

/** @typedef {NZBResult & { version?: string }} NZBGetResult */
export class NZBGet extends Downloader {
  /** @param {string} url */
  static generateApiUrlSuggestions(url) {
    return super.generateApiUrlSuggestions(url, ['6789'], ['', 'jsonrpc']);
  }

  /**
   * @param {string} url
   * @param {DownloaderOptions} options
   * @returns {Promise<NZBResult>}
   */
  static testApiUrl(url, options) {
    const host = new NZBGet({ ...options, ApiUrl: url });
    return host.test();
  }
  username;
  password;

  /** @param {DownloaderOptions} options */
  constructor(options) {
    super(options);
    this.username = options.Username ?? this.urlParsed.username ?? '';
    this.password = options.Password ?? this.urlParsed.password ?? '';
  }

  /**
   * @param {string} operation
   * @param {*[]} [params]
   * @returns {Promise<NZBGetResult>}
   */
  async call(operation, params = []) {
    const req = {
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
      const { version, result: data } = result;
      return { success: true, operation, version, result: data };
    } catch (error) {
      return { success: false, operation, error: `${error}` };
    }
  }

  /** @returns {Promise<string[]>} */
  async getCategories() {
    // NZBGet API does not have a method to get categories, but the
    // categories are listed in the config, so let's get them there.
    const res = await this.call('config');
    return res.success
      ? res.result.filter((i) => /Category\d+\.Name/i.test(i.Name)).map((i) => i.Value)
      : [];
  }

  /** @param {number} bytes */
  async setMaxSpeed(bytes) {
    const speed = bytes ? bytes / Kilobyte : 0; // 0 is no limit
    const res = await this.call('rate', [speed]);
    if (res.success) {
      res.result = true;
    }
    return res;
  }

  /** @returns {Promise<NZBQueueItem[]>} */
  async getHistory() {
    return [];
  }

  /** @returns {Promise<NZBQueue>} */
  async getQueue() {
    const nzbResult = await this.call('status');
    if (!nzbResult.success) {
      return { ...DefaultNZBQueue, status: 'Error' };
    }
    const result = nzbResult.result;
    const serverStandBy = result['ServerStandBy'];
    const downloadPaused = result['DownloadPaused'];
    const status =
      serverStandBy && downloadPaused ? 'paused' : serverStandBy ? 'idle' : 'downloading';
    const speedBytes = result['DownloadRate']; // in Bytes / Second
    const maxSpeedBytes = result['DownloadLimit'];
    const sizeRemaining = result['RemainingSizeMB'] * Megabyte; // MB convert to Bytes
    const timeRemaining = Math.floor(sizeRemaining / speedBytes); // Seconds
    const queue = {
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
    const slots = groups.result;
    queue.queue = slots.map((slot) => {
      // MB convert to Bytes
      const sizeBytes = Math.floor(slot['FileSizeMB'] * Megabyte);
      const sizeRemainingBytes = Math.floor(slot['RemainingSizeMB'] * Megabyte);

      // Seconds
      const timeRemaining = Math.floor(sizeRemainingBytes / queue.speedBytes);
      return {
        ...DefaultNZBQueueItem,
        id: String(slot['NZBID']),
        status: ucFirst(slot['Status']),
        name: slot['NZBNicename'],
        category: slot['Category'],
        size: humanSize(sizeBytes),
        sizeBytes,
        sizeRemaining: humanSize(sizeRemainingBytes),
        sizeRemainingBytes,
        timeRemaining: queue.speedBytes > 0 ? humanSeconds(timeRemaining) : '∞',
        percentage: Math.floor(((sizeBytes - sizeRemainingBytes) / sizeBytes) * 100),
      };
    });
    queue.categories = await this.getCategories();
    return queue;
  }

  /** @returns {Promise<NZBResult>} */
  async pauseQueue() {
    const res = await this.call('pausedownload');
    if (res.success) {
      res.result = true;
    }
    return res;
  }

  /** @returns {Promise<NZBResult>} */
  async resumeQueue() {
    const res = await this.call('resumedownload');
    if (res.success) {
      res.result = true;
    }
    return res;
  }

  /**
   * @param {string} url
   * @param {NZBAddOptions} [options]
   * @returns {Promise<NZBAddUrlResult>}
   */
  async addUrl(url, options = {}) {
    const params = [
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
    return res;
  }

  /**
   * @param {string} filename
   * @param {string} content
   * @param {NZBAddOptions} [options]
   * @returns {Promise<NZBAddUrlResult>}
   */
  async addFile(filename, content, options = {}) {
    const params = [
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
    return res;
  }

  /** @param {string} value */
  async removeId(value) {
    const params = [
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

  /** @param {NZBQueueItem} item */
  async removeItem(item) {
    return await this.removeId(item.id);
  }

  /** @param {string} value */
  async pauseId(value) {
    const params = [
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

  /** @param {NZBQueueItem} item */
  async pauseItem(item) {
    return await this.pauseId(item.id);
  }

  /** @param {string} value */
  async resumeId(value) {
    const params = [
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

  /** @param {NZBQueueItem} item */
  async resumeItem(item) {
    return await this.resumeId(item.id);
  }

  /** @returns {Promise<NZBResult>} */
  async test() {
    const res = await this.call('status');
    if (res.success) {
      res.result = true;
    }
    return res;
  }
}
