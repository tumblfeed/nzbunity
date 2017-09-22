const DefaultOptions = {
  Initialized: false,
  Debug: false,
  Profiles: {},
  ProviderEnabled: true,
  ProviderDisplay: true,
  Providers: {},
  ProviderNewznab: '',
  RefreshRate: 15,
  NotificationTimeout: 15,
  EnableGraph: true,
  EnableContextMenu: true,
  EnableNotifications: true,
  EnableNewznab: true,
  DebugNotifications: true,
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

  constructor() {
    this.storage = chrome.storage.local

    // Initialize default options
    this.getOpt('Debug')
      .then((items) => {
        this._debug = items.Debug;
        return this.initOptions()
      })
      .then(() => {
        this.debug('[NZBUnity.constructor] Options Ok!');
      })
      .then(() => {
        // Handle messages from the UI
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
        this.debug('[NZBUnity.constructor] Message handler Ok!');
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
      this.debug(k, message[k]);
      switch (k) {
        case 'options.onTab':
          this.optionsTab = message[k];
          this.sendOptionsMessage('onTab', true);
          break;

        case 'options.setOptions':
          if (this.isValidOpt(Object.keys(message[k]))) {
            this.setOpt(message[k]);
          } else {
            this.error('items contain invalid option names');
          }
          break;

        case 'options.resetOptions':
          this.setOptionDefaults()
            .then(() => {
              this.sendOptionsMessage('resetOptions', true);
            });
          break;

        case 'options.profileTest':
          this.sendOptionsMessage('profileTestStart', true);
          this.profileTest(message[k])
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

  getOpt(keys: string | string[] | Object | null):Promise<{ [key: string]: any }> {
    return new Promise((resolve, reject) => {
      this.storage.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }

  setOpt(items: Object):Promise<void> {
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

  isValidOpt(opt:string | string[]):boolean {
    opt = Array.isArray(opt) ? opt : [opt];

    return opt.every((k:string) => {
      return Object.keys(DefaultOptions).indexOf(k) >= 0;
    });
  }

  initOptions():Promise<any> {
    return this.getOpt('Initialized')
      .then((items) => {
        if (!items.Initialized) {
          // Storage is fresh. Add in defaults
          return this.setOptionDefaults()
            .then(() => {
              return this.setOpt({ Initialized: true });
            });
        }
      });
  }

  setOptionDefaults():Promise<any> {
    DefaultOptions.Providers = {};
    Object.keys(Providers).forEach((k) => {
      DefaultOptions.Providers[k] = {
        enabled: DefaultOptions.ProviderEnabled,
        display: DefaultOptions.ProviderDisplay,
        displayAvailable: Providers[k].displayAvailable || false
      };
    });

    return this.setOpt(DefaultOptions)
      .catch((err) => {
        this.error('[NZBUnity.setOptionDefaults]', err);
      });
  }

  /* PROFILE */

  profileTest(name:string):Promise<object> {
    return new Promise((resolve, reject) => {
      resolve({ success: true, message: '' });
    });
  }

  /* DEBUGGING */

  error(...args:any[]) {
    console.error.apply(this, args);
  }

  debug(...args:any[]) {
    if (this._debug) console.debug.apply(this, args);
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
