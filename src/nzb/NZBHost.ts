import { parseUrl } from '@/utils';

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
  low,
  normal,
  high,
  force,
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

export interface NZBAddUrlResult {
  success: boolean;
  result?: string;
  error?: string;
}

export abstract class NZBHost {
  /**
   * Given a host, return an array of possible URLs for the download API
   * @param host The host to generate suggestions for (e.g. localhost:8080, http://localhost, etc)
   * @param ports An array of ports to try (eg: ['8080', '9090'])
   * @param paths An array of paths to try without leadind slashes (eg: ['', 'api', 'sabnzbd', 'sabnzbd/api'])
   * @returns An array of possible URLs for the download API
   */
  static getApiUrlSuggestions(host: string, ports: string[] = [''], paths: string[] = ['']):string[] {
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

  static testApiUrl(url:string, profile: NZBUnityProfileOptions):Promise<NZBResult> {
    return Promise.reject('Not implemented in base class');
  }

  static async findApiUrl(profile:NZBUnityProfileOptions):Promise<string> {
    const urls = this.getApiUrlSuggestions(profile.ProfileHost);
    for (const url of urls) {
      const r = await this.testApiUrl(url, profile);
      if (r.success) return url;
    }
  }

  static async findAllApiUrls(profile:NZBUnityProfileOptions):Promise<string[]> {
    const urls = this.getApiUrlSuggestions(profile.ProfileHost);
    const results = await Promise.all(urls.map(url => this.testApiUrl(url, profile)));
    return urls.filter((url, i) => results[i].success);
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
  }

  abstract call(operation: string, params: Record<string, unknown> | unknown[]): Promise<NZBResult>;
  abstract getCategories(): Promise<string[]>;
  abstract setMaxSpeed(bytes: number): Promise<NZBResult>;
  abstract getHistory(options: Record<string, unknown>): Promise<NZBQueueItem[]>;
  abstract getQueue(): Promise<NZBQueue>;
  abstract pauseQueue(): Promise<NZBResult>;
  abstract resumeQueue(): Promise<NZBResult>;
  abstract addUrl(url: string, options: NZBAddOptions): Promise<NZBAddUrlResult>;
  abstract addFile(filename: string, content: string, options: NZBAddOptions): Promise<NZBAddUrlResult>;
  abstract removeId(id: string): Promise<NZBResult>;
  abstract removeItem(id: NZBQueueItem): Promise<NZBResult>;
  abstract pauseId(id: string): Promise<NZBResult>;
  abstract pauseItem(id: NZBQueueItem): Promise<NZBResult>;
  abstract resumeId(id: string): Promise<NZBResult>;
  abstract resumeItem(id: NZBQueueItem): Promise<NZBResult>;
  abstract test(): Promise<NZBResult>;
  // addNZB(url):Promise<any>;
}
