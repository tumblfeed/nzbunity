class OptionsPage {
  public _debug:boolean = false;
  public form:JQuery<HTMLElement>;
  public elements:JQuery<HTMLElement>[];

  public providers:NZBUnityProviderDictionary;
  public profiles:NZBUnityProfileDictionary;
  public profileData:NZBUnityProfileOptions;
  public profileCurrent:JQuery<HTMLElement>;
  public profileButtons:JQuery<HTMLElement>;
  public profileInputs:JQuery<HTMLElement>;

  public providerInputs:JQuery<HTMLElement>;

  public interceptDownloads:JQuery<HTMLElement>;
  public interceptExclude:JQuery<HTMLElement>;

  constructor() {
    this.providers = {};
    this.form = $('#FormSettings');
    this.elements = [];
    this.profileCurrent = $('#ProfileCurrent');
    this.profileButtons = $('#profile-controls button, #profileTest');
    this.profileInputs = $('#profile-container').find('input, select');
    this.interceptDownloads = $('#InterceptDownloads');
    this.interceptExclude = $('#InterceptExclude');

    // Init tab stuff
    chrome.tabs.getCurrent((tab:chrome.tabs.Tab) => {
      this.sendMessage('onTab', tab);
    });

    // Init options
    Util.storage.get(null)
      .then((opts) => {
        this._debug = opts.Debug;
        this.debug('[OptionsPage.constructor] Got data!', opts);

        this.providers = opts.Providers;
        this.profiles = opts.Profiles;

        // Init field contents
        for (let k in opts) {
          let el = $(`#${k}`);
          if (el.length) {
            this.elements.push(el);
            if (el.attr('type') === 'checkbox') {
              el.prop('checked', <boolean> opts[k]);
            } else {
              el.val(<string> opts[k]);
            }
          }
        }

        // Set up form -> storage binding
        this.elements.forEach((el) => {
          if (el.attr('type') === 'checkbox') {
            el.on('change', (e) => {
              Util.storage.set({ [el.attr('id')]: el.prop('checked') });
            });
          } else {
            el.on('input', (e) => {
              Util.storage.set({ [el.attr('id')]: el.val() });
            });
          }
        });

        this.debug('[OptionsPage.constructor] Bound form elements: ',
          this.elements.map(el => el.attr('id')).join(', ')
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

        // Enable / Disable exclude textbox on intercept change
        this.interceptDownloads.on('change', (e) => {
          this.interceptExclude.prop('disabled', !this.interceptDownloads.prop('checked'));
        });

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

    // Init tooltips
    $('[data-toggle="tooltip"]').tooltip({
      animation: true,
      container: 'body',
      html: true,
      placement: 'bottom'
    });

    this.sendMessage('onInit', 'Options initialized.');
  }

  /* MESSAGING */

  sendMessage(name:string, data:any = null):Promise<any> {
    return Util.sendMessage({ [`options.${name}`]: data });
  }

  handleMessage(message:MessageEvent, sender:any, sendResponse:(response:any) => void) {
    if (this._debug) this.debugMessage(message);

    // Handle message
    for (let k in message) {
      let val:any = message[k];

      switch (k) {
        case 'main.resetOptions':
          if (val) {
            this.debug('Options reset, reloading');
            window.location.reload();
          }
          break;

        case 'main.profileTestStart':
          this.profileTestStart();
          break;

        case 'main.profileTestEnd':
          this.profileTestEnd(val);
          break;

      }
    }

    sendResponse(undefined);
    return true;
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
      this.disableProfileFieldsByType(el.val() as string);
    }

    if (el.attr('type') === 'checkbox') {
      this.profileData[el.attr('id')] = el.prop('checked');
    } else {
      this.profileData[el.attr('id')] = el.val();
    }

    this.profileSave();
  }

  handleProviderInput(e:Event) {
    let el = $(e.currentTarget);
    let match = el.attr('id').match(/^Provider(Enabled|Display)-(.*)$/);

    // this.debug('[OptionsPage.handleProviderInput] ', el.attr('id'), el.prop('checked'), match);

    if (match && this.providers[match[2]]) {
      this.providers[match[2]][match[1]] = el.prop('checked');
      Util.storage.set({ Providers: this.providers });
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
          return this.sendMessage('profileNameChanged', { old: oldName, new: newName });
        });
    }
  }

  profileSave() {
    return Util.storage.set({ Profiles: this.profiles })
      .then(() => {
        return this.sendMessage('profilesSaved', this.profiles);
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

        if (el.attr('type') === 'checkbox') {
          el.prop('checked', this.profiles[name][k] as boolean);
        } else {
          el.val(this.profiles[name][k] as string);
        }

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

    this.profiles[name] = profile as NZBUnityProfileOptions;

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

    this.profiles[name] = profile as NZBUnityProfileOptions;

    return this.profileSave()
      .then(() => {
        this.profileSelectUpdate();
        this.profileSelect(name);
      });
  }

  profileDelete() {
    if (Object.keys(this.profiles).length) {
      let name:string = this.profileCurrent.val() as string;
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

  profileTestEnd(r:any) {
    if (r) {
      if (r.success) {
        this.profileTestSuccess();
      } else {
        let error:string;

        if (typeof r.error === 'string') {
          error = r.error;
        } if (r.error && r.error['statusText']) {
          error = r.error['statusText'];
        } else {
          error = 'Could not connect to host';
        }

        this.profileTestFailure(error);
      }
    } else {
      this.profileTestFailure('Unknown error');
    }
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
    this.profileTestClear();
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

  /* DEBUGGING */

  error(...args:any[]) {
    console.error.apply(this, args);
  }

  debug(...args:any[]) {
    if (this._debug) console.debug.apply(this, args);
  }

  debugMessage(message:MessageEvent) {
    for (let k in message) {
      console.debug('[OptionsPage.debugMessage]', k, message[k]);
    }

  }
}

let page = new OptionsPage();
