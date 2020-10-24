import { isArray } from "jquery";

class NZBUnity {
  public _debugMessages:string[] = [];
  public _debugMessagesMax:number = 1000;
  public optionsTab:chrome.tabs.Tab;
  public nzbHost:NZBHost;
  private refreshTimer:any;
  private interceptExclude:string;
  private newznabDetect:boolean;
  private newznabProviders:string;

  constructor() {
    // Initialize default options
    this.initOptions()
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

        // Handle messages from commands
        chrome.commands.onCommand.addListener(this.handleCommand.bind(this));
        this.debug('[NZBUnity.constructor] Command handler initialized');

        // Init storage on change watcher
        chrome.storage.onChanged.addListener(this.handleStorageChanged.bind(this));

        // Intercept response headers to check for NZB content
        return Util.storage.get(['InterceptDownloads', 'InterceptExclude', 'EnableNewznab', 'ProviderNewznab']);
      })
      .then((opts) => {
        if (opts.InterceptDownloads) {
          this.enableIntercept();
          this.interceptExclude = opts.InterceptExclude;
        }

        this.newznabDetect = opts.EnableNewznab;
        this.newznabProviders = opts.ProviderNewznab;
        this.enableNewznab();
      })
      .then(() => {
        this.debug('[NZBUnity.constructor] Init Done, starting!');
        this.refresh();
      });
  }

  /* HELPERS */

  getProviders():Promise<NZBUnityProviderDictionary> {
    return Util.storage.get(['Providers']).then(opts => opts.Providers);
  }

  async getProviderMatches():Promise<Array<string>> {
    const providers = await this.getProviders();
    const matches = Object.values(providers).map(p => p.Matches);
    return [].concat(...matches);
  }

  async getProviderMatchRegex():Promise<Array<RegExp>> {
    const matches = await this.getProviderMatches();
    return matches
      .map(m => m.replace('//*.', '//*').replace(/\*/g, '.*'))
      .map(m => new RegExp(`^${m}$`));
  }

  async isProvider(url:string):Promise<boolean> {
    const matches = await this.getProviderMatchRegex();
    return matches.some(re => re.test(url));
  }

  /* NOTIFICATIONS & MESSAGING */

  showNotification(id:string, title:string, message:string) {
    Util.storage.get('EnableNotifications')
      .then((opts) => {
        if (opts.EnableNotifications) {
          chrome.notifications.create(`nzbunity.${id}`, {
            'type': 'basic',
            'iconUrl': chrome.extension.getURL('content/images/icon-32.png'),
            'title': `NZB Unity - ${title}`,
            'message': message,
          });
        }
      });
  }

  sendMessage(name:string, data:any = null):Promise<any> {
    // this.debug('sendMessage', name);
    return Util.sendMessage({ [`main.${name}`]: data });
  }

  sendTabMessage(tab:chrome.tabs.Tab, name:string, data:any):Promise<any> {
    return tab
      ? Util.sendTabMessage(tab.id, { [`main.${name}`]: data })
        .catch((err) => {})
      : Promise.reject('Tab is required');
  }

  sendOptionsMessage(name:string, data:any) {
    // this.debug('sendOptionsMessage', this.optionsTab, name);
    return this.sendTabMessage(this.optionsTab, name, data);
  }

  /* OPERATIONS */

  startTimer() {
    this.stopTimer();

    Util.storage.get('RefreshRate')
      .then((opts) => {
        this.refreshTimer = setInterval(this.getQueue.bind(this), opts.RefreshRate * 1000);
      });
  }

  stopTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  refresh():Promise<NZBQueueResult> {
    return this.getQueue()
      .then((res) => {
        this.startTimer();
        return res;
      });
  }

  getQueue():Promise<NZBQueueResult> {
    if (!this.nzbHost) {
      return Promise.resolve(null);
    }

    return this.nzbHost.getQueue()
      .then((result) => {
        Util.setMenuIcon(result.status, result.status);
        this.sendMessage('refresh', result);
        return result;
      })
      .catch((err) => {
        console.warn('Could not retrieve Queue from host, please check settings.');
        return {
          status: 'Disconnected',
          speed: '0',
          speedBytes: 0,
          maxSpeed: '0',
          maxSpeedBytes: 0,
          sizeRemaining: '0',
          timeRemaining: '0',
          categories: [],
          queue: [],
        };
      });
  }

  async normalizeCategory(category:string | null | undefined):Promise<string> {
    const opts = await Util.storage.get(['DefaultCategory', 'IgnoreCategories', 'OverrideCategory', 'SimplifyCategories'])

    // Manage category options
    if (opts.IgnoreCategories) {
      return null;
    } else if (opts.OverrideCategory) {
      return opts.OverrideCategory;
    } else if (category && opts.SimplifyCategories) {
      return Util.simplifyCategory(category);
    } else if (!category && opts.DefaultCategory) {
      return opts.DefaultCategory;
    } else {
      return category;
    }
  }

  async addUrl(url:string, options:NZBAddOptions = {}):Promise<NZBAddUrlResult> {
    if (!this.nzbHost) return null;

    // Figure out the category
    const category = await this.normalizeCategory(options.category)

    this.debug('[NZBUnity.addUrl]', { ...options, category: `${options.category} &rarr; ${category}` });

    if (category) {
      options.category = category;
    } else {
      delete options.category;
    }

    // Send the URL to the downloader host
    const result = await this.nzbHost.addUrl(url, options)

    // Notify the user
    this.sendMessage('addUrl', result);
    this.showNotification(
      'addUrl',
      `${options.name || url} Added`,
      `${options.name || url} sucessfully added to ${this.nzbHost.displayName} (${this.nzbHost.name})`,
    );
    return result;
  }

  async addFile(filename:string, content:string, options:NZBAddOptions = {}):Promise<NZBAddUrlResult> {
    if (!this.nzbHost) return null;

    // Figure out the category
    const category = await this.normalizeCategory(options.category)

    this.debug('[NZBUnity.addFile]', { ...options, filename, category: `${options.category} &rarr; ${category}` });

    if (category) {
      options.category = category;
    } else {
      delete options.category;
    }

    // Send the file to the downloader host
    const result = await this.nzbHost.addFile(filename, content, options);

    // Notify the user
    this.sendMessage('addUrl', result);
    this.showNotification(
      'addUrl',
      `${filename} Added`,
      `${filename} sucessfully uploaded to ${this.nzbHost.displayName} (${this.nzbHost.name})`,
    );
    return result;
  }

  /* HANDLERS */

  handleMessage(message:MessageEvent, sender:any, sendResponse:(response:any) => void) {
    this.debugMessage(message);

    // Handle message
    for (const k in message) {
      const val:any = message[k];
      // this.debug(k, val);

      switch (k) {
        case 'util.request':
          this.debug(`[NZBUnity.handleMessage] util.request: ${val}`);
          sendResponse(undefined);
          break;

        // Newznab detection
        case 'newznab.enable':
          Util.storage.get(['ProviderNewznab'])
            .then((opts) => {
              let providers = opts.ProviderNewznab
                .split(/\s*,\s*/)
                .filter((i) => { return i; });

              providers.push(val);

              return Util.storage.set({
                ProviderNewznab: providers.join(','),
              });
            })
            .then(() => {
              this.debug(`[NZBUnity.handleMessage] ${val} added to Newznab providers`);
              sendResponse(true);
            });
          break;

        // Content Scripts
        case 'content.addUrl':
          this.addUrl(val.url, val)
            .then(res => sendResponse(res && res.success));
          break;

        case 'content.addFile':
          this.addFile(val.filename, val.content, val)
            .then(res => sendResponse(res && res.success));
          break;

        // Popup Messages
        case 'popup.profileSelect':
          this.setActiveProfile(val);
          sendResponse(undefined);
          break;

        case 'popup.resumeQueue':
          if (this.nzbHost) {
            this.nzbHost.resumeQueue()
              .then(() => {
                this.refresh();
                sendResponse(undefined);
              });
          }
          break;

        case 'popup.pauseQueue':
          if (this.nzbHost) {
            this.nzbHost.pauseQueue()
              .then(() => {
                this.refresh();
                sendResponse(undefined);
              });
          }
          break;

        case 'popup.setMaxSpeed':
          if (this.nzbHost) {
            this.nzbHost.setMaxSpeed(val)
              .then(() => {
                this.refresh();
                sendResponse(undefined);
              });
          }
          break;

        case 'popup.refresh':
          this.refresh();
          sendResponse(undefined);
          break;

        case 'popup.debug':
          this.sendMessage('debug', this._debugMessages);
          sendResponse(undefined);
          break;

        case 'popup.openProfilePage':
          this.openProfilePage();
          break;

        // Options Messages
        case 'options.onTab':
          this.optionsTab = val;
          this.sendOptionsMessage('onTab', true)
            .then(res => sendResponse(res && res.success));
          break;

        case 'options.setOptions':
          if (this.isValidOpt(Object.keys(val))) {
            Util.storage.set(val);
          } else {
            this.error('items contain invalid option names');
          }
          sendResponse(undefined);
          break;

        case 'options.resetOptions':
          this.resetOptions()
            .then(() => {
              this.sendOptionsMessage('resetOptions', true)
                .then(res => sendResponse(res && res.success));
            });
          break;

        case 'options.profileNameChanged':
          Util.storage.get('ActiveProfile')
            .then((opts) => {
              if (val.old = opts.ActiveProfile) {
                this.setActiveProfile(val.new);
              }
              sendResponse(undefined);
            });
          break;

        case 'options.profilesSaved':
          this.setActiveProfile();
          sendResponse(undefined);
          break;

        case 'options.profileTest':
          this.sendOptionsMessage('profileTestStart', true);
          this.profileTest(val)
            .then(r => this.sendOptionsMessage('profileTestEnd', r))
            .catch(error => this.sendOptionsMessage('profileTestEnd', { success: false, error }));
          sendResponse(undefined);
          break;
      }
    }

    return true;
  }

  handleCommand(command:chrome.commands.CommandEvent) {
    this.debugCommand(command);

    // Handle command
    switch (String(command)) {
      case 'resume-queue':
        if (this.nzbHost) {
          this.nzbHost.resumeQueue()
            .then(() => this.refresh());
        }
        break;

      case 'pause-queue':
        if (this.nzbHost) {
          this.nzbHost.pauseQueue()
            .then(() => this.refresh());
        }
        break;

      case 'toggle-queue':
        if (this.nzbHost) {
          this.nzbHost.getQueue()
            .then((queue:NZBQueueResult) => {
              return queue.status.toLowerCase() === 'paused'
                ? this.nzbHost.resumeQueue()
                : this.nzbHost.pauseQueue()
            })
            .then(r => this.refresh());
        }
        break;

      // TODO: Needs preset restricted speed
      // case 'set-max-speed':
      //   if (this.nzbHost) {
      //     this.nzbHost.setMaxSpeed(val)
      //       .then((r) => {
      //         this.refresh();
      //         sendResponse(undefined);
      //       });
      //   }
      //   break;

      case 'refresh':
        this.refresh();
        break;

      case 'open-profile-page':
        this.openProfilePage();
        break;
    }
  }

  handleStorageChanged(changes:{ string: chrome.storage.StorageChange }, area:string) {
    this.debug('[OptionsPage.handleStorageChanged] ',
      Object.keys(changes)
        .map(k => `${k} -> ${changes[k].newValue}`)
        .join(', ')
    );

    // If Intercept download has changed, we need to enable/disable
    if (changes['InterceptDownloads']) {
      if (changes['InterceptDownloads'].newValue) {
        this.enableIntercept();
        return Util.storage.get(['InterceptExclude'])
          .then((opts) => {
            this.interceptExclude = opts.InterceptExclude;
          });
      } else {
        this.disableIntercept();
      }
    }

    if (changes['InterceptExclude']) {
      this.interceptExclude = changes['InterceptExclude'].newValue;
    }

    if (changes['ProviderNewznab']) {
      this.newznabProviders = changes['ProviderNewznab'].newValue;
    }

    if (changes['Debug']) {
      if (!changes['Debug'].newValue) {
        this._debugMessages.splice(0);
      }
    }
  }

  /* OPTIONS */

  isValidOpt(opt:string | string[]):boolean {
    opt = Array.isArray(opt) ? opt : [opt];
    return opt.every(k => Object.keys(DefaultOptions).indexOf(k) >= 0);
  }

  resetOptions():Promise<void> {
    return Util.storage.clear()
      .then(() => this.initOptions());
  }

  setOptionDefaults():Promise<void> {
    return Util.storage.set(DefaultOptions);
  }

  initOptions():Promise<void> {
    return Util.storage.get(null)
      .then((opts) => {
        if (opts.Initialized) {
          // Storage has existing options, check for anything new in the default
          for (let k in DefaultOptions) {
            if (opts[k] === undefined) {
              Util.storage.set({ [k]: DefaultOptions[k] });
            }
          }
        } else {
          // Storage is fresh. Add in defaults
          return this.setOptionDefaults()
            .then(() => Util.storage.set({ Initialized: true }));
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
          const js:string = i.js && i.js.pop();
          const [match, name] = js && js.match(/(\w+)\.js$/);

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
          .then(() => providers);
      });
  }

  openProfilePage():Promise<any> {
    return this.getActiveProfile()
      .then((profile) => {
        if (profile) {
          let url:string;

          if (profile.ProfileServerUrl) {
            // Profile server url present, just use that
            url = profile.ProfileServerUrl;
          } else if (profile.ProfileHostAsEntered) {
            // No Profile server url, and host url is api, try to make it nice.
            url = profile.ProfileHost.replace(/\/?(api|jsonrpc)$/ig, '');
          } else {
            // Default to host
            url = profile.ProfileHost;
          }

          // Ensure protocol so the browser doesn't prefix the addon url
          if (!/^[a-z]+:\/\//i.test(url)) {
            url = `http://${url}`;
          }

          chrome.tabs.create({ url });
        }
      });
  }

  /* INTERCEPT */

  enableIntercept() {
    chrome.webRequest.onHeadersReceived.addListener(
      this.handleHeadersReceived.bind(this),
      {
        urls: ["<all_urls>"],
        types: ["main_frame", "sub_frame"]
      },
      ["responseHeaders", "blocking"],
    );
    this.debug('[NZBUnity] NZB download intercept enabled');
  }

  disableIntercept() {
    chrome.webRequest.onHeadersReceived.removeListener(
      this.handleHeadersReceived.bind(this),
    );
    this.debug('[NZBUnity] NZB download intercept disabled');
  }

  async isInterceptAllowed(url:string):Promise<boolean> {
    if (!this.interceptExclude || !url) return true;

    const isProvider = await this.isProvider(url);
    if (isProvider) return false;

    return this.interceptExclude.split(/\s*,\s*/)
      .map(host => new RegExp(host))
      .every(hostRe => !hostRe.test(Util.parseUrl(url).host));
  }

  async handleHeadersReceived(details:chrome.webRequest.WebResponseHeadersDetails) {
    const url:string = details.url;
    let type:string;
    let disposition:string;
    let dnzb:DirectNZB = {};

    details.responseHeaders.forEach((h) => {
      let k:string = h.name.toLowerCase();

      if (k === 'content-type') {
        type = h.value.split(/;\s*/)[0].toLowerCase();
      } else if (k === 'content-disposition') {
        disposition = h.value;
      } else if (k.startsWith('x-dnzb')) {
        dnzb[k.replace('x-dnzb-', '')] = h.value;
      }
    });

    const allowed = await this.isInterceptAllowed(url);

    // Intercept if NZB and not excluded
    let dispositionMatch = disposition && disposition.match(/^attachment;\s*filename="?(.*(\.nzb))"?$/i);
    if (
      allowed
      && (details.method == 'GET')
      && (type === 'application/x-nzb' || dispositionMatch)
    ) {
      // console.log('===================HEADERS=================');
      // console.log(`URL: ${url}`);
      // console.log(`Type: ${type}`);
      // console.log(`Disposition: ${disposition}`);
      // for (let k in dnzb) {
      //   console.log(`${k}: ${dnzb[k]}`);
      // }
      // console.log('===================HEADERS=================');

      const options:NZBAddOptions = {};

      if (dnzb.name) options.name = dnzb.name;
      else if (dispositionMatch) options.name = dispositionMatch[1];

      if (dnzb.category) options.category = dnzb.category;

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

  /* NEWZNAB */

  enableNewznab() {
    chrome.tabs.onUpdated.addListener(this.handleNewznabTabUpdated.bind(this));
    this.debug('[NZBUnity] Newznab detection enabled');
  }

  disableNewznab() {
    chrome.tabs.onUpdated.removeListener(this.handleNewznabTabUpdated.bind(this));
    this.debug('[NZBUnity] Newznab detection disabled');
  }

  isNewznabProvider(url:string):boolean {
    if (!this.newznabProviders || !url) return false;

    return this.newznabProviders.split(/\s*,\s*/)
      .map(host => new RegExp(host))
      .some(hostRe => hostRe.test(Util.parseUrl(url).host));
  }

  async handleNewznabTabUpdated(tabId:number, changes:chrome.tabs.TabChangeInfo, tab:chrome.tabs.Tab) {
    if (tab.status === 'complete' && /^https?:/.test(tab.url)) {
      // Only do default newznab stuff if this is not a 1-click provider
      const isProvider = await this.isProvider(tab.url);
      if (isProvider) return;

      // Do Newznab detection / loading
      if (this.isNewznabProvider(tab.url)) {
        // Check if URL matches known newznab sites, as this is less intrusive
        chrome.tabs.executeScript(tabId, { file: 'vendor/jquery-3.3.1.slim.min.js' }, () => {
          chrome.tabs.executeScript(tabId, { file: 'background/util.js' }, () => {
            chrome.tabs.executeScript(tabId, { file: 'content/sites/newznab.js' });
          });
        });
      } else if (this.newznabDetect) {
        // If autodetection is enabled, check every site for newznabbiness
        chrome.tabs.executeScript(tabId, { file: 'content/sites/newznab-detect.js' });
      }
    }
  }

  /* PROFILE */

  profileTest(name:string):Promise<NZBResult> {
    return this.nzbHost
      ? this.nzbHost.test()
      : Promise.reject({ success: false, error: 'No connection to host' });
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
        const profile:NZBUnityProfileOptions = profiles[name];

        if (profile) {
          if (profile.ProfileType === 'NZBGet') {
            this.nzbHost = new NZBGetHost({
              displayName: name,
              host: profile.ProfileHost,
              username: profile.ProfileUsername,
              password: profile.ProfilePassword,
              hostAsEntered: profile.ProfileHostAsEntered
            } as Dictionary);
          } else {
            this.nzbHost = new SABnzbdHost({
              displayName: name,
              host: profile.ProfileHost,
              apikey: profile.ProfileApiKey,
              hostAsEntered: profile.ProfileHostAsEntered
            } as Dictionary);
          }

          return { success: true, result: name };
        } else {
          return { success: false, error: 'Profile not found' };
        }
      });
  }

  getActiveProfile():Promise<NZBUnityProfileOptions> {
    return Util.storage.get(['ActiveProfile', 'Profiles'])
      .then(opts => opts.Profiles[opts.ActiveProfile]);
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
    Util.storage.get('Debug')
      .then((opts) => {
        if (opts.Debug) {
          const msg = args.map((arg) => {
            switch (typeof arg) {
              case 'object':
                return Object.keys(arg)
                  .map(k => `&nbsp;&nbsp;&nbsp;<span class="green">${k}</span>: ${arg[k]}`)
                  .join('\n');
              default:
                return `${arg}`.replace(/^\[(.*)\]/, '<span class="green">[$1]</span>');
            }
          }).join('\n');

          this._debugMessages.push(msg);
          while (this._debugMessages.length > this._debugMessagesMax) {
            this._debugMessages.shift();
          }

          this.sendMessage('debug', this._debugMessages);

          console.debug.apply(this, args);
        }
      });
  }

  debugOpts(opts:any = null) {
    Util.storage.get(opts).then((items) => {
      this.debug('[NZBUnity.debugOpts]', items);
    });
  }

  debugMessage(message:MessageEvent) {
    Util.storage.get('Debug')
      .then((opts) => {
        if (opts.Debug) {
          for (let k in message) {
            console.debug('[NZBUnity.debugMessage]', k, message[k]);
          }
        }
      });
  }

  debugCommand(command:chrome.commands.CommandEvent) {
    Util.storage.get('Debug')
      .then((opts) => {
        if (opts.Debug) {
          console.debug('[NZBUnity.debugCommand]', command);
        }
      });
  }
}

let nzbUnity:NZBUnity = new NZBUnity();
