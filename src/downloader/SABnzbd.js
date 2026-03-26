import { request, humanSize, Kilobyte, Megabyte, Gigabyte, ucFirst } from '~/utils';
import { Downloader, DefaultNZBQueue, DefaultNZBQueueItem } from '.';
export class SABnzbd extends Downloader {
  /** @param {string} url */
  static generateApiUrlSuggestions(url) {
    return super.generateApiUrlSuggestions(
      url,
      ['8080', '9090'],
      ['', 'api', 'sabnzbd', 'sabnzbd/api'],
    );
  }

  /**
   * @param {string} url
   * @param {DownloaderOptions} options
   * @returns {Promise<NZBResult>}
   */
  static testApiUrl(url, options) {
    const host = new SABnzbd({ ...options, ApiUrl: url });
    return host.test();
  }
  key;

  /** @param {DownloaderOptions} options */
  constructor(options) {
    super(options);
    this.key = options.ApiKey ?? '';
  }

  /**
   * @param {string} operation
   * @param {Record<string, *>} [params]
   * @returns {Promise<NZBResult>}
   */
  async call(operation, params = {}) {
    const req = {
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
      req.params[k] = v;
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
      if (Object.values(result).length === 1) {
        result = Object.values(result)[0];
      }
      return { success: true, operation, result };
    } catch (error) {
      return { success: false, operation, error: `${error}` };
    }
  }

  /** @returns {Promise<string[]>} */
  async getCategories() {
    const res = await this.call('get_cats');
    return res.success ? res.result.filter((i) => i !== '*') : [];
  }

  /** @param {number} bytes */
  async setMaxSpeed(bytes) {
    const value = bytes ? `${bytes / Kilobyte}K` : 0;
    const res = await this.call('config', { name: 'speedlimit', value });
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
    const nzbResult = await this.call('queue');
    if (!nzbResult.success) {
      return { ...DefaultNZBQueue, status: 'Error' };
    }
    const result = nzbResult.result;
    let speedBytes = 0;
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
    const maxSpeedBytes = parseInt(result.speedlimit_abs);
    const queue = {
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
    const slots = result.slots;
    queue.queue = slots.map((slot) => {
      // MB convert to Bytes
      const sizeBytes = Math.floor(parseFloat(slot.mb) * Megabyte);
      const sizeRemainingBytes = Math.floor(parseFloat(slot.mbleft) * Megabyte);
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

  /** @returns {Promise<NZBResult>} */
  async pauseQueue() {
    const res = await this.call('pause');
    if (res.success) {
      res.result = true;
    }
    return res;
  }

  /** @returns {Promise<NZBResult>} */
  async resumeQueue() {
    const res = await this.call('resume');
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
    const params = { name: url };
    for (const [k, v] of Object.entries(options)) {
      switch (k) {
        case 'name':
          params.nzbname = v;
          break;
        case 'category':
          params.cat = v ?? '';
          break;
        default:
          params[k] = v;
      }
    }
    const nzbResult = await this.call('addurl', params);
    if (nzbResult.success) {
      const result = nzbResult.result;
      const ids = result.nzo_ids;
      nzbResult.result = ids.length ? ids[0] : null;
      if (options.paused) {
        setTimeout(() => ids.forEach((id) => this.pauseId(id)), 100);
      }
    }
    return nzbResult;
  }

  /**
   * @param {string} filename
   * @param {string} content
   * @param {NZBAddOptions} [options]
   * @returns {Promise<NZBAddUrlResult>}
   */
  async addFile(filename, content, options = {}) {
    // Upload NZB using POST multipart/form-data. In your form, set the value of the field mode to addfile;
    // the file data should be in the field name or the field nzbfile.
    const params = {
      apikey: this.key,
      mode: 'addfile',
      nzbname: filename,
      output: 'json',
    };
    for (const [k, v] of Object.entries(options)) {
      switch (k) {
        case 'category':
          params.cat = v ?? '';
          break;
        default:
          params[k] = v;
      }
    }
    delete params.content;
    delete params.filename;
    const req = {
      method: 'POST',
      multipart: true,
      url: this.url,
      params,
      files: {
        nzbfile: {
          filename,
          type: 'application/x-nzb',
          content,
        },
      },
    };
    try {
      let result = await request(req);

      // check for error conditions
      if (typeof result === 'string') {
        throw Error('Invalid result from host');
      }

      // SABnzbd returns an object with the operation as the key and the result as the value
      // for most operations. Collapse these into just the value if there is only one key.
      if (Object.values(result).length === 1) {
        result = Object.values(result)[0];
      }
      const ids = result.nzo_ids;
      return { success: true, result: ids.length ? ids[0] : undefined };
    } catch (error) {
      return { success: false, error: `${error}` };
    }
  }

  /** @param {string} value */
  async removeId(value) {
    const res = await this.call('queue', { name: 'delete', value });
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
    const res = await this.call('queue', { name: 'pause', value });
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
    const res = await this.call('queue', { name: 'resume', value });
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
    const res = await this.call('fullstatus', { skip_dashboard: 1 });
    if (res.success) {
      res.result = true;
    }
    return res;
  }
}
