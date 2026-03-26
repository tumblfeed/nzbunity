import { SABnzbd } from '~/downloader/SABnzbd';
import { NZBGet } from '~/downloader/NZBGet';
import {
  getOptions,
  DownloaderType,
  getActiveDownloader,
  watchActiveDownloader,
  removeWatcher,
} from '~/store';
import { simplifyCategory } from '~/utils';
import { Logger } from '~/logger';
const logger = new Logger('Client');
export const downloaders = {
  [DownloaderType.SABnzbd]: SABnzbd,
  [DownloaderType.NZBGet]: NZBGet,
};

/**
 * @param {DownloaderOptions} opts
 * @returns {Downloader | undefined}
 */
export function createDownloader(opts) {
  return opts?.Type && downloaders[opts.Type]
    ? new downloaders[opts.Type](opts)
    : undefined;
}

/**
 * @param {DownloaderOptions} opts
 * @returns {Promise<string | null>}
 */
export function findApiUrl(opts) {
  return downloaders[opts?.Type]?.findApiUrl(opts) ?? null;
}

export class Client {
  static _instance;
  static getInstance() {
    if (!this._instance) this._instance = new this();
    return this._instance;
  }
  _downloader;
  _syncDownloader; // Set after the promise resolves
  _queue;
  _optsWatcher;
  _timer;
  _interval = 0;
  _listeners = [];
  _refreshing = false;

  /** @param {boolean} [autoStart] */
  constructor(autoStart = true) {
    // Initialize with the active downloader
    this._downloader = getActiveDownloader().then((opts) => {
      this._syncDownloader = createDownloader(opts);
      return this._syncDownloader;
    });

    // Watch for changes to the active downloader
    this._optsWatcher = watchActiveDownloader((opts) => {
      this._syncDownloader = createDownloader(opts);
      this._downloader = Promise.resolve(this._syncDownloader);
      this.refresh();
    });

    // Start the refresh interval
    if (autoStart) this.start();
  }

  // Allow for cleanup
  cleanup() {
    if (this._optsWatcher) removeWatcher(this._optsWatcher);
  }

  /**
   * Async function to wait for the downloader to be ready, for guaranteed set.
   * @returns {Promise<Downloader | undefined>}
   */
  getDownloader() {
    return this._downloader;
  }

  /**
   * Downloader that will be set after the downloader promise resolves.
   * Should be next tick, but not guaranteed.
   */
  get downloader() {
    return this._syncDownloader;
  }

  /**
   * Wait for the downloader to be ready, and return self for chaining.
   * @returns {Promise<Client>}
   */
  async ready() {
    await this._downloader;
    return this;
  }

  /**
   * Refresh the queue from the downloader.
   */
  async refresh() {
    this._refreshing = true;
    this._queue = await (await this.getDownloader())?.getQueue();
    this.onRefresh();
    setTimeout(() => (this._refreshing = false), 500); // Actual refresh is too fast, so delay
  }

  get refreshing() {
    return this._refreshing;
  }

  /** @param {number} [overrideInterval] */
  async start(overrideInterval) {
    console.debug(`[Client] Starting refresh timer on ${globalThis.location.href}`);

    // TODO: Switch to alarms
    // Stop any existing interval
    this.stop();
    if (overrideInterval) {
      // Use the override interval if provided
      this._interval = overrideInterval;
    } else {
      // Or get the refresh rate from the options
      const { RefreshRate } = await getOptions();
      this._interval = Math.max(RefreshRate * 1000, 0);
    }

    // Start with a fresh queue
    await this.refresh();

    // Start the timer (if interval is > 0)
    this._timer = setInterval(() => this.refresh(), this._interval);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
  }

  /** @param {(client: Client) => void} listener */
  addRefreshListener(listener) {
    this._listeners.push(listener);
  }

  /** @param {(client: Client) => void} listener */
  removeRefreshListener(listener) {
    this._listeners = this._listeners.filter((l) => l !== listener);
  }

  onRefresh() {
    this._listeners.forEach((l) => l(this));
  }

  // Queue properties (call refresh to update)
  get name() {
    return this._syncDownloader?.name;
  }

  get type() {
    return this._syncDownloader?.type;
  }

  get status() {
    return this._queue?.status;
  }

  get speed() {
    return this._queue?.speed;
  }

  get maxSpeed() {
    return this._queue?.maxSpeed;
  }

  get sizeRemaining() {
    return this._queue?.sizeRemaining;
  }

  get timeRemaining() {
    return this._queue?.timeRemaining;
  }

  get categories() {
    return this._queue?.categories || [];
  }

  get queue() {
    // Note: this is actually the queue items
    return this._queue?.queue || [];
  }

