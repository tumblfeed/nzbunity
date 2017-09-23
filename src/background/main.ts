declare interface NZBUnityProfileOptions extends Dictionary {
  ProfileName: string,
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

declare interface NZBUnityOptions extends NestedDictionary {
  Initialized: boolean,
  Debug: boolean,
  Profiles: { [key:string]: NZBUnityProfileOptions },
  ActiveProfile: string,
  Providers: { [key:string]: NZBUnityProviderOptions },
  ProviderNewznab: string,
  ProviderEnabled: boolean,
  // ProviderDisplay: boolean,
  RefreshRate: number,
  NotificationTimeout: number,
  EnableContextMenu: boolean,
  EnableNotifications: boolean,
  EnableNewznab: boolean,
  CategoriesUseGroupNames: boolean,
  CategoriesUseMenu: boolean,
  CategoriesUseHeader: boolean,
  CategoriesOverride: string,
  CategoriesDefault: string
};

const DisplayAvailableProviders:string[] = ['binsearch', 'nzbindex', 'yubse'];

const DefaultOptions:NZBUnityOptions = {
  Initialized: false,
  Debug: false,
  Profiles: {},
  ActiveProfile: '',
  ProviderEnabled: true,
  ProviderDisplay: true,
  Providers: {},
  ProviderNewznab: '',
  RefreshRate: 15,
  NotificationTimeout: 15,
  EnableContextMenu: true,
  EnableNotifications: true,
  EnableNewznab: true,
  CategoriesUseGroupNames: true,
  CategoriesUseMenu: true,
  CategoriesUseHeader: true,
  CategoriesOverride: '',
  CategoriesDefault: ''
};

class NZBUnity {
  public _debug:boolean;
  public storage:chrome.storage.StorageArea;
  public optionsTab:chrome.tabs.Tab;
  public nzbHost:NZBHost;

  constructor() {
    this.storage = chrome.storage.local

    // Initialize default options
    this.getOpt('Debug')
      .then((opts) => {
        this._debug = <boolean> opts.Debug;
        return this.initOptions()
      })
      .then(() => {
        this.debug('[NZBUnity.constructor] Options Ok');
        return this.getOpt('ActiveProfile');
      })
      .then((opts) => {
        // Initialize server connection
        return this.setActiveProfile();
      })
      .then(() => {
        this.debug('[NZBUnity.constructor] Active profile connected');

        // Handle messages from the UI
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
        this.debug('[NZBUnity.constructor] Message handler Ok');
      })
      .then(() => {
        this.debug('[NZBUnity.constructor] Init Done!');
      });
  }

  /* MESSAGING */

  handleMessage(message:MessageEvent) {
    if (this._debug) this.debugMessage(message);

    // Handle message
    for (let k in message) {
      let val:any = message[k];
      this.debug(k, val);

      switch (k) {
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

  sendOptionsMessage(name:string, data:any) {
    if (this.optionsTab) {
      chrome.tabs.sendMessage(this.optionsTab.id, { [`main.${name}`]: data });
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

          if (name && name !== 'common') {
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

  setActiveProfile(profile:string = null):Promise<void> {
    let profiles:{ [key:string]: NZBUnityProfileOptions };
    let profileNames:string[];

    return this.getOpt(['ActiveProfile', 'Profiles'])
      .then((opts) => {
        profiles = opts.Profiles;
        profileNames = Object.keys(profiles);

        if (!profileNames.length) {
          // No profiles, no set
          return this.setOpt({ ActiveProfile: DefaultOptions.ActiveProfile })
        }

        if (!profile || !profileNames.includes(profile)) {
          // Drfault to the current active (ie init), or the first profile
          profile = profileNames.includes(opts.ActiveProfile)
            ? opts.ActiveProfile
            : profileNames[0];
        }

        return this.setOpt({ ActiveProfile: profile })
      })
      .then(() => {
        // Ready to initizlize
        // TODO: NZBGet
        if (profiles[profile]) {
          this.nzbHost = new SABnzbdHost({
            host: profiles[profile].ProfileHost,
            apikey: profiles[profile].ProfileApiKey
          });
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
