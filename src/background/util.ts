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
  params?: NestedDictionary;
  body?: string;
  username?: string;
  password?: string;
  json?: boolean;
}

declare interface CreateAddLinkOptions {
  url: string;
  category?: string;
}

class Util {
  static readonly storage = browser.storage.local;

  static readonly byteMultiplier = 1024;
  static readonly Byte = Math.pow(Util.byteMultiplier, 0);
  static readonly Kilobyte = Math.pow(Util.byteMultiplier, 1);
  static readonly Megabyte = Math.pow(Util.byteMultiplier, 2);
  static readonly Gigabyte = Math.pow(Util.byteMultiplier, 3);

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

      let method:string = String(options.method || 'GET').toUpperCase();
      let parsed:ParsedUrl = Util.parseUrl(options.url);
      let url:string = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
      let search:StringDictionary = parsed.search;
      let headers:StringDictionary = options.headers || {};

      if (options.params) {
        // GET requests, pack everything in the URL
        if (method === 'GET') {
          search = search || {};
          for (let k in options.params) {
            search[k] = <string> options.params[k];
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
              options.body = Util.uriEncodeQuery(<Dictionary> options.params);
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

  static humanSize(bytes:number) {
    let i:number = bytes ? Math.floor(Math.log(bytes) / Math.log(Util.byteMultiplier)) : 0;
    let n:string = (bytes / Math.pow(Util.byteMultiplier, i)).toFixed(2).replace(/\.?0+$/, '');

    return n + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
  }

  static humanSeconds(seconds:number) {
    let hours:number = Math.floor(((seconds % 31536000) % 86400) / 3600);
    let minutes:number = Math.floor((((seconds % 31536000) % 86400) % 3600) / 60);
    seconds = (((seconds % 31536000) % 86400) % 3600) % 60;

    return `${hours}:${minutes}:${seconds}`.replace(/^0+:/, '');
  }

  static ucFirst(s:string):string {
    return s.substring(0, 1).toUpperCase() + s.substring(1).toLowerCase();
  }

  static trunc(s:string, n:number):string {
    return (s.length > n) ? s.substr(0, n - 1) + '&hellip;' : s;
  }

  static simplifyCategory(s:string):string {
    if (/[^\w\s]/.test(s)) {
      s = s.split(/\s*[^\w\s]+\s*/i)[0];
    }
    return s.toLowerCase();
  }
}

class PageUtil {
  static readonly iconGreen:string = browser.extension.getURL('content/images/nzb-16-green.png');
  static readonly iconGrey:string = browser.extension.getURL('content/images/nzb-16-grey.png');
  static readonly iconOrange:string = browser.extension.getURL('content/images/nzb-16-orange.png');
  static readonly iconRed:string = browser.extension.getURL('content/images/nzb-16-reg.png');

  static getBaseUrl():string {
    let l:Location = window.location;
    return `${l.protocol}//${l.host}`;
  }

  static request(options:RequestOptions):Promise<any> {
    options.url = PageUtil.getBaseUrl() + (options.url || '');
    return Util.request(options);
  }

  static createAddUrlLink(options:CreateAddLinkOptions, adjacent:HTMLElement = null) {
    // console.log('createAddUrlLink', url, category);
    let link = $(
      `<a class="NZBUnityLink" href="${options.url}" title="Download with NZB Unity">`
        + `<img src="${PageUtil.iconGreen}">`
      + `</a>`
    );
    let img = link.find('img');

    link.css({
      height: '16px',
      width: '16px'
    });

    link.on('click', (e) => {
      e.preventDefault();
      console.info(`[NZB Unity] Adding URL: ${link.attr('href')}`);

      img.attr('src', PageUtil.iconGrey);

      browser.runtime.sendMessage({ 'content.addUrl': options })
        .then((r:NZBAddUrlResult) => {
          // console.log('got response', r);
          setTimeout(() => {
            if (r.success) {
              img.attr('src', PageUtil.iconGreen);
              link.trigger('addUrl.success');
            } else {
              img.attr('src', PageUtil.iconRed);
              link.trigger('addUrl.failure');
            }
          }, 1000);
        });
    });

    if (adjacent) {
      link.insertAfter(adjacent);
    }

    return link;
  }

  static addUrl() {

  }


}