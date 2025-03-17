import { defineProxyService } from '@webext-core/proxy-service';
import { NZBQueue, type Downloader } from '@/downloader';
import { SABnzbd } from '@/downloader/SABnzbd';
import { NZBGet } from '@/downloader/NZBGet';
import {
  DefaultOptions,
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
  #downloader: Downloader | undefined;
  #optsWatcher: Watcher | undefined;

  #queue: NZBQueue | undefined;
  #timer: NodeJS.Timeout | undefined;
  #interval: number = DefaultOptions.RefreshRate * 1000;

  ready: Promise<boolean> = Promise.resolve(false);

  constructor() {
    this.ready = this.#init();
  }

  async #init() {
    // As this is async, the client may not be set yet
    const activeDownloaderOpts = await getActiveDownloader();
    this.#downloader = createDownloader(activeDownloaderOpts);

    // Watch for changes to the active downloader
    this.#optsWatcher = watchActiveDownloader((opts) => {
      this.#downloader = createDownloader(opts);
    });

    const { RefreshRate } = await getOptions();
    this.#interval = RefreshRate * 1000;
    this.start();

    return true;
  }

  removeWatcher() {
    if (this.#optsWatcher) removeWatcher(this.#optsWatcher);
  }

  async refresh() {
    if (!this.#downloader) return;
    this.#queue = await this.#downloader.getQueue();
  }

  async start(interval?: number) {
    await this.refresh();

    this.stop();

    if (interval) this.#interval = interval;
    this.#timer = setInterval(() => this.refresh(), this.#interval);
  }

  stop() {
    if (this.#timer) clearInterval(this.#timer);
  }

  get downloader() {
    return this.#downloader;
  }

  get queue() {
    return this.#queue?.queue || [];
  }

  // Pueue properties

  get name() {
    return this.#downloader?.name;
  }

  get type() {
    return this.#downloader?.type;
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

  // Proxy methods that should trigger a refresh

  async setMaxSpeed(bytes: number) {
    if (!this.#downloader) return;
    await this.#downloader.setMaxSpeed(bytes);
    await this.refresh();
  }

  async pauseQueue() {
    if (!this.#downloader) return;
    await this.#downloader.pauseQueue();
    await this.refresh();
  }

  async resumeQueue() {
    if (!this.#downloader) return;
    await this.#downloader.resumeQueue();
    await this.refresh();
  }
}
