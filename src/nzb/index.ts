import { Dictionary, NestedDictionary } from '../util/types';
import { parseUrl } from '../util';

export declare interface NZBAddOptions {
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

export declare interface DirectNZB {
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

export declare interface NZBResult {
  success: boolean;
  operation?: string;
  result?: boolean | number | string | NestedDictionary | Array<boolean|string|number|NestedDictionary>;
  error?: string;
}

export declare interface NZBQueue {
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

export declare interface NZBQueueItem {
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

export declare interface NZBAddUrlResult {
  success: boolean;
  result?: string;
  error?: string;
}

export abstract class NZBHost {
  name: string;
  displayName: string;
  host: string;
  hostParsed: URL;
  hostAsEntered: boolean = false;
  apiUrl: string;

  constructor(options:Dictionary = {}) {
    this.displayName = (options.displayName || this.name) as string;
    this.host = (options.host || 'localhost') as string;
    this.hostParsed = parseUrl(this.host);
    this.hostAsEntered = Boolean(options.hostAsEntered);
  }

  abstract call(operation: string, params: Dictionary|Array<any>): Promise<NZBResult>;
  abstract getCategories(): Promise<string[]>;
  abstract setMaxSpeed(bytes: number): Promise<NZBResult>;
  abstract getHistory(options: Dictionary): Promise<NZBQueueItem[]>;
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
