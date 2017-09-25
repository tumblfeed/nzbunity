declare interface NZBUnityProfileOptions extends Dictionary {
  ProfileName: string,
  ProfileType: string,
  ProfileHost: string,
  ProfileApiKey: string,
  ProfileUsername: string,
  ProfilePassword: string
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
  // ProviderDisplay: boolean,
  RefreshRate: number,
  InterceptDownloads: boolean,
  EnableContextMenu: boolean,
  EnableNotifications: boolean,
  EnableNewznab: boolean,
  CategoriesUseGroupNames: boolean,
  CategoriesUseHeader: boolean,
  CategoriesDefault: string
};

const DisplayAvailableProviders:string[] = ['binsearch', 'nzbindex', 'yubse'];

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
  EnableContextMenu: true,
  EnableNotifications: true,
  EnableNewznab: true,
  CategoriesUseGroupNames: true,
  CategoriesUseHeader: true,
  CategoriesDefault: null
};

class NZBUnity {
  public _debug:boolean;
  public storage:chrome.storage.StorageArea;
  public optionsTab:chrome.tabs.Tab;
  public nzbHost:NZBHost;
  private refreshTimer:number;

  constructor() {
    this.storage = chrome.storage.local

    // Initialize default options
    this.getOpt('Debug')
      .then((opts) => {
        this._debug = opts.Debug;
        return this.initOptions()
      })
      .then(() => {
        this.debug('[NZBUnity.constructor] Options Ok');
        // Initialize server connection
        return this.setActiveProfile();
      })
      .then(() => {
        this.debug('[NZBUnity.constructor] Active profile connected');

        // Handle messages from the UI
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
        this.debug('[NZBUnity.constructor] Message handler initialized');

        // Intercept response headers to check for NZB content
        return this.getOpt('InterceptDownloads');
      })
      .then((opts) => {
        if (opts.InterceptDownloads) {
          chrome.webRequest.onHeadersReceived.addListener(
            this.handleHeadersReceived.bind(this),
            {
              urls: ["<all_urls>"],
              types: ["main_frame", "sub_frame"]
            },
            ["responseHeaders", "blocking"]
          );
          this.debug('[NZBUnity.constructor] NZB download intercept initialized');
        }
      })
      .then(() => {
        this.debug('[NZBUnity.constructor] Init Done, starting!');
        this.refresh();
      });
  }

  showNotification(id:string, title:string, message:string) {
    this.getOpt('EnableNotifications')
      .then((opts) => {
        if (opts.EnableNotifications) {
          chrome.notifications.create(`nzbunity.${id}`, {
            'type': 'basic',
            'iconUrl': chrome.extension.getURL('content/images/icon-32.png'),
            'title': `NZB Unity - ${title}`,
            'message': message
          });
        }
      });
  }

  sendMessage(name:string, data:any = null) {
    chrome.runtime.sendMessage({ [`main.${name}`]: data });
  }

