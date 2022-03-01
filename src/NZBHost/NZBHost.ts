import { parseUrl } from '../util.js';

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
    this.hostAsEntered = hostAsEntered ?? false;
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
