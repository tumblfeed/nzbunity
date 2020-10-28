import { browser } from "webextension-polyfill-ts";
import { FlatDictionary, NestedDictionary, StringDictionary } from "./types";

export declare interface ParsedUrl {
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search?: FlatDictionary;
  hash: string;
}

export declare interface RequestOptions {
  url: string;
  method?: string;
  headers?: StringDictionary;
  params?: NestedDictionary;
  body?: string | FormData;
  username?: string;
  password?: string;
  json?: boolean;
  multipart?: boolean;
  files?: {
    [key:string]: {
      filename: string;
      type: string;
      content: any;
    }
  };
  mode?: string,
  cache?: string,
  credentials?: string,
  redirect?: string,
  referrerPolicy?: string,
  debug?: boolean;
}

export declare interface CreateAddLinkOptions {
  url: string;
  category?: string;
}


export function setMenuIcon(color: string = "green", status: string = null): Promise<void> {
  // TODO: Roadmap #8, allow either color by profile or badge, and color by type
  //       Green for NZBGet, Orange for SABnzbd
  color = color.toLowerCase();
  if (/^(active|downloading)/i.test(color)) color = "green";
  if (/^(inactive|idle|paused|gray)/i.test(color)) color = "grey";

  if (!/grey|green|orange/.test(color)) {
    console.warn(`[setMenuIcon] Invalid color: ${color}, ${status}`);
    return Promise.resolve();
  }

  browser.browserAction.setTitle({
    title: "NZB Unity" + (status ? ` - ${status}` : ""),
  });

  const bySize = ["16", "32", "64"].reduce((set, size) => {
    set[size] = browser.extension.getURL(`content/images/nzb-${size}-${color}.png`);
    return set;
  }, {});

  return browser.browserAction.setIcon({ path: bySize });
}

export function queryToObject(query: string = window.location.search): StringDictionary {
  return String(query)
    .replace(/^\?/, '')
    .split('&')
    .reduce((obj, pair) => {
      const [key, val] = pair.split('=');
      if (key) {
        obj[decodeURIComponent(key)] = decodeURIComponent(val);
      }
      return obj;
    }, {});
}

export function queryToObjectTyped(query: string = undefined): FlatDictionary {
    const queryObj = queryToObject(query);

    return Object.keys(queryObj)
      .map((key) => ({ key, val: queryObj[key] }))
      .reduce((obj, pair) => {
        if (pair.key) {
          // Default string value
          let newVal: string|boolean|number|null = pair.val;

          // Null, but will also catch flag-style param in "&param=&" and "&param&"
          if (/^(null|)$/i.test(pair.val)) newVal = null;

          // Boolean
          if (/^true$/i.test(pair.val)) newVal = true;
          if (/^false$/i.test(pair.val)) newVal = false;

          // Numbers
          if (/^\d+$/.test(pair.val)) newVal = parseInt(pair.val, 10);
          if (/^0x[0-9A-F]+$/i.test(pair.val)) newVal = parseInt(pair.val, 16);
          if (/^\d+\.\d+$/.test(pair.val)) newVal = parseFloat(pair.val);
          if (/^(\d+\.)?\d+e\d+$/.test(pair.val)) newVal = parseFloat(pair.val);

          obj[pair.key] = newVal;
        }
        return obj;
      }, {});
}

export function getQueryParam(
  k: string,
  def: string = null,
  query: string = undefined
): string|null {
  const obj = queryToObject(query);
  return typeof obj[k] === 'undefined' ? def : obj[k];
}

export function getQueryParamTyped(
  key: string,
  def: string|boolean|number|null = null,
  query: string = undefined
): string|boolean|number|null {
  const obj: FlatDictionary = queryToObjectTyped(query);
  return typeof obj[key] === 'undefined' ? def : obj[key];
}

export function objectToQuery(obj: FlatDictionary): string {
  return Object.keys(obj)
    .map((key) => {
      const k = encodeURIComponent(key);
      const v = encodeURIComponent(obj[key] as string);

      return (obj[key] === null) ? k : `${k}=${v}`;
    })
    .join("&");
}

/**
 * Parse a given URL into parts
 * @param url
 */