  sendTabMessage(tab:chrome.tabs.Tab, name:string, data:any) {
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { [`main.${name}`]: data });
    }
  }

  sendOptionsMessage(name:string, data:any) {
    this.sendTabMessage(this.optionsTab, name, data);
  }

  /* OPERATIONS */

  startTimer() {
    this.stopTimer();

    this.getOpt('RefreshRate')
      .then((opts) => {
        this.refreshTimer = setInterval(() =>{
          this.getQueue().then((result) => {
            this.sendMessage('refresh', result);
          });
        }, opts.RefreshRate * 1000);
      });
  }

  stopTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  refresh():Promise<NZBResult> {
    this.startTimer();
    return this.getQueue();
  }

  getQueue():Promise<NZBResult> {
    if (!this.nzbHost) {
      return Promise.resolve({ success: false, operation: null, error: 'No connection to host'});
    }

    return this.nzbHost.getQueue()
      .then((result) => {
        this.sendMessage('refresh', result);
        return result;
      });
  }

  addUrl(url:string, options:NZBAddOptions = {}):Promise<NZBResult> {
    if (!this.nzbHost) {
      return Promise.resolve({ success: false, operation: null, error: 'No connection to host'});
    }

    return this.nzbHost.addUrl(url, options)
      .then((result) => {
        this.sendMessage('addUrl', result);
        this.showNotification(
          'addUrl',
          `${options.nzbname || url} Added`,
          `${options.nzbname || url} sucessfully added to ${this.nzbHost.displayName} (${this.nzbHost.name})`
        );
        return result;
      });
  }

  /* HANDLERS */

  handleHeadersReceived(details:chrome.webRequest.WebResponseHeadersDetails) {
    let url:string = details.url;
    let type:string;
    let disposition:string;
    let dnzb:DirectNZB = {};

    details.responseHeaders.forEach((h) => {
      if (h.name === 'Content-Type') {
        type = h.value.split(/;\s*/)[0].toLowerCase();
      } else if (h.name === 'Content-Disposition') {
        disposition = h.value;
      } else if (h.name.startsWith('X-DNZB')) {
        dnzb[h.name.replace('X-DNZB-', '')] = h.value;
      }
    });

    // Intercept if NZB
    let dispositionMatch = disposition && disposition.match(/^attachment;\s*filename="?(.*(\.nzb))"?$/i);
    if (type === 'application/x-nzb' || dispositionMatch) {

      // console.log('===================HEADERS=================');
      // console.log(`URL: ${url}`);
      // console.log(`Type: ${type}`);
      // console.log(`Disposition: ${disposition}`);
      // for (let k in dnzb) {
      //   console.log(`${k}: ${dnzb[k]}`);
      // }
      // console.log('===================HEADERS=================');

      let options:NZBAddOptions = {};

      if (dispositionMatch) {
        options.nzbname = dispositionMatch[1];
      }
      if (dnzb.Category) {
        options.cat = dnzb.Category;
      }

      this.addUrl(url, options)
        .then((r:NZBResult) => {
          console.info(`[NZBUnity] NZB intercepted, ${r.success ? 'Success' : 'Failure'}
  ${url}
  ${options.nzbname ? options.nzbname : ''}
  ${!r.success ? 'Error: ' + r.error : ''}`
          );
        });

      return { cancel: true };
    } else {
      return;
    }
  }

  handleMessage(message:MessageEvent) {
    if (this._debug) this.debugMessage(message);

    // Handle message
    for (let k in message) {
      let val:any = message[k];
      this.debug(k, val);

      switch (k) {
        // Popup Messages
        case 'popup.profileSelect':
          this.setActiveProfile(val)
            .then(() => {
              this.sendMessage('activeProfileSet', val);
            });
          break;

        case 'popup.refresh':
          this.refresh();
          break;

        case 'popup.openProfilePage':
          if (this.nzbHost) {
            chrome.tabs.create({
              url: this.nzbHost.host
            });
          }
          break;

        case 'popup.command':
          let op:string;
          let params:StringDictionary = {};

          try {
            val = JSON.parse(val);
            op = val.op;
            params = val.params;
          } catch (e) {
            op = val;
          }

          this.nzbHost.call(op, params)
            .then((r) => {
              this.sendMessage('commandResult', r);
            });
          break;

        // Options Messages
        case 'options.onTab':
          this.optionsTab = val;
          this.sendOptionsMessage('onTab', true);
          break;

        case 'options.setOptions':
          if (this.isValidOpt(Object.keys(val))) {
            this.setOpt(val);
          } else {
            this.error('items contain invalid option names');
          }
          break;

        case 'options.resetOptions':
          this.resetOptions()
            .then(() => {
              this.sendOptionsMessage('resetOptions', true);
            });
          break;

        case 'options.profileNameChanged':
          this.getOpt('ActiveProfile')
            .then((opts) => {
              if (val.old = opts.ActiveProfile) {
                this.setActiveProfile(val.new);
              }
            });
          break;

        case 'options.profilesSaved':
          this.setActiveProfile();
          break;

        case 'options.profileTest':
          this.sendOptionsMessage('profileTestStart', true);
          this.profileTest(val)
            .then((result) => {
              this.sendOptionsMessage('profileTestResult', result);
            })
            .catch((err) => {
              this.sendOptionsMessage('profileTestError', err);
            });
          break;
      }
    }
  }

  /* OPTIONS */

  getOpt(keys: string | string[] | Object = null):Promise<NZBUnityOptions> {
    return new Promise((resolve, reject) => {
      this.storage.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(<NZBUnityOptions> result);
        }
      });
    });
  }

  setOpt(items:NestedDictionary):Promise<void> {
    return new Promise((resolve, reject) => {
      this.storage.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  resetOptions():Promise<void> {
    return (new Promise((resolve) => {
      this.storage.clear(resolve);
    })).then(() => {
      return this.initOptions();
    });
  }

  setOptionDefaults():Promise<void> {
    return this.setOpt(DefaultOptions);
  }

  initOptions():Promise<void> {
    return this.getOpt('Initialized')
      .then((items) => {
        if (!items.Initialized) {
          // Storage is fresh. Add in defaults
          return this.setOptionDefaults()
            .then(() => {
              return this.setOpt({ Initialized: true });
            });
        }
      })
      .then(() => {
        this.initProviders();
      });
  }

  initProviders():Promise<{[key:string]:NZBUnityProviderOptions}> {
    return this.getOpt('Providers')
      .then((opts) => {
        let providers:{[key:string]:NZBUnityProviderOptions} = {};

        // get names from the manifest
        chrome.runtime.getManifest().content_scripts.forEach((i) => {
          let match = i.js && i.js[0] && i.js[0].match(/(\w+)\.js$/);
          let name = match ? match[1] : null;

          if (name && name !== 'site') {
            providers[name] = {
              Enabled: DefaultOptions.ProviderEnabled,
              Matches: i.matches,
              Js: i.js
            }

            if (opts.Providers[name]) {
              providers[name].Enabled = opts.Providers[name].Enabled;
            }
          }
        });

        return this.setOpt({ Providers: providers })
          .then(() => {
            return providers;
          });
      });
  }

  isValidOpt(opt:string | string[]):boolean {
    opt = Array.isArray(opt) ? opt : [opt];

    return opt.every((k:string) => {
      return Object.keys(DefaultOptions).indexOf(k) >= 0;
    });
  }

  /* PROFILE */

  profileTest(name:string):Promise<object> {
    if (!this.nzbHost) {
      return Promise.reject({ success: false, error: 'No connection to host' });
    }
    return this.nzbHost.test();
  }

  setActiveProfile(name:string = null):Promise<void> {
    let profiles:NZBUnityProfileDictionary;
    let profileNames:string[];

    return this.getOpt(['ActiveProfile', 'Profiles'])
      .then((opts) => {
        profiles = opts.Profiles;
        profileNames = Object.keys(profiles);

        if (!profileNames.length) {
          // No profiles, no set
          return this.setOpt({ ActiveProfile: DefaultOptions.ActiveProfile })
        }

        if (!name || !profileNames.includes(name)) {
          // Drfault to the current active (ie init), or the first profile
          name = profileNames.includes(opts.ActiveProfile)
            ? opts.ActiveProfile
            : profileNames[0];
        }

        return this.setOpt({ ActiveProfile: name })
      })
      .then(() => {
        // Ready to initizlize
        // TODO: NZBGet
        let profile:NZBUnityProfileOptions = profiles[name];

        if (profile) {
          if (profile.ProfileType === 'NZBGet') {
            this.nzbHost = new NZBGetHost(<StringDictionary> {
              displayName: name,
              host: profile.ProfileHost,
              username: profile.Username,
              password: profile.Password
            });
          } else {
            this.nzbHost = new SABnzbdHost(<StringDictionary> {
              displayName: name,
              host: profile.ProfileHost,
              apikey: profile.ProfileApiKey
            });
          }
        }
      });
  }

  /* DEBUGGING */

  error(...args:any[]) {
    console.error.apply(this, args);
  }

  debug(...args:any[]) {
    if (this._debug) console.debug.apply(this, args);
  }

  debugOpts() {
    this.getOpt().then((items) => {
      this.debug('[NZBUnity.debugOpts]', items);
    });
  }

  debugMessage(message:MessageEvent) {
    let msg = '';
    for (let k in message) {
      msg += `${k}: ${message[k]}`;
    }

    console.debug('[NZBUnity.debugMessage]', msg);
  }

  debugNotify(message:string):void {
    chrome.notifications.create('nzbunity.debug', {
      'type': 'basic',
      'iconUrl': chrome.extension.getURL('content/images/icon-32.png'),
      'title': 'NZB Unity Debug Message',
      'message': message
    });
  }
}

let nzbUnity:NZBUnity = new NZBUnity();
