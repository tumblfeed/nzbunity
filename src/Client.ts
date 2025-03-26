import { NZBAddOptions, NZBQueue, NZBQueueItem, type Downloader } from '@/downloader';
import { SABnzbd } from '@/downloader/SABnzbd';
import { NZBGet } from '@/downloader/NZBGet';
import {
  getOptions,
  DownloaderType,
  type DownloaderOptions,
  getActiveDownloader,
  type Watcher,
  watchActiveDownloader,
  removeWatcher,
} from '@/store';
import { simplifyCategory } from '@/utils';

import { Logger } from '@/logger';
const logger = new Logger('Client');

export const downloaders = {
  [DownloaderType.SABnzbd]: SABnzbd,
  [DownloaderType.NZBGet]: NZBGet,
};

export function createDownloader(opts?: DownloaderOptions) {
  return opts?.Type && downloaders[opts.Type]
    ? new downloaders[opts.Type](opts)
    : undefined;
}

export function findApiUrl(opts?: DownloaderOptions): Promise<string | null> {
  return downloaders[opts?.Type!]?.findApiUrl(opts!) ?? null;
}

export class Client {
  static _instance: Client | undefined;
  static getInstance() {
    if (!this._instance) this._instance = new Client();
    return this._instance;
  }

  _downloader: Promise<Downloader | undefined>;
  _syncDownloader: Downloader | undefined; // Set after the promise resolves
  _queue: NZBQueue | undefined;

  _optsWatcher: Watcher | undefined;
  _timer: NodeJS.Timeout | undefined;
  _interval: number = 0;

  _listeners: ((arg0: Client) => void)[] = [];
  _refreshing: boolean = false;

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

  async refresh() {
    this._refreshing = true;
    this._queue = await (await this.getDownloader())?.getQueue();
    this.onRefresh();
    setTimeout(() => (this._refreshing = false), 500); // Actual refresh is too fast, so delay
  }

  get refreshing() {
    return this._refreshing;
  }

  // Refresh timer

  async start(overrideInterval?: number) {
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

  // Refresh listeners

  addRefreshListener(listener: (client: Client) => void) {
    this._listeners.push(listener);
  }

  removeRefreshListener(listener: (client: Client) => void) {
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

  get queue(): NZBQueueItem[] {
    // Note: this is actually the queue items
    return this._queue?.queue || [];
  }

  // Convenience helpers

  isDownloading(item?: NZBQueueItem) {
    return (item ?? this._queue)?.status.toLowerCase() === 'downloading';
  }

  isPaused(item?: NZBQueueItem) {
    return (item ?? this._queue)?.status.toLowerCase() === 'paused';
  }

  isQueued(item?: NZBQueueItem) {
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
   */
  async transmogrifyCategory(category?: string | null): Promise<string | undefined> {
    const { OverrideCategory, IgnoreCategories, SimplifyCategories, DefaultCategory } =
      await getOptions();

    // If we're overriding categories, use that.
    if (OverrideCategory) {
      logger.debug(`Overriding category "${category}" with "${OverrideCategory}"`);
      return OverrideCategory;
    }

    // If we're ignoring categories, send nothing.
    if (IgnoreCategories) {
      logger.debug(`Ignoring category "${category}"`);
      return undefined;
    }

    // If the category is empty, use the default if set.
    if (!category && DefaultCategory) {
      logger.debug(
        `Using default category "${DefaultCategory}" instead of "${category}"`,
      );
      return DefaultCategory || undefined;
    }

    // Simplify category if set
    if (category && SimplifyCategories) {
      logger.debug(`Simplifying category "${category}"`);
      category = simplifyCategory(category);
      logger.debug(`    >> "${category}"`);
    }

    return category || undefined;
  }

  // Proxy methods

  async _awaitRefresh<T>(promise: Promise<T> | undefined): Promise<T | undefined> {
    // Silly little helper to refresh after a promise resolves
    const res = await promise;
    await this.refresh();
    return res;
  }

  async getHistory(options?: Record<string, unknown>) {
    // No refresh, but...
    // TODO: Watch this for completions?
    return await (await this.getDownloader())?.getHistory(options);
  }

  async setMaxSpeed(bytes: number) {
    return await this._awaitRefresh((await this.getDownloader())?.setMaxSpeed(bytes));
  }

  async pauseQueue() {
    return await this._awaitRefresh((await this.getDownloader())?.pauseQueue());
  }

  async resumeQueue() {
    return await this._awaitRefresh((await this.getDownloader())?.resumeQueue());
  }

  async addUrl(url: string, options?: NZBAddOptions) {
    const category = await this.transmogrifyCategory(options?.category);
    if (category) {
      options = { ...(options ?? {}), category };
    }

    return await this._awaitRefresh((await this.getDownloader())?.addUrl(url, options));
  }

  async addFile(filename: string, content: string, options?: NZBAddOptions) {
    const category = await this.transmogrifyCategory(options?.category);
    if (category) {
      options = { ...(options ?? {}), category };
    }

    return await this._awaitRefresh(
      (await this.getDownloader())?.addFile(filename, content, options),
    );
  }

  async removeId(id: string) {
    return await this._awaitRefresh((await this.getDownloader())?.removeId(id));
  }

  async removeItem(item: NZBQueueItem) {
    return await this._awaitRefresh((await this.getDownloader())?.removeItem(item));
  }

  async pauseId(id: string) {
    return await this._awaitRefresh((await this.getDownloader())?.pauseId(id));
  }

  async pauseItem(item: NZBQueueItem) {
    return await this._awaitRefresh((await this.getDownloader())?.pauseItem(item));
  }

  async resumeId(id: string) {
    return await this._awaitRefresh((await this.getDownloader())?.resumeId(id));
  }

  async resumeItem(item: NZBQueueItem) {
    return await this._awaitRefresh((await this.getDownloader())?.resumeItem(item));
  }

  async test() {
    return await (await this.getDownloader())?.test();
  }
}

export class ContentClient extends Client {
  constructor() {
    // Don't auto-start, we don't need queue updates on content pages
    super(false);
  }
}
