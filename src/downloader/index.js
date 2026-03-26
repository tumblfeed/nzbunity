import { Logger } from '~/logger';
import { parseUrl } from '~/utils';
import { DownloaderType } from '~/store';
export { DownloaderType };

/** @enum {number} */

export const NZBPriority = {
  default: -100,
  paused: -2,
  low: -1,
  normal: 0,
  high: 1,
  force: 2,
};

/** @enum {number} */

export const NZBPostProcessing = {
  default: -1,
  none: 0,
  repair: 1,
  repair_unpack: 2,
  repair_unpack_delete: 3,
};

/**
 * @typedef {Object} NZBAddOptions
 * @property {string} [url]
 * @property {string} [name]
 * @property {string} [category]
 * @property {string} [script]
 * @property {NZBPriority} [priority]
 * @property {NZBPostProcessing} [pp]
 * @property {boolean} [paused]
 */

/**
 * @typedef {Object} DirectNZB
 * @property {string} [rcode]
 * @property {string} [rtext]
 * @property {string} [name]
 * @property {string} [category]
 * @property {string} [moreinfo]
 * @property {string} [nfo]
 * @property {string} [propername]
 * @property {string} [episodename]
 * @property {string} [year]
 * @property {string} [details]
 * @property {string} [failure]
 */

/**
 * @typedef {Object} NZBResult
 * @property {boolean} success
 * @property {string} [operation]
 * @property {*} [result]
 * @property {string} [error]
 */

/**
 * @typedef {Object} NZBAddUrlResult
 * @property {boolean} success
 * @property {string} [result]
 * @property {string} [error]
 */

/**
 * @typedef {Object} NZBQueue
 * @property {string} status
 * @property {string} speed
 * @property {number} speedBytes
 * @property {string} maxSpeed
 * @property {number} maxSpeedBytes
 * @property {string} sizeRemaining
 * @property {string} timeRemaining
 * @property {string[]} categories
 * @property {NZBQueueItem[]} queue
 */

/**
 * @typedef {Object} NZBQueueItem
 * @property {string} id
 * @property {string} status
 * @property {string} name
 * @property {string} category
 * @property {string} size
 * @property {number} sizeBytes
 * @property {string} sizeRemaining
 * @property {number} sizeRemainingBytes
 * @property {string} timeRemaining
 * @property {number} percentage
 */

export const DefaultNZBQueue = {
  status: 'Unknown',
  speed: '0 B/s',
  speedBytes: 0,
  maxSpeed: '',
  maxSpeedBytes: 0,
  sizeRemaining: '∞',
  timeRemaining: '∞',
  categories: [],
  queue: [],
};

export const DefaultNZBQueueItem = {
  id: '',
  status: 'Unknown',
  name: '',
  category: '',
  size: '',
  sizeBytes: 0,
  sizeRemaining: '',
  sizeRemainingBytes: 0,
  timeRemaining: '',
  percentage: 0,
};

