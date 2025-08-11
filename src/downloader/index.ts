import { Logger } from '~/logger';
import { parseUrl } from '~/utils';
import { DownloaderType, type DownloaderOptions } from '~/store';
export { DownloaderType, type DownloaderOptions };

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

export interface NZBAddOptions {
  url?: string;
  name?: string;
  category?: string;
  script?: string;
  priority?: NZBPriority;
  pp?: NZBPostProcessing;
  paused?: boolean;
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

export abstract class Downloader {
  /**
   * Given a host, return an array of possible URLs for the download API
   * @param url The (partial) url to generate suggestions for (e.g. localhost:8080, http://localhost, etc)
   * @param ports An array of ports to try (eg: ['8080', '9090'])
   * @param paths An array of paths to try without leadind slashes (eg: ['', 'api', 'sabnzbd', 'sabnzbd/api'])
   * @returns An array of possible URLs for the download API
   */
  static generateApiUrlSuggestions(
    url: string,
    ports: string[] = [''],
    paths: string[] = [''],
  ): string[] {
    let protocols: string[] = [];

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
    const suggestions: string[] = [];

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
   */
  static testApiUrl(url: string, options: DownloaderOptions): Promise<NZBResult> {
    return Promise.reject('Not implemented in base class');
  }

  /**
   * Given a downloader, attempt to find a valid API endpoint using generated suggestions
   */
  static async findApiUrl(options: DownloaderOptions): Promise<string | null> {
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
   */
  static async findAllApiUrls(options: DownloaderOptions): Promise<string[]> {
    if (options.ApiUrl) {
      const urls = this.generateApiUrlSuggestions(options.ApiUrl);
      const results = await Promise.all(urls.map((url) => this.testApiUrl(url, options)));
      return urls.filter((url, i) => results[i].success);
    }
    return [];
  }

  options: DownloaderOptions;
  name: string;
  url: string;
  urlParsed: URL;
  logger: Logger;

  get type(): DownloaderType {
    return this.constructor.name as DownloaderType;
  }

  constructor(options: DownloaderOptions) {
    if (!options.ApiUrl) throw Error('No API URL provided');

    this.options = options;
    this.name = options.Name ?? this.type;
    this.url = options.ApiUrl;
    this.urlParsed = parseUrl(this.url);

    this.logger = new Logger(`downloader/${this.type} (${this.name})`);
  }

  abstract call(
    operation: string,
    params?: Record<string, unknown> | unknown[],
  ): Promise<NZBResult>;
  abstract getCategories(): Promise<string[]>;
  abstract setMaxSpeed(bytes: number): Promise<NZBResult>;
  abstract getHistory(options?: Record<string, unknown>): Promise<NZBQueueItem[]>;
  abstract getQueue(): Promise<NZBQueue>;
  abstract pauseQueue(): Promise<NZBResult>;
  abstract resumeQueue(): Promise<NZBResult>;
  abstract addUrl(url: string, options?: NZBAddOptions): Promise<NZBAddUrlResult>;
  abstract addFile(
    filename: string,
    content: string,
    options?: NZBAddOptions,
  ): Promise<NZBAddUrlResult>;
  abstract removeId(id: string): Promise<NZBResult>;
  abstract removeItem(id: NZBQueueItem): Promise<NZBResult>;
  abstract pauseId(id: string): Promise<NZBResult>;
  abstract pauseItem(id: NZBQueueItem): Promise<NZBResult>;
  abstract resumeId(id: string): Promise<NZBResult>;
  abstract resumeItem(id: NZBQueueItem): Promise<NZBResult>;
  abstract test(): Promise<NZBResult>;
  // addNZB(url):Promise<any>;
}
