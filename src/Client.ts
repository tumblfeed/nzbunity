import { NZBQueue, NZBQueueItem, type Downloader } from '@/downloader';
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

import { Logger } from '@/logger';
const logger = new Logger('Queue');

export const downloaders = {
  [DownloaderType.SABnzbd]: SABnzbd,
  [DownloaderType.NZBGet]: NZBGet,
};

export const createDownloader = (opts?: DownloaderOptions) => {
  return opts?.Type && downloaders[opts.Type]
    ? new downloaders[opts.Type](opts)
    : undefined;
};

export class Client {
  static #instance: Client | undefined;
  static getInstance() {
    if (!this.#instance) this.#instance = new Client();
    return this.#instance;
  }

  #downloader: Promise<Downloader | undefined>;
  #syncDownloader: Downloader | undefined; // Set after the promise resolves
  #queue: NZBQueue | undefined;

  #optsWatcher: Watcher | undefined;
  #timer: NodeJS.Timeout | undefined;
  #interval: number = 0;

  #listeners: ((arg0: Client) => void)[] = [];
  #refreshing: boolean = false;

  constructor() {
    // Initialize with the active downloader
    this.#downloader = getActiveDownloader().then((opts) => {
      this.#syncDownloader = createDownloader(opts);
      return this.#syncDownloader;
    });

    // Watch for changes to the active downloader
    this.#optsWatcher = watchActiveDownloader((opts) => {
      this.#syncDownloader = createDownloader(opts);
      this.#downloader = Promise.resolve(this.#syncDownloader);
      this.refresh();
    });

    // Start the refresh interval
    this.start();
  }

  // Allow for cleanup
  cleanup() {
    if (this.#optsWatcher) removeWatcher(this.#optsWatcher);
  }

  /**
   * Async function to wait for the downloader to be ready, for guaranteed set.
   */
  getDownloader() {
    return this.#downloader;
  }

  /**
   * Downloader that will be set after the downloader promise resolves.
   * Should be next tick, but not guaranteed.
   */
  get downloader() {
    return this.#syncDownloader;
  }

  async refresh() {
    this.#refreshing = true;
    this.#queue = await (await this.getDownloader())?.getQueue();
    this.onRefresh();
    setTimeout(() => (this.#refreshing = false), 500); // Actual refresh is too fast, so delay
  }

  get refreshing() {
    return this.#refreshing;
  }

  // Refresh timer

  async start(overrideInterval?: number) {
    // Stop any existing interval
    this.stop();

    if (overrideInterval) {
      // Use the override interval if provided
      this.#interval = overrideInterval;
    } else {
      // Or get the refresh rate from the options
      const { RefreshRate } = await getOptions();
      this.#interval = Math.max(RefreshRate * 1000, 0);
    }

    // Start with a fresh queue
    await this.refresh();

    // Start the timer (if interval is > 0)
    this.#timer = setInterval(() => this.refresh(), this.#interval);
  }

  stop() {
    if (this.#timer) clearInterval(this.#timer);
  }

  // Refresh listeners

  addRefreshListener(listener: (client: Client) => void) {
    this.#listeners.push(listener);
  }

  removeRefreshListener(listener: (client: Client) => void) {
    this.#listeners = this.#listeners.filter((l) => l !== listener);
  }

  onRefresh() {
    this.#listeners.forEach((l) => l(this));
  }

  // Queue properties (call refresh to update)

  get name() {
    return this.#syncDownloader?.name;
  }

  get type() {
    return this.#syncDownloader?.type;
  }

  get status() {
    return this.#queue?.status;
  }

  get speed() {
    return this.#queue?.speed;
  }

  get maxSpeed() {
    return this.#queue?.maxSpeed;
  }

  get sizeRemaining() {
    return this.#queue?.sizeRemaining;
  }

  get timeRemaining() {
    return this.#queue?.timeRemaining;
  }

  get categories() {
    return this.#queue?.categories || [];
  }

  get queue(): NZBQueueItem[] {
    // Note: this is actually the queue items
    return this.#queue?.queue || [];
  }

  // Convenience helpers

  isDownloading(item?: NZBQueueItem) {
    return (item ?? this.#queue)?.status.toLowerCase() === 'downloading';
  }

  isPaused(item?: NZBQueueItem) {
    return (item ?? this.#queue)?.status.toLowerCase() === 'paused';
  }

  isQueued(item?: NZBQueueItem) {
    return (item ?? this.#queue)?.status.toLowerCase() === 'queued';
  }

  openWebUI() {
    const url = this.#syncDownloader?.options.WebUrl || this.#syncDownloader?.url;
    if (url) window.open(url, '_blank');
  }

  // Proxy methods

  async #awaitRefresh<T>(promise: Promise<T> | undefined): Promise<T | undefined> {
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
    return await this.#awaitRefresh((await this.getDownloader())?.setMaxSpeed(bytes));
  }

  async pauseQueue() {
    return await this.#awaitRefresh((await this.getDownloader())?.pauseQueue());
  }

  async resumeQueue() {
    return await this.#awaitRefresh((await this.getDownloader())?.resumeQueue());
  }

  async addUrl(url: string, options?: Record<string, unknown>) {
    return await this.#awaitRefresh((await this.getDownloader())?.addUrl(url, options));
  }

  async addFile(filename: string, content: string, options?: Record<string, unknown>) {
    return await this.#awaitRefresh(
      (await this.getDownloader())?.addFile(filename, content, options),
    );
  }

  async removeId(id: string) {
    return await this.#awaitRefresh((await this.getDownloader())?.removeId(id));
  }

  async removeItem(item: NZBQueueItem) {
    return await this.#awaitRefresh((await this.getDownloader())?.removeItem(item));
  }

  async pauseId(id: string) {
    return await this.#awaitRefresh((await this.getDownloader())?.pauseId(id));
  }

  async pauseItem(item: NZBQueueItem) {
    return await this.#awaitRefresh((await this.getDownloader())?.pauseItem(item));
  }

  async resumeId(id: string) {
    return await this.#awaitRefresh((await this.getDownloader())?.resumeId(id));
  }

  async resumeItem(item: NZBQueueItem) {
    return await this.#awaitRefresh((await this.getDownloader())?.resumeItem(item));
  }

  async test() {
    return await (await this.getDownloader())?.test();
  }
}
