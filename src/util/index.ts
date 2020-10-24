import { browser, BrowserAction } from "webextension-polyfill-ts";
import { Dictionary, ParsedUrl, RequestOptions, StringDictionary } from "./types";

const binaryThousand = 1024;
export const Byte = Math.pow(binaryThousand, 0);
export const Kilobyte = Math.pow(binaryThousand, 1);
export const Megabyte = Math.pow(binaryThousand, 2);
export const Gigabyte = Math.pow(binaryThousand, 3);

export function setMenuIcon(color  : string = "green", status: string | null = null): Promise<void> {
  // TODO: Roadmap #8, allow either color by profile or badge, and color by type
  //       Green for NZBGet, Orange for SABNzbd
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

export function getQuery(query : string = window.location.search): StringDictionary {
  return query
    .replace(/^\?/, "")
    .split("&")
    .reduce((q, i) => {
      const [k, v] = i.split("=");
      q[k] = v;
      return q;
    }, {});
}

export function getQueryParam(k: string, def: string = null): string {
  return getQuery()[k] ?? def;
}

export function uriEncodeQuery(query: Dictionary): string {
  return Object.keys(query)
    .map((k) => [encodeURIComponent(k), encodeURIComponent(query[k] as string)])
    .map((pair) => pair.join("="))
    .join("&");
}

// Adapted from https://www.abeautifulsite.net/parsing-urls-in-javascript
export function parseUrl(url: string): ParsedUrl {
  const parser: HTMLAnchorElement = document.createElement("a");
  let search: StringDictionary = null;

  // Let the browser do the work
  parser.href = url;

  // Convert query string to object
  if (parser.search) {
    search = getQuery(parser.search);
  }

  const { protocol, host, hostname, port, pathname, hash } = parser;
  return { protocol, host, hostname, port, pathname, hash, search };
}

// Adapted from https://gist.github.com/dineshsprabu/0405a1fbebde2c02a9401caee47fa3f5
export function request(options: RequestOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    // Options wrangling
    if (!options.url) {
      reject({
        status: 0,
        statusText: "No URL provided.",
      });
    }

    const method: string = String(options.method || "GET").toUpperCase();
    const parsed: ParsedUrl = parseUrl(options.url);
    const headers: StringDictionary = options.headers || {};
    let url: string = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    let search: StringDictionary = parsed.search;

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
            for (let k in options.params) {
              options.body.append(k, options.params[k] as string);
            }
            for (let k in options.files) {
              options.body.append(
                k,
                new Blob([options.files[k].content], {
                  type: options.files[k].type,
                }),
                options.files[k].filename
              );
            }
            break;

          case "form":
          case "application/x-www-form-urlencoded":
          default:
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            options.body = uriEncodeQuery(options.params as Dictionary);
        }
      }
    }

    if (search) {
      url = `${url}?${uriEncodeQuery(search)}`;
    }

    // Make the request
    // console.debug({ 'util.request': `${method} ${url}` });

    const xhr = new XMLHttpRequest();
    xhr.open(
      method,
      url,
      true, // async
      options.username || null,
      options.password || null
    );

    if (options.username && options.password) {
      xhr.withCredentials = true;
      xhr.setRequestHeader(
        "Authorization",
        `Basic ${btoa(`${options.username}:${options.password}`)}`
      );
    }

    for (const k in headers || {}) {
      xhr.setRequestHeader(k, headers[k]);
    }

    xhr.onload = () => {
      // console.debug({ 'util.request.onload': [xhr.status, xhr.response] });
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          return resolve(JSON.parse(xhr.response));
        } catch (e) {
          return resolve(xhr.response);
        }
      }

      return reject({
        status: xhr.status,
        statusText: xhr.statusText,
      });
    };

    xhr.ontimeout = () => {
      // console.debug({ 'util.request.ontimeout': [xhr.status] });
      return reject({
        status: xhr.status,
        statusText: "Request timed out",
      });
    };

    xhr.onerror = () => {
      // console.debug({ 'util.request.onerror': [xhr.status, xhr.statusText] });
      return reject({
        status: xhr.status,
        statusText: xhr.statusText,
      });
    };

    xhr.send(options.body);
  });
}

export function humanSize(bytes: number): string {
  const i: number = bytes ? Math.floor(Math.log(bytes) / Math.log(binaryThousand)) : 0;
  const n: string = (bytes / Math.pow(binaryThousand, i)).toFixed(2).replace(/\.?0+$/, "");
  const u: string = ["B", "kB", "MB", "GB", "TB"][i];

  return `${n} ${u}`;
}

export function humanSeconds(seconds: number): string {
  const hours: number = Math.floor(((seconds % 31536000) % 86400) / 3600);
  const minutes: number = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
  seconds = (((seconds % 31536000) % 86400) % 3600) % 60;

  return `${hours}:${minutes}:${seconds}`.replace(/^0+:/, "");
}

export function ucFirst(s: string): string {
  return s.substring(0, 1).toUpperCase() + s.substring(1).toLowerCase();
}

export function trunc(s: string, n: number): string {
  return s.length > n ? `${s.substr(0, n - 1)}&hellip;` : s;
}

export function simplifyCategory(s: string): string {
  // If category name contains any non-word characters (eg "Lol > Wut")
  // just return the first word (eg "Lol")
  if (/[^\w\s]/.test(s)) {
    [s] = s.split(/\s*[^\w\s]+\s*/i);
  }
  return s.toLowerCase();
}
