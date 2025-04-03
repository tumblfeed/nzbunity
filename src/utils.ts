import { icons } from '~/assets';

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

export function isContentScript(): boolean {
  return location && !/^(chrome|moz)-extension:/.test(location.protocol);
}

function getLastError(caller: string = 'sendMessage'): string | null {
  const error = browser.runtime.lastError;
  if (!error?.message) return null;

  console.warn(`[${caller}] Last error: ${error.message}`);
  // Receiving end not existing isn't really concerning, ignore.
  return /Receiving end does not exist/i.test(error?.message) ? null : error.message;
}

export function sendMessage<T, R>(message: Record<string, T>): Promise<R> {
  return new Promise((resolve, reject) => {
    browser.runtime.sendMessage(message, (response: R) => {
      const error = getLastError();
      if (error) {
        reject(error);
      } else {
        // console.info('[util.sendMessage]', { message, response });
        resolve(response as R);
      }
    });
  });
}

export function sendTabMessage<T, R>(
  tabId: number,
  message: Record<string, T>,
): Promise<R> {
  return new Promise((resolve, reject) => {
    browser.tabs.sendMessage(tabId, message, (response: R) => {
      const error = getLastError();
      if (error) {
        reject(error);
      } else {
        // console.info('[util.sendTabMessage]', { message, response });
        resolve(response as R);
      }
    });
  });
}

export function setMenuIcon(color: string = 'green', status?: string): Promise<void> {
  color = color.toLowerCase();
  if (/^(active|downloading)/i.test(color)) color = 'green';
  if (/^(inactive|idle|paused|gray)/i.test(color)) color = 'grey';

  if (!/grey|green|orange/.test(color)) {
    console.warn(`[setMenuIcon] Invalid color: ${color}, ${status}`);
    return Promise.resolve();
  }

  const action = browser.action ?? browser.browserAction;

  action.setTitle({
    title: 'NZB Unity' + (status ? ` - ${status}` : ''),
  });

  const bySize = ['16', '32', '64'].reduce((set, size) => {
    set[size] = (icons as Record<string, string>)[`icon_nzb_${size}_${color}`];
    return set;
  }, {} as Record<string, string>);

  return new Promise((resolve) => action.setIcon({ path: bySize }, resolve));
}

export function queryToObject(
  query: string = globalThis.location.search,
): URLSearchParams {
  return new URLSearchParams(query);
}

export function getQueryParam(
  k: string,
  default_?: string,
  query?: string,
): string | undefined {
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

  return new URL(url);
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

  if (options.username) {
    options.headers.set(
      'Authorization',
      `Basic ${btoa(`${options.username}:${options.password || ''}`)}`,
    );
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
    console.debug(
      'utils/request() <--',
      `${response.status}: ${response.statusText}`,
      response,
    );
  }

  if (response.ok) {
    // Pull the body as text and attempt to parse as JSON
    // We can only pull the body from the response stream once
    const body = await response.text();
    // if (options.debug) {
    //   console.debug('utils/request() <-- body:', body);
    // }
    try {
      return JSON.parse(body);
    } catch (e) {
      return body;
    }
  } else {
    throw Error(`${response.status}: ${response.statusText}`);
  }
}

const thousand = 1024;
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
  return s.length > n ? `${s.substring(0, n)}...` : s;
}

export function simplifyCategory(s: string): string {
  // If category name contains any non-word characters (eg 'Lol > Wut')
  // just return the first word (eg 'lol')
  return (
    s
      ?.split(/[^\w\d]+/i)
      ?.shift()
      ?.toLowerCase() ?? ''
  );
}

export function objDiff(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};

  for (const k of Object.keys(a)) {
    if (a[k] !== b[k]) {
      diff[k] = a[k];
    }
  }

  return diff;
}

export function objDiffKeys(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): string[] {
  return Object.keys(objDiff(a, b));
}

/**
 * Given a function and time in ms, returns a wrapped function that will execute the given function
 * after the given time has passed. If the function is called again before the time has passed, the
 * previous call will be cancelled and the timer will start over.
 *
 * Returns a promise that resolves to the result of the function call, which allows the function to be
 * used in async contexts without having to use a side effect.
 *
 * Useful for debouncing user input, eg to prevent too many events when the user is typing.
 * @see throttle()
 */
export function debounce<T extends unknown[], R>(
  fn: (...args: T) => R | Promise<R>,
  timeout: number,
): (...args: T) => Promise<R> {
  let timer: NodeJS.Timeout;

  // Close on the promise and resolve function so we can always return the same promise
  // for a given debounce interval. Each interval will have its own promise.
  let promise: Promise<R>;
  let resolver: (value: R | Promise<R>) => void;

  // Reset the promise and pull the resolver so we can resolve inside the function
  const resetPromise = () => {
    promise = new Promise<R>((resolve) => {
      resolver = resolve;
    });
  };

  // Initialize the promise
  resetPromise();

  // Debounce the function as normal, but also resolve on the final value
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // On final call, resolve the promise on the result of the function
      resolver(fn(...args));
      // Reset the closed promise so the next call gets a new one
      resetPromise();
    }, timeout);

    // Always return the same promise
    return promise;
  };
}
