import {
  NZBAddOptions,
  NZBQueue,
  NZBQueueItem,
  DefaultNZBQueueItem,
  type Downloader,
} from '~/downloader';
import { SABnzbd } from '~/downloader/SABnzbd';
import { NZBGet } from '~/downloader/NZBGet';
import {
  getOptions,
  DownloaderType,
  type DownloaderOptions,
  getActiveDownloader,
  type Watcher,
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
    if (!this._instance) this._instance = new this();
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

  // Tracks queue item ids between refreshes so we can detect completions
  _previousIds: Set<string> | undefined;
  _completionListeners: ((item: NZBQueueItem, success: boolean) => void)[] = [];

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
      // Avoid false completion notifications when switching downloaders
      this._previousIds = undefined;
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

  /**
   * Wait for the downloader to be ready, and return self for chaining.
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
    const downloader = await this.getDownloader();
    this._queue = await downloader?.getQueue();
    await this.checkCompletions(downloader);
    this.onRefresh();
    setTimeout(() => (this._refreshing = false), 500); // Actual refresh is too fast, so delay
  }

  get refreshing() {
    return this._refreshing;
  }

  /**
   * Compare the current queue against the queue from the previous refresh to
   * detect items that have left the queue (completed or failed), then look
   * them up in the downloader's history to determine the final status and
   * notify any completion listeners.
   */
  async checkCompletions(downloader?: Downloader) {
    const currentIds = new Set(this.queue.map((item) => item.id));

    // Skip the very first refresh (or a refresh right after switching
    // downloaders) so we don't fire notifications for items that already
    // finished before we started watching.
    if (this._previousIds && downloader) {
      const finishedIds = [...this._previousIds].filter((id) => !currentIds.has(id));

      if (finishedIds.length) {
        const history = await downloader.getHistory().catch(() => []);

        for (const id of finishedIds) {
          const historyItem = history.find((item) => item.id === id);
          const success = historyItem ? historyItem.status !== 'Failed' : true;
          this.onCompletion(historyItem ?? { ...DefaultNZBQueueItem, id }, success);
        }
      }
    }

    this._previousIds = currentIds;
  }

  // Refresh timer

  async start(overrideInterval?: number) {
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

  // Completion listeners (fired when a queue item finishes downloading)

  addCompletionListener(listener: (item: NZBQueueItem, success: boolean) => void) {
    this._completionListeners.push(listener);
  }

  removeCompletionListener(listener: (item: NZBQueueItem, success: boolean) => void) {
    this._completionListeners = this._completionListeners.filter((l) => l !== listener);
  }

  onCompletion(item: NZBQueueItem, success: boolean) {
    this._completionListeners.forEach((l) => l(item, success));
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

  async addUrl(url: string, options: NZBAddOptions = {}) {
    options = {
      ...options,
      category: await this.transmogrifyCategory(options?.category),
    };

    logger.log('addUrl', url, options);

    return await this._awaitRefresh((await this.getDownloader())?.addUrl(url, options));
  }

  async addFile(filename: string, content: string, options: NZBAddOptions = {}) {
    options = {
      ...options,
      category: await this.transmogrifyCategory(options?.category),
    };

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
