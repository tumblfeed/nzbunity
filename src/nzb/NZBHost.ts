import { parseUrl } from '@/utils';

import type { DownloaderOptions } from '@/store';

export interface NZBHostOptions {
  displayName?: string;
  host?: string;
  hostAsEntered?: boolean;
}

export interface NZBAddOptions {
  url?: string;
  name?: string;
  category?: string;
  script?: string;
  priority?: NZBPriority;
  pp?: NZBPostProcessing;
  paused?: boolean;
}

export enum NZBPriority {
  default = -100,
  paused = -2,
  low = -1,
  normal = 0,
  high = 1,
  force = 2,
}

export enum NZBPostProcessing {
  default = -1,
  none,
  repair,
  repair_unpack,
  repair_unpack_delete,
}

export interface DirectNZB {
  rcode?: string;
  rtext?: string;
  name?: string;
  category?: string;
  moreinfo?: string;
  nfo?: string;
  propername?: string;
  episodename?: string;
  year?: string;
  details?: string;
  failure?: string;
}

export interface NZBResult {
  success: boolean;
  operation?: string;
  result?: unknown;
  error?: string;
}

export interface NZBAddUrlResult {
  success: boolean;
  result?: string;
  error?: string;
}

export interface NZBQueue {
  status: string;
  speed: string;
  speedBytes: number;
  maxSpeed: string;
  maxSpeedBytes: number;
  sizeRemaining: string;
  timeRemaining: string;
  categories: string[];
  queue: NZBQueueItem[];
}

export interface NZBQueueItem {
  id: string;
  status: string;
  name: string;
  category: string;
  size: string;
  sizeBytes: number;
  sizeRemaining: string;
  sizeRemainingBytes: number;
  timeRemaining: string;
  percentage: number;
}

export const DefaultNZBQueue: NZBQueue = {
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

export const DefaultNZBQueueItem: NZBQueueItem = {
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

export abstract class NZBHost {
  /**
   * Given a host, return an array of possible URLs for the download API
   * @param host The host to generate suggestions for (e.g. localhost:8080, http://localhost, etc)
   * @param ports An array of ports to try (eg: ['8080', '9090'])
   * @param paths An array of paths to try without leadind slashes (eg: ['', 'api', 'sabnzbd', 'sabnzbd/api'])
   * @returns An array of possible URLs for the download API
   */
  static generateApiUrlSuggestions(host: string, ports: string[] = [''], paths: string[] = ['']): string[] {
    const parsed = parseUrl(host); // Will default to http if no protocol is present

    // If host specifies a protocol only use that, otherwise use both http and https
    const protocols = /^\w+:\/\//.test(host) ? [parsed.protocol] : ['http:', 'https:'];

    // If host has a port only use that, otherwise use the default ports
    if (parsed.port) {
      ports = [parsed.port];
    } else if (parsed.pathname.length > 1) {
      // If no port is specified, but a path is, it's possible the port was left out intentionally
      // so we'll try the default ports also
      ports.unshift('');
    }

    // Generate suggestions
    const suggestions: string[] = [];

    for (const path of paths) {
      for (const port of ports) {
        for (const protocol of protocols) {
          const sugg = new URL(parsed.href); // clone the parsed URL
          // URL's rules for base URL relative paths are a little silly,
          // so we're going to do it manually, gluing the paths together and removing extra slashes
          sugg.pathname = `${sugg.pathname}/${path}`.replace(/\/+/g, '/');
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
   */
  static testApiUrl(url:string, downloader: DownloaderOptions): Promise<NZBResult> {
    return Promise.reject('Not implemented in base class');
  }

  /**
   * Given a downloader, attempt to find a valid API endpoint using generated suggestions
   */
  static async findApiUrl(downloader: DownloaderOptions): Promise<string | null> {
    if (downloader.Host) {
      const urls = this.generateApiUrlSuggestions(downloader.Host);
      for (const url of urls) {
        const r = await this.testApiUrl(url, downloader);
        if (r.success) return url;
      }
    }
    return null;
  }

  /**
   * Given a downloader, attempt to find all valid API endpoints using generated suggestions
   */
  static async findAllApiUrls(downloader: DownloaderOptions): Promise<string[]> {
    if (downloader.Host) {
      const urls = this.generateApiUrlSuggestions(downloader.Host);
      const results = await Promise.all(urls.map(url => this.testApiUrl(url, downloader)));
      return urls.filter((url, i) => results[i].success);
    }
    return [];
  }

  name: string = 'NZBHost';
  displayName: string;
  host: string;
  hostParsed: URL;
  hostAsEntered: boolean;
  apiUrl: string;

  constructor({ displayName, host, hostAsEntered }: NZBHostOptions) {
    this.displayName = displayName ?? this.name;
    this.host = host ?? 'localhost';
    this.hostParsed = parseUrl(this.host);
    this.hostAsEntered = hostAsEntered ?? true;
    this.apiUrl = this.host;
  }

  abstract call(operation: string, params?: Record<string, unknown>): Promise<NZBResult>;
  abstract getCategories(): Promise<string[]>;
  abstract setMaxSpeed(bytes: number): Promise<NZBResult>;
  abstract getHistory(options?: Record<string, unknown>): Promise<NZBQueueItem[]>;
  abstract getQueue(): Promise<NZBQueue>;
  abstract pauseQueue(): Promise<NZBResult>;
  abstract resumeQueue(): Promise<NZBResult>;
  abstract addUrl(url: string, options?: NZBAddOptions): Promise<NZBAddUrlResult>;
  abstract addFile(filename: string, content: string, options?: NZBAddOptions): Promise<NZBAddUrlResult>;
  abstract removeId(id: string): Promise<NZBResult>;
  abstract removeItem(id: NZBQueueItem): Promise<NZBResult>;
  abstract pauseId(id: string): Promise<NZBResult>;
  abstract pauseItem(id: NZBQueueItem): Promise<NZBResult>;
  abstract resumeId(id: string): Promise<NZBResult>;
  abstract resumeItem(id: NZBQueueItem): Promise<NZBResult>;
  abstract test(): Promise<NZBResult>;
  // addNZB(url):Promise<any>;
}
