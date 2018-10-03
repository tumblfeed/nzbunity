// So many interfaces
declare interface Dictionary {
  [key:string]: boolean | number | string | Array<boolean | number | string>;
}

declare interface StringDictionary {
  [key:string]: string;
}

declare interface NestedDictionary {
  [key:string]: boolean | number | string | Array<boolean | number | string> | NestedDictionary;
}

declare interface NZBUnityProfileOptions extends Dictionary {
  ProfileName: string,
  ProfileType: string,
  ProfileHost: string,
  ProfileApiKey: string,
  ProfileUsername: string,
  ProfilePassword: string,
  ProfileServerUrl: string,
  ProfileHostAsEntered: boolean
}

declare interface NZBUnityProviderOptions extends Dictionary {
  Enabled: boolean,
  Matches: string[],
  Js: string[]
}

declare interface NZBUnityProfileDictionary {
  [key:string]: NZBUnityProfileOptions
}

declare interface NZBUnityProviderDictionary {
  [key:string]: NZBUnityProviderOptions
}

declare interface NZBUnityOptions extends NestedDictionary {
  Initialized: boolean,
  Debug: boolean,
  Profiles: NZBUnityProfileDictionary,
  ActiveProfile: string,
  Providers: NZBUnityProviderDictionary,
  ProviderNewznab: string,
  ProviderEnabled: boolean,
  RefreshRate: number,
  InterceptDownloads: boolean,
  InterceptExclude: string,
  EnableNotifications: boolean,
  EnableNewznab: boolean,
  SimplifyCategories: boolean,
  DefaultCategory: string,
  OverrideCategory: string,
  ReplaceLinks: boolean,
  UITheme: string
};

const DefaultOptions:NZBUnityOptions = {
  Initialized: false,
  Debug: false,
  Profiles: {},
  ActiveProfile: null,
  ProviderEnabled: true,
  ProviderDisplay: true,
  Providers: {},
  ProviderNewznab: '',
  RefreshRate: 15,
  InterceptDownloads: true,
  InterceptExclude: '',
  EnableNotifications: false,
  EnableNewznab: true,
  SimplifyCategories: true,
  DefaultCategory: null,
  OverrideCategory: null,
  ReplaceLinks: false,
  UITheme: ''
};

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
}

declare interface CreateAddLinkOptions {
  url: string;
  category?: string;
}

declare interface NZBStorage {
  get: (keys: string | string[] | Object) => Promise<NZBUnityOptions>;
  set: (items: NestedDictionary) => Promise<void>;
  remove: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}


class Util {
  static readonly byteMultiplier = 1024;
  static readonly Byte = Math.pow(Util.byteMultiplier, 0);
  static readonly Kilobyte = Math.pow(Util.byteMultiplier, 1);
  static readonly Megabyte = Math.pow(Util.byteMultiplier, 2);
  static readonly Gigabyte = Math.pow(Util.byteMultiplier, 3);