export function parseUrl(url: string): ParsedUrl {
  // If url does not start with protocol, but also does not start with a '/'
  // for a relative url, assume http protocol so simple addresses will still work
  if (!/^[a-z]+:\/\//i.test(url) && !/^\//.test(url)) {
    url = `http://${url}`;
  }

  // DOM anchor tags parse hrefs into constituent parts, we can the DOM do the work.
  const parser: HTMLAnchorElement = document.createElement("a");
  parser.href = url;

  // Convert query string to object
  const search = queryToObjectTyped(parser.search);

  const { protocol, host, hostname, port, pathname, hash } = parser;
  return { protocol, host, hostname, port, pathname, hash, search };
}

/**
 * Wraps a fetch() request to handle common options in a sensible way.
 * @param RequestOptions options
 */
export async function request(options: RequestOptions): Promise<any> {
  // Options wrangling
  if (!options.url) {
    throw Error('No URL provided');
  }

  const method: string = String(options.method || "GET").toUpperCase();
  const parsed: ParsedUrl = parseUrl(options.url);
  const headers: StringDictionary = options.headers || {};

  let url: string = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  let search: FlatDictionary = parsed.search;

  if (options.params || options.files || options.multipart) {
    if (method === "GET") {
      // GET requests, pack everything in the URL
      search = search || {};
      Object.keys(options.params).forEach((k) => {
        search[k] = options.params[k] as string;
      });
    } else if (!options.body) {
      // Other types of requests, figure out content type if not specified
      // and build the request body if not provided.
      const type =
        headers["Content-Type"] ||
        (options.json && "json") ||
        (options.files && "multipart") ||
        (options.multipart && "multipart") ||
        "form";

      switch (type) {
        case "json":
        case "application/json":
          headers["Content-Type"] = "application/json";
          options.body = JSON.stringify(options.params);
          break;

        case "multipart":
        case "multipart/form-data":
          delete headers["Content-Type"];
          options.body = new FormData();

          Object.keys(options.params ?? []).forEach((k) => {
            (options.body as FormData).append(k, options.params[k] as string);
          });

          Object.keys(options.files ?? []).forEach((k) => {
            (options.body as FormData).append(
              k,
              new Blob([options.files[k].content], { type: options.files[k].type }),
              options.files[k].filename,
            );
          });
          break;

        case "form":
        case "application/x-www-form-urlencoded":
        default:
          headers["Content-Type"] = "application/x-www-form-urlencoded";
          options.body = objectToQuery(options.params as FlatDictionary);
      }
    }
  }

  if (Object.keys(search || {}).length) {
    url = `${url}?${objectToQuery(search)}`;
  }

  if (options.username && options.password) {
    headers.Authorization = `Basic ${btoa(`${options.username}:${options.password}`)}`;
    options.credentials = 'include';
  }

  // Debug if requested
  if (options.debug) {
    console.debug(
      'util/request() -->',
      {
        'rawUrl': options.url,
        url,
        method,
        headers,
        'body': options.body,
      },
    );
  }

  // Make the request
  const response = await fetch(url, options as RequestInit);

  // Debug if requested
  if (options.debug) {
    console.debug(
      'util/request() <--',
      `${response.status}: ${response.statusText}`,
    );
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
  const n: string = (bytes / Math.pow(thousand, i)).toFixed(2).replace(/\.?0+$/, "");
  const u: string = ["B", "kB", "MB", "GB", "TB"][i];

  return `${n} ${u}`;
}

export function humanSeconds(seconds: number): string {
  // Divide into sections
  const hours = String(Math.floor(((seconds % 31536000) % 86400) / 3600));
  let minutes = String(Math.floor((((seconds % 31536000) % 86400) % 3600) / 60));
  let remainder = String((((seconds % 31536000) % 86400) % 3600) % 60);

  // pad minutes and seconds
  minutes = `0${minutes}`.slice(-2);
  remainder = `0${remainder}`.slice(-2);

  // Coombine and remove 0 hours
  return `${hours}:${minutes}:${remainder}`.replace(/^0+:/, "");
}

export function ucFirst(s: string): string {
  return s.substring(0, 1).toUpperCase() + s.substring(1).toLowerCase();
}

export function trunc(s: string, n: number): string {
  return s.length > n ? `${s.substr(0, n)}&hellip;` : s;
}

export function simplifyCategory(s: string): string {
  // If category name contains any non-word characters (eg "Lol > Wut")
  // just return the first word (eg "Lol")
  if (/[^\w\s]/.test(s)) {
    [s] = s.split(/\s*[^\w\s]+\s*/i);
  }
  return s.toLowerCase();
}
