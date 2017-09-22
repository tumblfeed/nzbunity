class OptionsPage {

  public _debug:boolean = false;
  public storage:chrome.storage.StorageArea;
  public providers:Object;
  public form:JQuery<HTMLElement>;
  public elements:JQuery<HTMLElement>;

  public profiles:Object;
  public profileCurrent:JQuery<HTMLElement>;
  public profileButtons:JQuery<HTMLElement>;
  public profileInputs:JQuery<HTMLElement>;

  public providerInputs:JQuery<HTMLElement>;

  constructor() {
    this.providers = {};
    this.form = $('#FormSettings');
    this.elements = $();
    this.profileCurrent = $('#ProfileCurrent');
    this.profileButtons = $('#profile-controls button, #ProfileTest');
    this.profileInputs = $('#profile-container input');

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
              el.val(opts[k]);
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
        Object.keys(this.providers).forEach((k) => {
          let el = this.getProviderElement(k);
          el.find('input').prop('checked', this.providers[k].enabled);
          el.appendTo('#provider-enabled-container');

          if (this.providers[k].displayAvailable) {
            el = this.getProviderElement(k, true);
            el.find('input').prop('checked', this.providers[k].display);
            el.appendTo('#provider-display-container');
          }
        });

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
      switch (k) {
        case 'main.resetOptions':
          if(message[k]) {
            window.location.reload();
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
      Object.keys(profiles).forEach((k) => {
        if (profiles[k].ProfileName !== k) {
          this.profileNameChanged(k, profiles[k].ProfileName);
        }
      });
    }
  }

  handleProfileSelect(e:Event) {
    let el = $(e.currentTarget);
    this.profileSelect(<string> el.val());
  }

  handleProfileButton(e:Event) {
    let el = $(e.currentTarget);

    this.debug('[OptionsPage.handleProfileButton] ', el.attr('id'));

    switch (el.attr('id')) {
      case 'ProfileCreate':
        this.profileCreate();
        break;

      case 'ProfileDuplicate':
        this.profileDuplicate();
        break;

      case 'ProfileDelete':
        this.profileDelete();
        break;

      case 'ProfileTest':
        this.profileTest();
        break;
    }

    e.preventDefault();
  }

  handleProfileInput(e:Event) {
    let el = $(e.currentTarget);

    // this.debug('[OptionsPage.handleProfileInput] ', el.attr('id'), el.val());

    this.profileCurrent.data('profile')[el.attr('id')] = el.val();
    this.profileSave();
  }

  handleProviderInput(e:Event) {
    let el = $(e.currentTarget);

    this.debug('[OptionsPage.handleProviderInput] ', el.attr('id'), el.prop('checked'));

    let match = el.attr('id').match(/^Provider(Enabled|Display)-(.*)$/);
    if (match && this.providers[match[2]]) {
      this.providers[match[2]][match[1].toLowerCase()] = el.prop('checked');
      this.setOpt({ Providers: this.providers });
    }
  }

  /* PROFILES */

  profileNameChanged(oldName:string, newName:string) {
    if (newName) {
      let profile = this.profiles[oldName];
      delete this.profiles[oldName];
      this.profiles[newName] = profile;

      if (this.profileCurrent.val() === oldName) {
        this.profileSelectUpdate();
        this.profileCurrent.val(newName);
      }
    }
  }

  profileSave() {
    return this.setOpt({ Profiles: this.profiles });
  }

  profileSelectUpdate() {
    this.profileCurrent.find('option').remove();
    Object.keys(this.profiles).forEach((k) => {
      this.profileCurrent.append(`<option value="${k}">${k}</option>`);
    });
  }

  profileSelect(name:string) {
    if (this.profiles[name]) {
      this.debug('[OptionsPage.profileSelect] ', name);
      this.profileCurrent.val(name);
      this.profileCurrent.data('profile', this.profiles[name]);

      Object.keys(this.profiles[name]).forEach((k) => {
        let el = $(`#${k}`);
        el.val(this.profiles[name][k]);
        el.prop('disabled', false);
      });
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

    this.profiles[name] = profile;

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

    this.profiles[name] = profile;

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
    let name:string = this.profileCurrent.data('profile').ProfileName;
    this.debug('[OptionsPage.profileTest] ', name);
    this.sendMessage('profileTest', name);
  }

  /* PROVIDERS */

  getProviderElement(name:string, display:boolean = false) {
    return $(
      `<div class="form-check">
        <label class="form-check-label">
          <input id="Provider${display ? 'Display' : 'Enabled'}-${name}" class="form-check-input" type="checkbox" value="">
          ${name} ${display ? '&ndash; Use display name instead of NZB filename' : ''}
        </label>
      </div>`
    );
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
