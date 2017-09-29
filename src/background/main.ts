class NZBUnity {
  public _debug:boolean;
  public optionsTab:chrome.tabs.Tab;
  public nzbHost:NZBHost;
  private refreshTimer:number;

  constructor() {
    // Initialize default options
    Util.storage.get('Debug')
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
        return Util.storage.get('InterceptDownloads');
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
    Util.storage.get('EnableNotifications')
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

  sendMessage(name:string, data:any = null):Promise<any> {
    return Util.sendMessage({ [`main.${name}`]: data });
  }

  sendTabMessage(tab:chrome.tabs.Tab, name:string, data:any):Promise<any> {
    if (tab) {
      return Util.sendTabMessage(tab.id, { [`main.${name}`]: data });
    }
  }

  sendOptionsMessage(name:string, data:any) {
    this.sendTabMessage(this.optionsTab, name, data);
  }

  /* OPERATIONS */

  startTimer() {
    this.stopTimer();

    Util.storage.get('RefreshRate')
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

  refresh():Promise<NZBQueueResult> {
    this.startTimer();
    return this.getQueue();
  }

  getQueue():Promise<NZBQueueResult> {
    if (!this.nzbHost) {
      return Promise.resolve(null);
    }

    return this.nzbHost.getQueue()
      .then((result) => {
        this.sendMessage('refresh', result);
        return result;
      });
  }

  addUrl(url:string, options:NZBAddOptions = {}):Promise<NZBAddUrlResult> {
    if (!this.nzbHost) {
      return null;
    }

    return Util.storage.get(['OverrideCategory', 'DefaultCategory', 'SimplifyCategories'])
      .then((opts) => {
        // Manage category options
        if (opts.OverrideCategory) {
          this.debug(`[NZBUnity.addUrl] Override caterory: ${opts.OverrideCategory}`);
          options.category = opts.OverrideCategory;
        } else if (options.category && opts.SimplifyCategories) {
          options.category = Util.simplifyCategory(options.category);
        } else if (!options.category && opts.DefaultCategory) {
          options.category = opts.DefaultCategory;
        }

        return this.nzbHost.addUrl(url, options)
      })
      .then((result) => {
        this.sendMessage('addUrl', result);
        this.showNotification(
          'addUrl',
          `${options.name || url} Added`,
          `${options.name || url} sucessfully added to ${this.nzbHost.displayName} (${this.nzbHost.name})`
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
        options.name = dispositionMatch[1];
      }
      if (dnzb.Category) {
        options.category = dnzb.Category;
      }

      this.addUrl(url, options)
        .then((r) => {
          console.info(`[NZBUnity] NZB intercepted, ${r.success ? 'Success' : 'Failure'}
  ${url}
  ${options.name || ''}
  ${!r.success ? 'Error: ' + r.error : ''}`
          );
        });

      return { cancel: true };
    } else {
      return;
    }
  }

  handleMessage(message:MessageEvent, sender:any, sendResponse:(response:any) => void) {
    if (this._debug) this.debugMessage(message);

    // Handle message
    for (let k in message) {
      let val:any = message[k];
      this.debug(k, val);

      switch (k) {
        case 'util.request':
          console.log('util.request', val);
          break;

        // Content Scripts
        case 'content.addUrl':
          this.addUrl(val.url, val)
            .then((r) => {
              sendResponse(r);
            });
          break;

        // Popup Messages
        case 'popup.profileSelect':
          this.setActiveProfile(val);
          break;

        case 'popup.resumeQueue':
          if (this.nzbHost) {
            this.nzbHost.resumeQueue()
              .then((r) => {
                this.refresh();
              });
          }
          break;

        case 'popup.pauseQueue':
          if (this.nzbHost) {
            this.nzbHost.pauseQueue()
              .then((r) => {
                this.refresh();
              });
          }
          break;

        case 'popup.setMaxSpeed':
          if (this.nzbHost) {
            this.nzbHost.setMaxSpeed(val)
              .then((r) => {
                this.refresh();
              });
          }
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

        // Options Messages
        case 'options.onTab':
          this.optionsTab = val;
          this.sendOptionsMessage('onTab', true);
          break;

        case 'options.setOptions':
          if (this.isValidOpt(Object.keys(val))) {
            Util.storage.set(val);
          } else {
            this.error('items contain invalid option names');
          }
          break;

        case 'options.resetOptions':
          this.resetOptions()
            .then((r) => {
              this.sendOptionsMessage('resetOptions', true);
            });
        break;

        case 'options.profileNameChanged':
          Util.storage.get('ActiveProfile')
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
            .then((r) => {
              this.sendOptionsMessage('profileTestEnd', r);
            })
            .catch((err) => {
              this.sendOptionsMessage('profileTestEnd', { success: false, error: err });
            });
          break;
      }
    }
  }

  /* OPTIONS */

  resetOptions():Promise<void> {
    return Util.storage.clear()
      .then(() => {
        return this.initOptions();
      });
  }

  setOptionDefaults():Promise<void> {
    return Util.storage.set(DefaultOptions);
  }

  initOptions():Promise<void> {
    return Util.storage.get('Initialized')
      .then((items) => {
        if (!items.Initialized) {
          // Storage is fresh. Add in defaults
          return this.setOptionDefaults()
            .then(() => {
              return Util.storage.set({ Initialized: true });
            });
        }
      })
      .then(() => {
        this.initProviders();
      });
  }

  initProviders():Promise<{[key:string]:NZBUnityProviderOptions}> {
    return Util.storage.get('Providers')
      .then((opts) => {
        let providers:{[key:string]:NZBUnityProviderOptions} = {};

        // get names from the manifest
        chrome.runtime.getManifest().content_scripts.forEach((i) => {
          let js:string = i.js && i.js.pop();
          let match = js && js.match(/(\w+)\.js$/);
          let name = match ? match[1] : null;

          if (name && name !== 'util') {
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

        return Util.storage.set({ Providers: providers })
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

  profileTest(name:string):Promise<NZBResult> {
    if (!this.nzbHost) {
      return Promise.reject({ success: false, error: 'No connection to host' });
    }
    return this.nzbHost.test();
  }

  setActiveProfile(name:string = null):Promise<NZBResult> {
    let profiles:NZBUnityProfileDictionary;
    let profileNames:string[];

    return Util.storage.get(['ActiveProfile', 'Profiles'])
      .then((opts) => {
        profiles = opts.Profiles;
        profileNames = Object.keys(profiles);

        if (!profileNames.length) {
          // No profiles, no set
          return Util.storage.set({ ActiveProfile: DefaultOptions.ActiveProfile })
        }

        if (!name || !profileNames.includes(name)) {
          // Drfault to the current active (ie init), or the first profile
          name = profileNames.includes(opts.ActiveProfile)
            ? opts.ActiveProfile
            : profileNames[0];
        }

        return Util.storage.set({ ActiveProfile: name })
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

          return { success: true, result: name };
        } else {
          return { success: false, error: 'Profile not found' };
        }
      });
  }

  /* DEBUGGING */

  enableDebug(debug:boolean = true) {
    Util.storage.set({ Debug: debug }).then(() => {
      this.debugOpts();
    });
  }

  error(...args:any[]) {
    console.error.apply(this, args);
  }

  debug(...args:any[]) {
    if (this._debug) console.debug.apply(this, args);
  }

  debugOpts() {
    Util.storage.get(null).then((items) => {
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
}

let nzbUnity:NZBUnity = new NZBUnity();
