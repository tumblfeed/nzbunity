import { icons } from '~/assets';

/**
 * @typedef {Object} RequestOptions
 * @property {string} url
 * @property {Record<string, *>} [params]
 * @property {string} [username]
 * @property {string} [password]
 * @property {boolean} [json]
 * @property {boolean} [multipart]
 * @property {Object} [files]
 * @property {boolean} [debug]
 */
export function isContentScript() {
  return location && !/^(chrome|moz)-extension:/.test(location.protocol);
}

function getLastError(caller = 'sendMessage') {
  const error = browser.runtime.lastError;
  if (!error?.message) return null;
  console.warn(`[${caller}] Last error: ${error.message}`);

  // Receiving end not existing isn't really concerning, ignore.
  return /Receiving end does not exist/i.test(error?.message) ? null : error.message;
}

/**
 * @param {string} [color]
 * @param {string} [status]
 * @param {string} [badge]
 * @returns {Promise<void>}
 */
export function setMenuIcon(color = 'green', status, badge) {
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
  action.setBadgeText({
    text: badge ?? '',
  });
  const bySize = ['16', '32', '64'].reduce((set, size) => {
    set[size] = icons[`icon_nzb_${size}_${color}`];
    return set;
  }, {});
  return new Promise((resolve) => action.setIcon({ path: bySize }, resolve));
}

/**
 * @param {string} [query]
 * @returns {URLSearchParams}
 */
export function queryToObject(query = globalThis.location.search) {
  return new URLSearchParams(query);
}

/**
 * @param {string} k
 * @param {string} [default_]
 * @param {string} [query]
 * @returns {string | undefined}
 */
export function getQueryParam(k, default_, query) {
  return queryToObject(query).get(k) ?? default_ ?? undefined;
}

/**
 * @param {Record<string, *>} obj
 * @returns {string}
 */
export function objectToQuery(obj) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    query.set(k, String(v));
  }
  return query.toString();
}

/**
 * Parse a given URL into parts
 * @param {string} url
 * @returns {URL}
 */
export function parseUrl(url) {
  // Add missing http if url looks like a host
  if (/^\w+\./.test(url)) {
    url = `http://${url}`;
  }
  return new URL(url, url.startsWith('/') ? window.location.origin : undefined);
}

/**
 * Wraps a fetch() request to handle common options in a sensible way.
 * @param {RequestOptions} options
 * @returns {Promise<*>}
 */
export async function request(options) {
  // Options wrangling
  if (!options.url) {
    throw Error('No URL provided');
  }
  const url = parseUrl(options.url);
  options.method = String(options.method || 'GET').toUpperCase();
  options.headers = new Headers(options.headers ?? {});
  if (options.params || options.files || options.multipart) {
    if (options.method === 'GET') {
      // GET requests, pack everything in the URL
      for (const [k, v] of Object.entries(options.params ?? {})) {
        url.searchParams.set(k, typeof v === 'undefined' || v === null ? '' : `${v}`);
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
          // This is slightly unintuitive, but we need to remove the content type
          // header so the browser can set it correctly with the boundary
          options.headers.delete('Content-Type');
          options.body = new FormData();
          for (const [k, v] of Object.entries(options.params ?? {})) {
            options.body.append(k, typeof v === 'undefined' || v === null ? '' : `${v}`);
          }
          for (const [k, v] of Object.entries(options.files ?? {})) {
            options.body.append(k, new File([v.content], v.filename, { type: v.type }));
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

  // Cleanup a little
  // Remove any options we don't want to pass to fetch()
  delete options.params;
  delete options.files;
  delete options.multipart;
  delete options.json;
  delete options.username;
  delete options.password;

  // Debug if requested
  if (options.debug || import.meta.env.WXT_DEBUG) {
    console.debug('utils/request() -->', {
      rawUrl: options.url,
      url: url.href,
      method: options.method,
      headers: Object.fromEntries(options.headers),
      body: options.body,
    });
    if (options.body instanceof FormData) {
      console.debug('utils/request() --> body:', Object.fromEntries(options.body));
    }
  }

  // Make the request
  const response = await fetch(url.href, options);

  // Debug if requested
  if (options.debug || import.meta.env.WXT_DEBUG) {
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

    // if (options.debug || import.meta.env.WXT_DEBUG) {
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

/**
 * @param {number} bytes
 * @returns {string}
 */
export function humanSize(bytes) {
  const i = bytes ? Math.floor(Math.log(bytes) / Math.log(thousand)) : 0;
  const n = (bytes / Math.pow(thousand, i)).toFixed(2).replace(/\.?0+$/, '');
  const u = ['B', 'kB', 'MB', 'GB', 'TB'][i];
  return `${n} ${u}`;
}

/**
 * @param {number} seconds
 * @returns {string}
 */
export function humanSeconds(seconds) {
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

/**
 * @param {string} s
 * @returns {string}
 */
export function ucFirst(s) {
  return s.substring(0, 1).toUpperCase() + s.substring(1).toLowerCase();
}

/**
 * @param {string} s
 * @param {number} n
 * @returns {string}
 */
export function trunc(s, n) {
  return s.length > n ? `${s.substring(0, n)}&hellip;` : s;
}

/**
 * @param {string} s
 * @returns {string}
 */
export function simplifyCategory(s) {
  // If category name contains any non-word characters (eg 'Lol > Wut')
  // just return the first word (eg 'lol')

  return (
    s
      ?.split(/[^\w\d]+/i)
      ?.shift()
      ?.toLowerCase() ?? ''
  );
}

/**
 * @param {Object} a
 * @param {Object} b
 * @returns {Object}
 */
export function objDiff(a, b) {
  const diff = {};
  for (const k of Object.keys(a)) {
    if (a[k] !== b[k]) {
      diff[k] = a[k];
    }
  }
  return diff;
}

/**
 * @param {Object} a
 * @param {Object} b
 * @returns {string[]}
 */
export function objDiffKeys(a, b) {
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

/**
 * @template T
 * @param {(...args: *[]) => T} fn
 * @param {number} timeout
 * @returns {(...args: *[]) => Promise<T>}
 */
export function debounce(fn, timeout) {
  let timer;

  // Close on the promise and resolve function so we can always return the same promise
  // for a given debounce interval. Each interval will have its own promise.
  let promise;
  let resolver;

  // Reset the promise and pull the resolver so we can resolve inside the function
  const resetPromise = () => {
    promise = new Promise((resolve) => {
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
