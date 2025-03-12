import { PublicPath } from "wxt/browser";

export interface RequestOptions extends RequestInit {
  url: string;
  params?: Record<string, unknown>;
  username?: string;
  password?: string;
  json?: boolean;
  multipart?: boolean;
  files?: {
    [key: string]: {
      filename: string;
      type: string;
      content: any;
    };
  };
  debug?: boolean;
  // From RequestInit
  // method?: string
  // keepalive?: boolean
  // headers?: HeadersInit
  // body?: BodyInit | null
  // redirect?: RequestRedirect
  // integrity?: string
  // signal?: AbortSignal | null
  // credentials?: RequestCredentials
  // mode?: RequestMode
  // referrer?: string
  // referrerPolicy?: ReferrerPolicy
  // window?: null
  // dispatcher?: Dispatcher
  // duplex?: RequestDuplex
}

export function setMenuIcon(color: string = 'green', status?: string): Promise<void> {
  // TODO: Roadmap #8, allow either color by profile or badge, and color by type
  //       Green for NZBGet, Orange for SABnzbd
  color = color.toLowerCase();
  if (/^(active|downloading)/i.test(color)) color = 'green';
  if (/^(inactive|idle|paused|gray)/i.test(color)) color = 'grey';

  if (!/grey|green|orange/.test(color)) {
    console.warn(`[setMenuIcon] Invalid color: ${color}, ${status}`);
    return Promise.resolve();
  }

  browser.browserAction.setTitle({
    title: 'NZB Unity' + (status ? ` - ${status}` : ''),
  });

  const bySize = ['16', '32', '64'].reduce((set, size) => {
    set[size] = browser.runtime.getURL(`/icon/nzb-${size}-${color}.png` as PublicPath);
    return set;
  }, {} as Record<string, string>);

  return new Promise(resolve => browser.browserAction.setIcon({ path: bySize }, resolve));
}

export function queryToObject(query: string = window.location.search): URLSearchParams {
  return new URLSearchParams(query);
}

export function getQueryParam(k: string, default_?: string, query?: string): string | undefined {
  return queryToObject(query).get(k) ?? default_ ?? undefined;
}

export function objectToQuery(obj: Record<string, unknown>): string {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    query.set(k, String(v));
  }
  return query.toString();
}

/**
 * Parse a given URL into parts
 * @param url
 */
export function parseUrl(url: string): URL {
  // Add missing http if url looks like a host
  if (/^\w+\./.test(url)) {
    url = `http://${url}`;
  }

  return new URL(url, window?.location?.href);
}

/**
 * Wraps a fetch() request to handle common options in a sensible way.
 * @param RequestOptions options
 */
export async function request(options: RequestOptions): Promise<unknown> {
  // Options wrangling
  if (!options.url) {
    throw Error('No URL provided');
  }

  const url: URL = parseUrl(options.url);

  options.method = String(options.method || 'GET').toUpperCase();
  options.headers = new Headers(options.headers ?? {});

  if (options.params || options.files || options.multipart) {
    if (options.method === 'GET') {
      if (options.json) {
        options.headers.set('Content-Type', 'application/json');
      }
      // GET requests, pack everything in the URL
      for (const [k, v] of Object.entries(options.params ?? {})) {
        url.searchParams.set(k, String(v));
      }
    } else if (!options.body) {
      // Other types of requests, figure out content type if not specified
      // and build the request body if not provided.
      const type =
        options.headers.get('Content-Type') ||
        (options.json && 'json') ||
        (options.files && 'multipart') ||
        (options.multipart && 'multipart') ||
        'form';

      switch (type) {
        case 'json':
        case 'application/json':
          options.headers.set('Content-Type', 'application/json');
          options.body = JSON.stringify(options.params);
          break;

        case 'multipart':
        case 'multipart/form-data':
          options.headers.set('Content-Type', 'multipart/form-data');
          options.body = new FormData();

          for (const [k, v] of Object.entries(options.params ?? {})) {
            (options.body as FormData).append(k, String(v));
          }

          for (const [k, v] of Object.entries(options.files ?? {})) {
            (options.body as FormData).append(
              k,
              new Blob([v.content], { type: v.type }),
              v.filename,
            );
          }

          break;

        case 'form':
        case 'application/x-www-form-urlencoded':
        default:
          options.headers.set('Content-Type', 'application/x-www-form-urlencoded');
          options.body = objectToQuery(options.params ?? {});
      }
    }
  }

  if (options.username && options.password) {
    options.headers.set('Authorization', `Basic ${Buffer.from(`${options.username}:${options.password}`).toString('base64')}`);
    // options.credentials = 'include';
  }

  // Debug if requested
  if (options.debug) {
    console.debug('utils/request() -->', {
      rawUrl: options.url,
      url: url.href,
      method: options.method,
      headers: Object.fromEntries(options.headers),
      body: options.body,
    });
  }

  // Make the request
  const response = await fetch(url, options as RequestInit);

  // Debug if requested
  if (options.debug) {
    console.debug('utils/request() <--', `${response.status}: ${response.statusText}`);
  }

  if (response.ok) {
    try {
      return response.json();
    } catch (e) {
      return response.text();
    }
  } else {
    throw Error(`${response.status}: ${response.statusText}`);
  }
}

const thousand = 1000;
export const Byte = Math.pow(thousand, 0);
export const Kilobyte = Math.pow(thousand, 1);
export const Megabyte = Math.pow(thousand, 2);
export const Gigabyte = Math.pow(thousand, 3);

export function humanSize(bytes: number): string {
  const i: number = bytes ? Math.floor(Math.log(bytes) / Math.log(thousand)) : 0;
  const n: string = (bytes / Math.pow(thousand, i)).toFixed(2).replace(/\.?0+$/, '');
  const u: string = ['B', 'kB', 'MB', 'GB', 'TB'][i];

  return `${n} ${u}`;
}

export function humanSeconds(seconds: number): string {
  // Divide into sections
  const hours = String(Math.floor(seconds / 3600));
  let minutes = String(Math.floor((seconds % 3600) / 60));
  let remainder = String(seconds % 60);

  // pad minutes and seconds
  minutes = `0${minutes}`.slice(-2);
  remainder = `0${remainder}`.slice(-2);

  // Coombine and remove 0 hours
  return `${hours}:${minutes}:${remainder}`.replace(/^0+:/, '');
}

export function ucFirst(s: string): string {
  return s.substring(0, 1).toUpperCase() + s.substring(1).toLowerCase();
}

export function trunc(s: string, n: number): string {
  return s.length > n ? `${s.substr(0, n)}&hellip;` : s;
}

export function simplifyCategory(s: string): string {
  // If category name contains any non-word characters (eg 'Lol > Wut')
  // just return the first word (eg 'lol')
  return (
    s
      ?.split(/[^\w\d]+/i)
      ?.shift()
      ?.toLowerCase()
  ) ?? '';
}

export function objDiff(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const diff: Record<string, unknown> = {};

  for (const k of Object.keys(a)) {
    if (a[k] !== b[k]) {
      diff[k] = a[k];
    }
  }

  return diff;
}

export function objDiffKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  return Object.keys(objDiff(a, b));
}