export class Downloader {
  /**
   * Given a host, return an array of possible URLs for the download API
   * @param {string} url The (partial) url to generate suggestions for (e.g. localhost:8080, http://localhost, etc)
   * @param {string[]} ports An array of ports to try (eg: ['8080', '9090'])
   * @param {string[]} paths An array of paths to try without leading slashes (eg: ['', 'api', 'sabnzbd', 'sabnzbd/api'])
   * @returns {string[]} An array of possible URLs for the download API
   */
  static generateApiUrlSuggestions(url, ports = [''], paths = ['']) {
    let protocols = [];

    // URL.parse() will shit its pants on URLs that have no protocol, but do have a port (eg "localhost:7357")
    // If no protocol is specified, prepend http to url before parsing but add both protocols to the check list
    if (!/^\w+:\/\//.test(url)) {
      url = `http://${url}`;
      protocols = ['http:', 'https:'];
    }
    const parsed = parseUrl(url);

    // If host specifies a protocol only use that, otherwise use both http and https
    if (!protocols.length)
      protocols = parsed.protocol ? [parsed.protocol] : ['http:', 'https:'];

    // If host has a port only use that, otherwise use the default ports
    if (parsed.port) {
      ports = [parsed.port];
    } else if (parsed.pathname.length > 1) {
      // If no port is specified, but a path is, it's possible the port was left out intentionally
      // so we'll try the default ports also
      ports.unshift('');
    }

    // If the parsed path is in the list of path suggestions, remove the pathname from the parsed
    // So that we don't double anything up
    const parsedPath = parsed.pathname.replace(/^\//, '');
    if (parsedPath && paths.includes(parsedPath)) {
      parsed.pathname = '';
    }

    // Generate suggestions
    const suggestions = [];
    for (const path of paths) {
      for (const port of ports) {
        for (const protocol of protocols) {
          const sugg = new URL(parsed.href); // clone the parsed URL

          // URL's rules for base URL relative paths are a little silly,
          // so we're going to do it manually, gluing the paths together and removing extra slashes
          sugg.pathname = `${sugg.pathname}/${path}`
            .replace(/\/+/g, '/') // remove double slashes
            .replace(/\/$/, ''); // remove trailing slashe
          sugg.port = port;
          sugg.protocol = protocol;
          suggestions.push(sugg.href);
        }
      }
    }
    return suggestions;
  }

  /**
   * Given a URL and a downloader, test if the URL is a valid API endpoint
   * @abstract
   * @param {string} url
   * @param {DownloaderOptions} options
   * @returns {Promise<NZBResult>}
   */
  static testApiUrl(url, options) {
    return Promise.reject('Not implemented in base class');
  }

  /**
   * Given a downloader, attempt to find a valid API endpoint using generated suggestions
   * @param {DownloaderOptions} options
   * @returns {Promise<string | null>}
   */
  static async findApiUrl(options) {
    if (options.ApiUrl) {
      const urls = this.generateApiUrlSuggestions(options.ApiUrl);
      for (const url of urls) {
        console.debug(`Testing API URL ${url}`);
        const r = await this.testApiUrl(url, options);
        if (r.success) {
          console.debug(`Found valid API URL ${url}`);
          return url;
        }
      }
    }
    return null;
  }

  /**
   * Given a downloader, attempt to find all valid API endpoints using generated suggestions
   * @param {DownloaderOptions} options
   * @returns {Promise<string[]>}
   */
  static async findAllApiUrls(options) {
    if (options.ApiUrl) {
      const urls = this.generateApiUrlSuggestions(options.ApiUrl);
      const results = await Promise.all(urls.map((url) => this.testApiUrl(url, options)));
      return urls.filter((url, i) => results[i].success);
    }
    return [];
  }
  options;
  name;
  url;
  urlParsed;
  logger;

  get type() {
    return this.constructor.name;
  }

  /** @param {DownloaderOptions} options */
  constructor(options) {
    if (!options.ApiUrl) throw Error('No API URL provided');
    this.options = options;
    this.name = options.Name ?? this.type;
    this.url = options.ApiUrl;
    this.urlParsed = parseUrl(this.url);
    this.logger = new Logger(`downloader/${this.type} (${this.name})`);
  }

  /**
   * Call the downloader API with the given operation and parameters.
   * @param {string} operation
   * @param {Record<string, *> | *[]} [params]
   * @returns {Promise<NZBResult>}
   */
  async call(operation, params) {
    throw new Error('Not implemented');
  }

  /**
   * Get the list of categories from the downloader.
   * @returns {Promise<string[]>}
   */
  async getCategories() {
    throw new Error('Not implemented');
  }

  /**
   * Set the maximum download speed.
   * @param {number} bytes
   * @returns {Promise<NZBResult>}
   */
  async setMaxSpeed(bytes) {
    throw new Error('Not implemented');
  }

  /**
   * Get the download history.
   * @param {Record<string, *>} [options]
   * @returns {Promise<NZBQueueItem[]>}
   */
  async getHistory(options) {
    throw new Error('Not implemented');
  }

  /**
   * Get the current download queue.
   * @returns {Promise<NZBQueue>}
   */
  async getQueue() {
    throw new Error('Not implemented');
  }

  /**
   * Pause the download queue.
   * @returns {Promise<NZBResult>}
   */
  async pauseQueue() {
    throw new Error('Not implemented');
  }

  /**
   * Resume the download queue.
   * @returns {Promise<NZBResult>}
   */
  async resumeQueue() {
    throw new Error('Not implemented');
  }

  /**
   * Add a URL to the download queue.
   * @param {string} url
   * @param {NZBAddOptions} [options]
   * @returns {Promise<NZBAddUrlResult>}
   */
  async addUrl(url, options) {
    throw new Error('Not implemented');
  }

  /**
   * Add a file to the download queue.
   * @param {string} filename
   * @param {string} content
   * @param {NZBAddOptions} [options]
   * @returns {Promise<NZBAddUrlResult>}
   */
  async addFile(filename, content, options) {
    throw new Error('Not implemented');
  }

  /**
   * Remove an item from the queue by ID.
   * @param {string} id
   * @returns {Promise<NZBResult>}
   */
  async removeId(id) {
    throw new Error('Not implemented');
  }

  /**
   * Remove an item from the queue.
   * @param {NZBQueueItem} item
   * @returns {Promise<NZBResult>}
   */
  async removeItem(item) {
    throw new Error('Not implemented');
  }

  /**
   * Pause an item in the queue by ID.
   * @param {string} id
   * @returns {Promise<NZBResult>}
   */
  async pauseId(id) {
    throw new Error('Not implemented');
  }

  /**
   * Pause an item in the queue.
   * @param {NZBQueueItem} item
   * @returns {Promise<NZBResult>}
   */
  async pauseItem(item) {
    throw new Error('Not implemented');
  }

  /**
   * Resume an item in the queue by ID.
   * @param {string} id
   * @returns {Promise<NZBResult>}
   */
  async resumeId(id) {
    throw new Error('Not implemented');
  }

  /**
   * Resume an item in the queue.
   * @param {NZBQueueItem} item
   * @returns {Promise<NZBResult>}
   */
  async resumeItem(item) {
    throw new Error('Not implemented');
  }

  /**
   * Test the connection to the downloader.
   * @returns {Promise<NZBResult>}
   */
  async test() {
    throw new Error('Not implemented');
  }
}