  /** @param {NZBQueueItem} [item] */
  isDownloading(item) {
    return (item ?? this._queue)?.status.toLowerCase() === 'downloading';
  }

  /** @param {NZBQueueItem} [item] */
  isPaused(item) {
    return (item ?? this._queue)?.status.toLowerCase() === 'paused';
  }

  /** @param {NZBQueueItem} [item] */
  isQueued(item) {
    return (item ?? this._queue)?.status.toLowerCase() === 'queued';
  }

  openWebUI() {
    let url = this._syncDownloader?.options.WebUrl;
    if (!url) {
      // Fallback to the API URL
      url = this._syncDownloader?.options.ApiUrl || '';
      url = url.replace(/\/(api|jsonrpc).*$/, '');
    }
    if (url) globalThis.open(url, '_blank');
  }

  /**
   * Given a category for a download, process it using options into
   * the final category to send to the server.
   * @param {string} category
   * @returns {Promise<string | undefined>}
   */
  async transmogrifyCategory(category) {
    const { OverrideCategory, IgnoreCategories, SimplifyCategories, DefaultCategory } =
      await getOptions();

    // If we're overriding categories, use that.
    if (OverrideCategory) {
      logger.log(`Overriding category "${category}" with "${OverrideCategory}"`);
      return OverrideCategory;
    }

    // If we're ignoring categories, send nothing.
    if (IgnoreCategories) {
      logger.log(`Ignoring category "${category}"`);
      return undefined;
    }

    // If the category is empty, use the default if set.
    if (!category && DefaultCategory) {
      logger.log(`No category, using default category "${DefaultCategory}"`);
      return DefaultCategory || undefined;
    }

    // Simplify category if set
    if (category && SimplifyCategories) {
      logger.log(`Simplifying category "${category}"`);
      category = simplifyCategory(category);
      logger.log(`    >> "${category}"`);
    }
    return category || undefined;
  }

  // Proxy methods
  async _awaitRefresh(promise) {
    // Silly little helper to refresh after a promise resolves
    const res = await promise;
    await this.refresh();
    return res;
  }

  /** @param {Record<string, *>} [options] */
  async getHistory(options) {
    // No refresh, but...
    // TODO: Watch this for completions?
    return await (await this.getDownloader())?.getHistory(options);
  }

  /** @param {number} bytes */
  async setMaxSpeed(bytes) {
    return await this._awaitRefresh((await this.getDownloader())?.setMaxSpeed(bytes));
  }

  async pauseQueue() {
    return await this._awaitRefresh((await this.getDownloader())?.pauseQueue());
  }

  async resumeQueue() {
    return await this._awaitRefresh((await this.getDownloader())?.resumeQueue());
  }

  /**
   * @param {string} url
   * @param {NZBAddOptions} [options]
   */
  async addUrl(url, options = {}) {
    options = {
      ...options,
      category: await this.transmogrifyCategory(options?.category),
    };
    logger.log('addUrl', url, options);
    return await this._awaitRefresh((await this.getDownloader())?.addUrl(url, options));
  }

  /**
   * @param {string} filename
   * @param {string} content
   * @param {NZBAddOptions} [options]
   */
  async addFile(filename, content, options = {}) {
    options = {
      ...options,
      category: await this.transmogrifyCategory(options?.category),
    };
    return await this._awaitRefresh(
      (await this.getDownloader())?.addFile(filename, content, options),
    );
  }

  /** @param {string} id */
  async removeId(id) {
    return await this._awaitRefresh((await this.getDownloader())?.removeId(id));
  }

  /** @param {NZBQueueItem} item */
  async removeItem(item) {
    return await this._awaitRefresh((await this.getDownloader())?.removeItem(item));
  }

  /** @param {string} id */
  async pauseId(id) {
    return await this._awaitRefresh((await this.getDownloader())?.pauseId(id));
  }

  /** @param {NZBQueueItem} item */
  async pauseItem(item) {
    return await this._awaitRefresh((await this.getDownloader())?.pauseItem(item));
  }

  /** @param {string} id */
  async resumeId(id) {
    return await this._awaitRefresh((await this.getDownloader())?.resumeId(id));
  }

  /** @param {NZBQueueItem} item */
  async resumeItem(item) {
    return await this._awaitRefresh((await this.getDownloader())?.resumeItem(item));
  }

  async test() {
    return await (await this.getDownloader())?.test();
  }
}

export class ManualClient extends Client {
  constructor() {
    // Don't auto-start, we don't need queue updates on content pages
    super(false);
  }

  async start() {
    // Disable timed refresh, we don't need it on content pages
    this._interval = 0;
  }
}