  // Promisified storage
  static readonly _storage = chrome.storage.local;
  static storage:NZBStorage = {
    get: (keys: string | string[] | Object = null):Promise<NZBUnityOptions> => {
      return new Promise((resolve, reject) => {
        Util._storage.get(keys, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(<NZBUnityOptions> result);
          }
        });
      });
    },

    set: (items:NestedDictionary):Promise<void> => {
      return new Promise((resolve, reject) => {
        Util._storage.set(items, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    },

    remove: (key:string):Promise<void> => {
      return (new Promise((resolve, reject) => {
        Util._storage.remove(key, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      }));
    },

    clear: ():Promise<void> => {
      return (new Promise((resolve, reject) => {
        Util._storage.clear(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      }));
    }
  }

  static getLastError():string {
    let error:chrome.runtime.LastError = chrome.runtime.lastError;
    if (error
      // Receiving end not existing isn't really concerning, ignore.
      && !/Receiving end does not exist/i.test(error.message)
    ) {
      console.warn('[Util.sendTabMessage] Last error: ', error.message);
      return error.message;
    }

    return null;
  }

  static sendMessage(message:any):Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response:any) => {
        let error = Util.getLastError();
        if (error) {
          reject(error);
        } else {
          // console.info('[Util.sendMessage] Response:', response);
          resolve(response);
        }
      })
    });
  }

  static sendTabMessage(tabId:number, message:any):Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response:any) => {
        let error = Util.getLastError();
        if (error) {
          reject(error);
        } else {
          // console.info('[Util.sendTabMessage] Response:', response);
          resolve(response);
        }
      })
    });
  }

  static setMenuIcon(color:string = null, status:string = null):Promise<void> {
    return new Promise((resolve, reject) => {
      color = color ? color.toLowerCase() : 'green';
      if (/^(active|downloading)/i.test(color)) color = 'green';
      if (/^(inactive|idle|paused|gray)/i.test(color)) color = 'grey';

      if (!/grey|green|orange/.test(color)) {
        console.warn(`[Util.sendTabMessage] Invalid color: ${color}, ${status}`);
        return resolve();
      }

      chrome.browserAction.setTitle({ title: 'NZB Unity' + (status ? ` - ${status}` : '') });

      let icons:chrome.browserAction.TabIconDetails = {
        path: {}
      };
      [16, 32, 64].forEach((size) => {
        icons.path[size] = chrome.extension.getURL(`content/images/nzb-${size}-${color}.png`);
      });

      return chrome.browserAction.setIcon(icons, () => {
        let error = Util.getLastError();
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

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

      if (options.params || options.files || options.multipart) {
        // GET requests, pack everything in the URL
        if (method === 'GET') {
          search = search || {};
          for (let k in options.params) {
            search[k] = options.params[k] as string;
          }

        // Other types of requests, figure out content type if not specified
        // and build the request body if not provided.
        } else if (!options.body) {
          let type = headers['Content-Type']
            || (options.json && 'json')
            || (options.files && 'multipart')
            || (options.multipart && 'multipart')
            || 'form';

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
              for (let k in options.params) {
                options.body.append(k, options.params[k] as string);
              }
              for (let k in options.files) {
                options.body.append(k, new Blob([options.files[k].content], { type: options.files[k].type }), options.files[k].filename);
              }
              break;

            case 'form':
            case 'application/x-www-form-urlencoded':
            default:
              headers['Content-Type'] = 'application/x-www-form-urlencoded';
              options.body = Util.uriEncodeQuery(options.params as Dictionary);
          }
        }
      }

      if (search) {
        url += '?' + Util.uriEncodeQuery(search);
      }

      // Make the request
      // console.debug({ 'util.request': `${method} ${url}` });

      let xhr = new XMLHttpRequest();

      xhr.open(method, url, true, options.username || null, options.password || null);

      if (options.username && options.password) {
        xhr.withCredentials = true;
        xhr.setRequestHeader('Authorization', 'Basic ' + btoa(`${options.username}:${options.password}`));
      }

      for (let k in headers || {}) {
        xhr.setRequestHeader(k, headers[k]);
      }

      xhr.onload = () => {
        // console.debug({ 'util.request.onload': [xhr.status, xhr.response] });
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
          reject({
            status: xhr.status,
            statusText: xhr.statusText
          });
        }
      };

      xhr.ontimeout = () => {
        // console.debug({ 'util.request.ontimeout': [xhr.status] });
        reject({
          status: xhr.status,
          statusText: 'Request timed out'
        });
      };

      xhr.onerror = () => {
        // console.debug({ 'util.request.onerror': [xhr.status, xhr.statusText] });
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
  static readonly iconGreen:string = chrome.extension.getURL('content/images/nzb-16-green.png');
  static readonly iconGrey:string = chrome.extension.getURL('content/images/nzb-16-grey.png');
  static readonly iconOrange:string = chrome.extension.getURL('content/images/nzb-16-orange.png');
  static readonly iconRed:string = chrome.extension.getURL('content/images/nzb-16-reg.png');
  static readonly backgroundNormal:string = 'rgb(23, 162, 184)';
  static readonly backgroundPending:string = 'rgb(156, 166, 168)';

  static getBaseUrl():string {
    let l:Location = window.location;
    return `${l.protocol}//${l.host}`;
  }

  static request(options:RequestOptions):Promise<any> {
    options.url = PageUtil.getBaseUrl() + (options.url || '');
    return Util.request(options);
  }

  static requestAndAddFile(filename:string, category:string = '', url:string = '', params:StringDictionary = {}):Promise<any> {
    // A lot of sites require POST to fetch NZB and follow this pattern (binsearch, nzbindex, nzbking)
    // Fetches a single NZB from a POST request and adds it to the server as a file upload
    return Util.request({
      method: 'POST',
      url: url || PageUtil.getBaseUrl(),
      params: params
    })
      .then((nzbContent) => {
        return Util.sendMessage({
          'content.addFile': {
            filename: filename,
            content: nzbContent,
            category: category
          }
        });
      });
  }

  static bindAddUrl(options:CreateAddLinkOptions, el:JQuery<HTMLElement>|HTMLElement, exclusive:boolean = false):JQuery<HTMLElement> {
    if (exclusive) {
      $(el).off('click');
    }

    return $(el)
      .on('click', (e) => {
        e.preventDefault();
        console.info(`[NZB Unity] Adding URL: ${options.url}`);

        $(e.target).trigger('nzb.pending');

        Util.sendMessage({ 'content.addUrl': options })
          .then((r:boolean) => {
            setTimeout(() => {
              $(e.target).trigger(r === false ? 'nzb.failure' : 'nzb.success');
            }, 1000);
          });
      }) as JQuery<HTMLElement>;
  }

  static createLink():JQuery<HTMLElement> {
    return $(`
      <a class="NZBUnityLink" title="Download with NZB Unity">
        <img src="${PageUtil.iconGreen}">
      </a>
    `)
      .css({
        'cursor': 'pointer',
        'display': 'inline-block'
      })
      .on('nzb.pending', (e) => {
        $(e.currentTarget).find('img').attr('src', PageUtil.iconGrey);
      })
      .on('nzb.success', (e) => {
        $(e.currentTarget).find('img').attr('src', PageUtil.iconGreen);
      })
      .on('nzb.failure', (e) => {
        $(e.currentTarget).find('img').attr('src', PageUtil.iconRed);
      });
  }

  static createButton():JQuery<HTMLElement> {
    return $(`
      <button class="NZBUnityDownloadAll"
        title="Download selected items with NZB Unity"
      >
        Download Selected
      </button>
    `)
      .css({
        'background': `${PageUtil.backgroundNormal} url(${PageUtil.iconGreen}) no-repeat scroll 4px center`,
        'border': '1px solid rgb(19, 132, 150)',
        'border-radius': '4px',
        'color': '#fff',
        'cursor': 'pointer',
        'display': 'inline-block',
        'font-size': '11px',
        'font-weight': 'normal',
        'margin': '0 0.5em 0 0',
        'padding': '3px 8px 3px 25px',
        'text-shadow': '0 -1px 0 rgba(0,0,0,0.25)',
        'white-space': 'nowrap'
      })
      .on('nzb.pending', (e) => {
        $(e.currentTarget).css({
          'background-color': PageUtil.backgroundPending,
          'background-image': `url(${PageUtil.iconGrey})`
        });
      })
      .on('nzb.success', (e) => {
        $(e.currentTarget).css({
          'background-color': PageUtil.backgroundNormal,
          'background-image': `url(${PageUtil.iconGreen})`
        });
      })
      .on('nzb.failure', (e) => {
        $(e.currentTarget).css({
          'background-color': PageUtil.backgroundNormal,
          'background-image': `url(${PageUtil.iconRed})`
        });
      });
  }

  static createAddUrlLink(options:CreateAddLinkOptions, adjacent:JQuery<HTMLElement>|HTMLElement = null):JQuery<HTMLElement> {
    // console.log('createAddUrlLink', url, category);
    let link = PageUtil.bindAddUrl(options, PageUtil.createLink())
      .attr('href', options.url)
      .css({
        height: '16px',
        width: '16px'
      });

    if (adjacent) {
      link.insertAfter(adjacent);
    }

    return link;
  }

  static createAddUrlButton(options:CreateAddLinkOptions, adjacent:JQuery<HTMLElement>|HTMLElement = null):JQuery<HTMLElement> {
    // console.log('createAddUrlLink', url, category);
    let button = PageUtil.bindAddUrl(options, PageUtil.createButton());

    if (adjacent) {
      button.insertAfter(adjacent);
    }

    return button;
  }

}