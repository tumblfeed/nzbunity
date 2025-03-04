import browser from 'webextension-polyfill';

export interface RequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  body?: string | FormData;
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
  mode?: string;
  cache?: string;
  credentials?: string;
  redirect?: string;
  referrerPolicy?: string;
  debug?: boolean;
}

export function setMenuIcon(color: string = 'green', status: string = null): Promise<void> {
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
    set[size] = browser.runtime.getURL(`content/images/nzb-${size}-${color}.png`);
    return set;
  }, {});

  return browser.browserAction.setIcon({ path: bySize });
}

export function queryToObject(query: string = window.location.search): URLSearchParams {
  return new URLSearchParams(query);
}

export function getQueryParam(k: string, def: string = null, query: string = undefined): string | null {
  return queryToObject(query).get(k) ?? def;
}

export function objectToQuery(obj: Record<string, unknown>): string {
  return Object.entries(obj)
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(String(v))])
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
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

  return new URL(url, window.location.href);
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

  const method: string = String(options.method || 'GET').toUpperCase();
  const parsed: URL = parseUrl(options.url);
  const headers: Record<string, string> = options.headers || {};

  let url: string = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  const search: URLSearchParams = parsed.searchParams;

  if (options.params || options.files || options.multipart) {
    if (method === 'GET') {
      if (options.json) {
        headers['Content-Type'] = 'application/json';
      }
      // GET requests, pack everything in the URL
      for (const [k, v] of Object.entries(options.params)) {
        search.set(k, String(v));
      }
    } else if (!options.body) {
      // Other types of requests, figure out content type if not specified
      // and build the request body if not provided.
      const type =
        headers['Content-Type'] ||
        (options.json && 'json') ||
        (options.files && 'multipart') ||
        (options.multipart && 'multipart') ||
        'form';

      switch (type) {
        case 'json':
        case 'application/json':
          headers['Content-Type'] = 'application/json';
          options.body = JSON.stringify(options.params);
          break;

        case 'multipart':
        case 'multipart/form-data':
          delete headers['Content-Type'];
          options.body = new FormData();

          Object.keys(options.params ?? []).forEach(k => {
            (options.body as FormData).append(k, options.params[k] as string);
          });

          Object.keys(options.files ?? []).forEach(k => {
            (options.body as FormData).append(
              k,
              new Blob([options.files[k].content], { type: options.files[k].type }),
              options.files[k].filename,
            );
          });
          break;

        case 'form':
        case 'application/x-www-form-urlencoded':
        default:
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          options.body = objectToQuery(options.params);
      }
    }
  }

  if (search.toString()) {
    url = `${url}?${search.toString()}`;
  }

  if (options.username && options.password) {
    headers.Authorization = `Basic ${Buffer.from(`${options.username}:${options.password}`).toString('base64')}`;
    options.credentials = 'include';
  }

  // Debug if requested
  if (options.debug) {
    console.debug('util/request() -->', {
      rawUrl: options.url,
      url,
      method,
      headers,
      body: options.body,
    });
  }

  // Make the request
  const response = await fetch(url, options as RequestInit);

  // Debug if requested
  if (options.debug) {
    console.debug('util/request() <--', `${response.status}: ${response.statusText}`);
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
  return s
    .split(/[^\w\d]+/i)
    .shift()
    .toLowerCase();
}

export function objDiff(a: Dictionary, b: Dictionary): Dictionary {
  const diff: Dictionary = {};

  for (const k in a) {
    if (a[k] !== b[k]) {
      diff[k] = a[k];
    }
  }

  return diff;
}

export function objDiffKeys(a: Dictionary, b: Dictionary): string[] {
  return Object.keys(objDiff(a, b));
}
