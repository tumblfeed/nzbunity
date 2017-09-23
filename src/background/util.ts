declare interface Dictionary {
  [key:string]: boolean | number | string | Array<boolean | number | string>;
}

declare interface StringDictionary {
  [key:string]: string;
}

declare interface NestedDictionary {
  [key:string]: boolean | number | string | Array<boolean | number | string> | NestedDictionary;
}

declare interface ParsedUrl {
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: StringDictionary;
  hash: string;
}

declare interface RequestOptions {
  method?: string;
  url: string;
  headers?: StringDictionary;
  params?: StringDictionary;
  body?: string;
  username?: string;
  password?: string;
  json?: boolean;
}

class Util {
  // Adapted from https://www.abeautifulsite.net/parsing-urls-in-javascript
  static parseUrl(url:string):ParsedUrl {
    let parser:HTMLAnchorElement = document.createElement('a');
    let search:StringDictionary = null;

    if (!/^https?:\/\//i.test(url)) {
      url = `http://${url}`; // default http
    }

    // Let the browser do the work
    parser.href = url;

    // Convert query string to object
    if (parser.search) {
      search = {};
      parser.search.replace(/^\?/, '').split('&').forEach((q:string) => {
        let split:string[] = q.split('=');
        search[split[0]] = split[1];
      });
    }

    return {
      protocol: parser.protocol,
      host: parser.host,
      hostname: parser.hostname,
      port: parser.port,
      pathname: parser.pathname,
      search: search,
      hash: parser.hash
    };
  }

  // Adapted from https://gist.github.com/dineshsprabu/0405a1fbebde2c02a9401caee47fa3f5
  static request(options:RequestOptions):Promise<any> {
    return new Promise(function (resolve, reject) {
      // Options wrangling
      if (!options.url) {
        reject({
          status: 0,
          statusText: 'No URL provided.'
        });
      }

      let method:string = options.method.toUpperCase() || 'GET';
      let parsed:ParsedUrl = Util.parseUrl(options.url);
      let url:string = `${parsed.protocol}//${parsed.hostname}:${parsed.port}${parsed.pathname}`;
      let search:StringDictionary = parsed.search;
      let headers:StringDictionary = options.headers || {};

      if (options.params) {
        // GET requests, pack everything in the URL
        if (method === 'GET') {
          search = search || {};
          for (let k in options.params) {
            search[k] = options.params[k];
          }

        // Other types of requests, figure out content type if not specified
        // and build the request body if not provided.
        } else if (!options.body) {
          let type = headers['Content-Type']
            || (options.json && 'json')
            || 'form';

          switch (type) {
            case 'json':
            case 'application/json':
              headers['Content-Type'] = 'application/json';
              options.body = JSON.stringify(options.params);
              break;

            case 'form':
            case 'application/x-www-form-urlencoded':
            default:
              headers['Content-Type'] = 'application/x-www-form-urlencoded';
              options.body = Util.uriEncodeQuery(options.params);
          }
        }
      }

      if (search) {
        url += '?' + Util.uriEncodeQuery(search);
      }

      // Make the request
      let xhr = new XMLHttpRequest();

      xhr.open(method, url, true, options.username || null, options.password || null);

      for (let k in headers || {}) {
        xhr.setRequestHeader(k, headers[k]);
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (!xhr.responseType) {
            try {
              let response:Object = JSON.parse(xhr.response);
              resolve(response);
            } catch (e) {
              resolve(xhr.response);
            }
          } else {
            resolve(xhr.response);
          }
        } else {
          console.error(1, xhr);
          reject({
            status: xhr.status,
            statusText: xhr.statusText
          });
        }
      };

      xhr.ontimeout = () => {
        reject({
          status: xhr.status,
          statusText: 'Request timed out'
        });
      };

      xhr.onerror = () => {
        console.error(2, xhr);
        reject({
          status: xhr.status,
          statusText: xhr.statusText
        });
      };

      xhr.send(options.body);
    });
  }

  static uriEncodeQuery(query:Dictionary):string {
    return Object.keys(query).map((k) => {
      let v = String(query[k]);
      return encodeURIComponent(k) + '=' + encodeURIComponent(v);
    }).join('&')
  }
}