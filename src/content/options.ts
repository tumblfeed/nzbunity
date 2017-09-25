class OptionsPage {

  public _debug:boolean = false;
  public storage:chrome.storage.StorageArea;
  public form:JQuery<HTMLElement>;
  public elements:JQuery<HTMLElement>;

  public providers:NZBUnityProviderDictionary;
  public profiles:NZBUnityProfileDictionary;
  public profileData:NZBUnityProfileOptions;
  public profileCurrent:JQuery<HTMLElement>;
  public profileButtons:JQuery<HTMLElement>;
  public profileInputs:JQuery<HTMLElement>;

  public providerInputs:JQuery<HTMLElement>;

  constructor() {
    this.providers = {};
    this.form = $('#FormSettings');
    this.elements = $();
    this.profileCurrent = $('#ProfileCurrent');
    this.profileButtons = $('#profile-controls button, #profileTest');
    this.profileInputs = $('#profile-container').find('input, select');

    // Init data
    this.storage = chrome.storage.local

    // Init tab stuff
    chrome.tabs.getCurrent((tab:chrome.tabs.Tab) => {
      this.sendMessage('onTab', tab);
    });

    // Init options
    this.getOpt(null)
      .then((opts) => {
        this._debug = opts.Debug;
        this.debug('[OptionsPage.constructor] Got data!', opts);

        this.providers = opts.Providers;
        this.profiles = opts.Profiles;

        // Init field contents
        let elements:JQuery<HTMLElement>[] = [];
        for (let k in opts) {
          let el = $(`#${k}`);
          if (el.length) {
            elements.push(el);
            if (el.attr('type') === 'checkbox') {
              el.prop('checked', <boolean> opts[k]);
            } else {
              el.val(<string> opts[k]);
            }
          }
        }
        this.elements = $(elements.map((el) => { return el.get(0); }));

        // Set up form -> storage binding
        this.elements.on('input', (e) => {
          let el = $(e.currentTarget);
          let val = el.attr('type') === 'checkbox'
            ? el.prop('checked')
            : el.val();

          this.setOpt({ [el.attr('id')]: val });
        });

        this.debug('[OptionsPage.constructor] Bound form elements: ',
          this.elements.toArray()
            .map((el) => { return el.id; })
            .join(', ')
        );

        // Set up profile listeners
        this.profileCurrent.on('change', this.handleProfileSelect.bind(this));
        this.profileInputs.on('input', this.handleProfileInput.bind(this));
        this.profileButtons.on('click', this.handleProfileButton.bind(this));
        this.profileSelectUpdate();
        this.profileSelectFirst();

        // Set up provider checkboxes and listeners
        for (let k in this.providers) {
          let el = this.getProviderElement(k, this.providers[k]);
          el.find('input').prop('checked', this.providers[k].Enabled);
          el.appendTo('#provider-enabled-container');

          // if (this.providers[k].displayAvailable) {
          //   el = this.getProviderElement(k, true);
          //   el.find('input').prop('checked', this.providers[k].Display);
          //   el.appendTo('#provider-display-container');
          // }
        }

        this.providerInputs = $('input[type="checkbox"][id^="Provider"]');
        this.providerInputs.on('change', this.handleProviderInput.bind(this));

        // Init storage on change watcher
        chrome.storage.onChanged.addListener(this.handleStorageChanged.bind(this));

        // Reset watcher
        $('#ResetOptions').on('click', (e)=> {
          if (confirm('Are you sure you want to reset all settings? This cannot be undone.')) {
            this.sendMessage('resetOptions', true);
          }
        });
      });

    // Handle messages from the UI
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    this.sendMessage('onInit', 'Options initialized.');
  }

  /* MESSAGING */

  sendMessage(name:string, data:any) {
    chrome.runtime.sendMessage({ [`options.${name}`]: data });
  }

  handleMessage(message:MessageEvent) {
    if (this._debug) this.debugMessage(message);

    // Handle message
    for (let k in message) {
      let val:any = message[k];

      switch (k) {
        case 'main.resetOptions':
          if(message[k]) {
            window.location.reload();
          }
          break;

        case 'main.profileTestStart':
          this.profileTestStart();
          break;

        case 'main.profileTestResult':
          console.log(val);
          if (val.success) {
            this.profileTestSuccess();
          } else {
            let error:string;

            if (typeof val.error === 'string') {
              error = val.error;
            } if (val.error.statusText) {
              error = val.error.statusText;
            } if (val.error.status === 0) {
              error = 'Could not connect to host';
            }

            this.profileTestFailure(error);
          }
          break;
      }
    }
  }

  /* HANDLERS */

  handleStorageChanged(changes:{ string: chrome.storage.StorageChange }, area:string) {
    // this.debug('[OptionsPage.handleStorageChanged] ',
    //     Object.keys(changes)
    //         .map((k) => { return `${k} -> ${changes[k].newValue}`; })
    //         .join(', ')
    // );

    // If ProfileName has changed, we need to update the select field.
    if (changes['Profiles']) {
      let profiles:Object = changes['Profiles'].newValue;
      for (let k in profiles) {
        if (profiles[k].ProfileName !== k) {
          this.profileNameChanged(k, profiles[k].ProfileName);
        }
      }

      this.profileTestClear();
    }
  }

  handleProfileSelect(e:Event) {
    let el = $(e.currentTarget);
    this.profileSelect(<string> el.val());
  }

  handleProfileButton(e:Event) {
    let el = $(e.currentTarget);
    e.preventDefault();

    // this.debug('[OptionsPage.handleProfileButton] ', el.attr('id'));

    if (typeof this[el.attr('id')] === 'function') {
      this[el.attr('id')]();
    }
  }

  handleProfileInput(e:Event) {
    let el = $(e.currentTarget);

    this.debug('[OptionsPage.handleProfileInput] ', el.attr('id'), el.val());

    if (el.attr('id') === 'ProfileType') {
      this.disableProfileFieldsByType(<string> el.val());
    }

    this.profileData[el.attr('id')] = el.val();
    this.profileSave();
  }

  handleProviderInput(e:Event) {
    let el = $(e.currentTarget);
    let match = el.attr('id').match(/^Provider(Enabled|Display)-(.*)$/);

    // this.debug('[OptionsPage.handleProviderInput] ', el.attr('id'), el.prop('checked'), match);

    if (match && this.providers[match[2]]) {
      this.providers[match[2]][match[1]] = el.prop('checked');
      this.setOpt({ Providers: this.providers });
    }
  }

  /* PROFILES */

  profileNameChanged(oldName:string, newName:string):Promise<void> {
    if (newName) {
      let profile = this.profiles[oldName];
      delete this.profiles[oldName];
      this.profiles[newName] = profile;

      if (this.profileCurrent.val() === oldName) {
        this.profileSelectUpdate();
        this.profileCurrent.val(newName);
      }

      return this.profileSave()
        .then(() => {
          this.sendMessage('profileNameChanged', { old: oldName, new: newName });
        });
    }
  }

  profileSave() {
    return this.setOpt({ Profiles: this.profiles })
      .then(() => {
        this.sendMessage('profilesSaved', this.profiles);
      });
  }

  profileSelectUpdate() {
    this.profileCurrent.empty();
    for (let k in this.profiles) {
      this.profileCurrent.append(`<option value="${k}">${k}</option>`);
    }
  }

  profileSelect(name:string) {
    if (this.profiles[name]) {
      this.debug('[OptionsPage.profileSelect] ', name);
      this.profileCurrent.val(name);
      this.profileData = this.profiles[name];

      for (let k in this.profiles[name]) {
        let el = $(`#${k}`);
        el.val(<string> this.profiles[name][k]);
        el.prop('disabled', false);
      }

      this.disableProfileFieldsByType(this.profiles[name].ProfileType);
    }
  }

  disableProfileFieldsByType(type:string) {
    $('#ProfileApiKey, #ProfileUsername, #ProfilePassword').prop('disabled', true);

    if (type === 'SABnzbd') {
      $('#ProfileApiKey').prop('disabled', false);
    } else if (type === 'NZBGet') {
      $('#ProfileUsername, #ProfilePassword').prop('disabled', false);
    }
  }

  profileSelectFirst() {
    if (Object.keys(this.profiles).length) {
      this.profileSelect(Object.keys(this.profiles)[0]);
    }
  }

  profileCreate() {
    let name:string = this.profileCreateName();
    let profile:Object = {};
    this.profileInputs.toArray().forEach((el:HTMLElement) => {
      profile[el.id] = '';
    });
    profile['ProfileName'] = name;

    this.profiles[name] = <NZBUnityProfileOptions> profile;

    return this.profileSave()
      .then(() => {
        this.profileSelectUpdate();
        this.profileSelect(name);
      });
  }

  profileDuplicate() {
    let name:string = this.profileCreateName();
    let profile:Object = {};
    this.profileInputs.toArray().forEach((el:HTMLElement) => {
      profile[el.id] = $(el).val();
    });
    profile['ProfileName'] = name;

    this.profiles[name] = <NZBUnityProfileOptions> profile;

    return this.profileSave()
      .then(() => {
        this.profileSelectUpdate();
        this.profileSelect(name);
      });
  }

  profileDelete() {
    if (Object.keys(this.profiles).length) {
      let name:string = <string> this.profileCurrent.val();
      delete this.profiles[name];

      return this.profileSave()
        .then(() => {
          this.profileSelectUpdate();

          if (Object.keys(this.profiles).length) {
            this.profileSelectFirst();
          } else {
            this.profileInputs.toArray().forEach((el:HTMLElement) => {
              let e = $(el);
              e.val('');
              e.prop('disabled', true);
            });
          }
        });
    }
  }

  profileCreateName():string {
    let name:string = `Profile ${Object.keys(this.profiles).length + 1}`;
    let add:number = 1;

    while (Object.keys(this.profiles).includes(name)) {
      name.replace(/\s+\(\d+\)$/, '');
      name += ` (${add++})`;
    }

    return name;
  }

  profileTest() {
    let name:string = this.profileData.ProfileName;
    this.debug('[OptionsPage.profileTest] ', name);
    this.sendMessage('profileTest', name);
  }

  getProfileTestButton(color:string = 'info'):JQuery<HTMLElement> {
    return $('#profileTest')
      .removeClass('btn-info btn-secondary btn-success btn-danger')
      .addClass(`btn-${color}`);
  }

  profileTestClear():JQuery<HTMLElement> {
    $('#profileTest-result').empty();

    return this.getProfileTestButton('info')
      .prop('disabled', false)
      .find('.icon').hide().empty();
  }

  profileTestStart():JQuery<HTMLElement> {
    return this.getProfileTestButton('secondary')
      .prop('disabled', true)
      .find('.icon')
        .hide().empty()
        .append('&nbsp;<i class="fa fa-lg fa-circle-o-notch fa-spin fa-fw"></i>')
        .show();
  }

  profileTestSuccess():JQuery<HTMLElement> {
    return this.getProfileTestButton('success')
      .prop('disabled', false)
      .find('.icon')
        .hide().empty()
        .append('&nbsp;<i class="fa fa-lg fa-check-circle"></i>')
        .show();
  }

  profileTestFailure(error:string = null):JQuery<HTMLElement> {
    if (error) {
      $('#profileTest-result').empty()
        .append(`<span class="text-danger">${error}</span>`);
    }

    return this.getProfileTestButton('danger')
      .prop('disabled', false)
      .find('.icon')
        .hide().empty()
        .append('&nbsp;<i class="fa fa-lg fa-times-circle"></i>')
        .show();
  }

  /* PROVIDERS */

  getProviderElement(name:string, provider:NZBUnityProviderOptions, display:boolean = false) {
    let matches:string[] = provider.Matches.map((m) => {
      return m.replace('*://', '').replace('*.', '').replace('/*', '');
    });

    return $(
      `<div class="row">
        <div class="form-check col-5 col-sm-4 col-md-3 col-lg-2">
          <label class="form-check-label">
            <input id="Provider${display ? 'Display' : 'Enabled'}-${name}" class="form-check-input" type="checkbox" value="">
            <strong>${name}</strong>
          </label>
        </div>

        <div class="col-7 col-sm-8 col-md-9">
          ${display
            ? 'Use display name instead of NZB filename'
            : matches.join(', ')
          }
        </div>
      </div>`
    );
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

  setOptByMessage(options:Object) {
    chrome.runtime.sendMessage({ 'options.setOptions': options });
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

    console.debug('[OptionsPage.debugMessage]', msg);
  }
}

let page = new OptionsPage();
