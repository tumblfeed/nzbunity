class Popup {

  public _debug:boolean = false;
  public storage:chrome.storage.StorageArea;
  public profileCurrent:JQuery<HTMLElement>;
  public profileInputs:JQuery<HTMLElement>;

  public profiles:NZBUnityProfileDictionary;

  constructor() {
    this.profileCurrent = $('#ProfileCurrent');
    this.profileInputs = $('#profile-container input');

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

        $('#btn-refresh').on('click', (e) => {
          e.preventDefault();
          this.sendMessage('refresh');
        });

        $('#btn-server').on('click', (e) => {
          e.preventDefault();
          this.sendMessage('openProfilePage');
        });

        $('#btn-options').on('click', (e) => {
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

  update(data:Object, error:string = null) {
    this.debug('Popup.update', data, error);

    $('#error').empty();

    if (data) {
      // Summary
      $('#status').text(data['status']);
      $('#timeleft').text(data['eta']);
      $('#speed').text(data['speed']);
      $('#sizeleft').text(`${data['mbleft']}MB`);

      // Queue
      $('#queue > ul').empty();
      data['slots'].forEach((s:Dictionary) => {
        console.log(s);




      });



      // Viddles
      $('#override-category').empty();
      data['categories'].forEach((k:string) => {
        $('#override-category').append(`<option value="${k}">${k}</option>`);
      });
    }

    if (error) {
      $('#error').text(error);
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
              $('#btn-refresh, #btn-server').removeClass('disabled').prop('disabled', false);
            });
          break;

        case 'main.refresh':
          if (val.success === true) {
            this.update(val.result);
            $('#btn-refresh, #btn-server').removeClass('disabled').prop('disabled', false);
          } else if (val.success === false) {
            this.update({}, val.error);
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
