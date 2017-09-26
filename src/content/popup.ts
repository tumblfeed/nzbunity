class Popup {

  public _debug:boolean = false;
  public storage:chrome.storage.StorageArea;
  public profiles:NZBUnityProfileDictionary;
  public profileCurrent:JQuery<HTMLElement>;
  public btnRefresh:JQuery<HTMLElement>;
  public btnServer:JQuery<HTMLElement>;
  public btnOptions:JQuery<HTMLElement>;
  public overrideCategory:JQuery<HTMLElement>;

  public errorVal:JQuery<HTMLElement>;
  public statusVal:JQuery<HTMLElement>;
  public speedVal:JQuery<HTMLElement>;
  public sizeVal:JQuery<HTMLElement>;
  public timeVal:JQuery<HTMLElement>;
  public queue:JQuery<HTMLElement>;


  constructor() {
    this.profileCurrent = $('#ProfileCurrent');
    this.btnRefresh = $('#btn-refresh');
    this.btnServer = $('#btn-server');
    this.btnOptions = $('#btn-options');
    this.overrideCategory = $('#override-category');

    this.errorVal = $('#error');
    this.statusVal = $('#status .val');
    this.speedVal = $('#speed .val');
    this.sizeVal = $('#sizeleft .val');
    this.timeVal = $('#timeleft .val');
    this.queue = $('#queue');

    // Init data
    this.storage = chrome.storage.local

    // Init options
    this.getOpt(null)
      .then((opts) => {
        this._debug = opts.Debug;
        this.debug('[Popup.constructor] Got data!', opts);

        this.profiles = opts.Profiles;

        // Set up profile listeners
        this.profileCurrent.on('change', this.handleProfileSelect.bind(this));
        this.profileSelectUpdate();
        this.setActiveProfile();

        // Init storage on change watcher
        chrome.storage.onChanged.addListener(this.handleStorageChanged.bind(this));

        this.btnRefresh.on('click', (e) => {
          e.preventDefault();
          this.sendMessage('refresh');
        });

        this.btnServer.on('click', (e) => {
          e.preventDefault();
          this.sendMessage('openProfilePage');
        });

        this.btnOptions.on('click', (e) => {
          e.preventDefault();
          chrome.runtime.openOptionsPage();
        });

        // TODO: Remove
        $('#btn-command').on('click', (e) => {
          this.sendMessage('command', $('#command').val());
        });

        this.sendMessage('refresh');
      });

    // Handle messages from the UI
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    this.sendMessage('onInit', 'Popup initialized.');
  }

  update(queue:NZBQueueResult, error:string = null) {
    // this.debug('Popup.update', queue, error);
    this.errorVal.empty();

    if (queue) {
      // Summary
      this.statusVal.text(queue.status);
      this.speedVal.text(queue.speed);
      this.sizeVal.text(queue.sizeRemaining);
      this.timeVal.text(queue.timeRemaining);

      // Queue
      this.queue.empty();
      queue.queue.forEach((i) => {
        console.log(i);

        this.queue.append(`<div class="">
          <span class="name" title="${i.name}">${this.trunc(i.name, 20)}</span>
          ${i.category} ${i.size} ${i.percentage}
        </div>`);


      });

      // Viddles
      this.overrideCategory.empty().append(`<option val=""></option>`);
      queue.categories.forEach((k:string) => {
        this.overrideCategory.append(`<option value="${k}">${k}</option>`);
      });
    }

    if (error) {
      this.errorVal.text(error);
    }
  }

  /* MESSAGING */

  sendMessage(name:string, data:any = null) {
    chrome.runtime.sendMessage({ [`popup.${name}`]: data });
  }

  handleMessage(message:MessageEvent) {
    if (this._debug) this.debugMessage(message);

    // Handle message
    for (let k in message) {
      let val:any = message[k];

      switch (k) {
        case 'main.activeProfileSet':
          this.debug('activeProfileSet', val);
          this.getOpt('ActiveProfile')
            .then((opts) => {
              this.profileCurrent.val(opts.ActiveProfile);
              this.sendMessage('refresh');
            });
          break;

        case 'main.refresh':
          this.update(<NZBQueueResult> val)
          if (val) {
            $('#btn-refresh, #btn-server').removeClass('disabled').prop('disabled', false);
          }
          break;

        case 'options.profileNameChanged':
          if (val.old = this.profileCurrent.val()) {
            this.profileSelectUpdate();
            this.setActiveProfile(val.new);
          }
          break;

        case 'options.profilesSaved':
          this.profileSelectUpdate();
          break;

        // TODO: Remove
        case 'main.commandResult':
          $('#output').empty().text(JSON.stringify(val, null, 2));
          break;
      }
    }
  }

  /* HANDLERS */

  handleStorageChanged(changes:{ string: chrome.storage.StorageChange }, area:string) {
    // If ProfileName has changed, we need to update the select field.
    if (changes['Profiles']) {
      let profiles:Object = changes['Profiles'].newValue;
      let profilesCount:number = Object.keys(profiles).length;

      let oldProfiles:Object = changes['Profiles'].newValue;
      let oldProfilesCount:number = Object.keys(oldProfiles).length;

      if (profilesCount !== oldProfilesCount) {
        // Profile added or removed
        this.profileSelectUpdate();

        if (!profilesCount) {
          // All profiles removed
          this.profileCurrent.val('');
        }
      }

      for (let k in profiles) {
        if (profiles[k].ProfileName !== k) {
          this.profileNameChanged(k, profiles[k].ProfileName);
        }
      }
    }
  }

  handleProfileSelect(e:Event) {
    let el = $(e.currentTarget);
    this.setActiveProfile(<string> el.val());
  }

  /* PROFILES */

  profileNameChanged(oldName:string, newName:string) {
    if (this.profileCurrent.val() === oldName) {
      this.profileSelectUpdate();
      this.setActiveProfile(newName);
    }
  }

  profileSelectUpdate() {
    this.profileCurrent.empty();
    for (let k in this.profiles) {
      this.profileCurrent.append(`<option value="${k}">${k}</option>`);
    }
  }

  setActiveProfile(name:string = undefined) {
    if (name) {
      if (this.profiles[name]) {
        this.debug('[Popup.profileSelect]', name);
        this.sendMessage('profileSelect', name);
      }
    } else {
      this.getOpt('ActiveProfile')
        .then((opts) => {
          this.debug('[Popup.profileSelect]', opts.ActiveProfile);
          this.sendMessage('profileSelect', opts.ActiveProfile);
        });
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

  /* UTILITY */

  trunc(s:string, n:number):string {
    return (s.length > n) ? s.substr(0, n - 1) + '&hellip;' : s;
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

    console.debug('[Popup.debugMessage]', msg);
  }
}

let popup = new Popup();
