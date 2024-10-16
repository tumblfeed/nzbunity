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
  public profileTestWarningBlock:JQuery<HTMLElement>;

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
    this.profileTestWarningBlock = $('#profileTestRequired');

    // Show version
    $('#Version').text(`v${chrome.runtime.getManifest().version}`);

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
        for (const k in opts) {
          let el = $(`#${k}`);
          if (el.length) {
            this.elements.push(el);
            if (el.attr('type') === 'checkbox') {
              el.prop('checked', opts[k] as boolean);
            } else {
              el.val(opts[k] as string);
            }
          }
        }

        // Set up form -> storage binding
        this.elements.forEach((el) => {
          if (el.attr('type') === 'checkbox') {
            el.on('change', () => {
              Util.storage.set({ [el.attr('id')]: el.prop('checked') });
            });
          } else {
            el.on('input', () => {
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
        for (const k in this.providers) {
          const el = this.getProviderElement(k, this.providers[k]);
          el.find('input').prop('checked', this.providers[k].Enabled);
          el.appendTo('#provider-enabled-container');
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

        // Show test warning if needed
        if (this.profileData.ProfileHost && !this.profileData.ProfileHostAsEntered) {
          this.profileTestWarningBlock.show();
        }
      });

    // Handle messages from the UI
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    // Init tooltips
    $('[data-toggle="tooltip"]').tooltip({
      animation: true,
      container: 'body',
      html: true,
      placement: 'bottom',
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
    for (const k in message) {
      const val = message[k];

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

  handleStorageChanged(changes:Record<string, chrome.storage.StorageChange>, area:string) {
    // this.debug('[OptionsPage.handleStorageChanged] ',
    //     Object.keys(changes)
    //         .map((k) => { return `${k} -> ${changes[k].newValue}`; })
    //         .join(', ')
    // );

    if (changes['Profiles']) {
      const profiles:Record<string, Partial<NZBUnityProfileOptions>> = changes['Profiles'].newValue;
      const oldProfiles:Record<string, Partial<NZBUnityProfileOptions>> = changes['Profiles'].oldValue;

      // If ProfileName has changed, we need to update the select field value(s).
      for (const [k, profile] of Object.entries(profiles)) {
        if (profile.ProfileName !== k) {
          this.profileNameChanged(k, profile.ProfileName);
        }
      }

      // Currently showing profiles
      const newCurrent = profiles[this.profileData.ProfileName];
      const oldCurrent = oldProfiles[this.profileData.ProfileName];

      // If ProfileHost is set and ProfileHostAsEntered is not set, we need to warn the user that they need to test the profile.
      if (newCurrent?.ProfileHost && !newCurrent.ProfileHostAsEntered) {
        this.profileTestWarningBlock.show();
      } else {
        this.profileTestWarningBlock.hide();
      }

      // if the current profile suddenly changed by only the host and as-entered fields,
      // then it was the url finder that updated it and we shouldn't clear the test result.
      if (newCurrent && oldCurrent) {
        const delta = Util.objDiffKeys(newCurrent, oldCurrent);
        if (delta.length === 2 && delta.includes('ProfileHost') && delta.includes('ProfileHostAsEntered')) {
          return;
        }
      }

      // Any other pro
      this.profileTestClear();
    }
  }

  handleProfileSelect(e:Event) {
    const el = $(e.currentTarget);
    this.profileSelect(<string> el.val());
  }

  handleProfileButton(e:Event) {
    const el = $(e.currentTarget);
    e.preventDefault();

    // this.debug('[OptionsPage.handleProfileButton] ', el.attr('id'));

    if (typeof this[el.attr('id')] === 'function') {
      this[el.attr('id')]();
    }
  }

  handleProfileInput(e:Event) {
    const el = $(e.currentTarget);

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
    const el = $(e.currentTarget);
    const match = el.attr('id').match(/^Provider(Enabled|Display)-(.*)$/);

    // this.debug('[OptionsPage.handleProviderInput] ', el.attr('id'), el.prop('checked'), match);

    if (match && this.providers[match[2]]) {
      this.providers[match[2]][match[1]] = el.prop('checked');
      Util.storage.set({ Providers: this.providers });
    }
  }

  /* PROFILES */

  profileSave() {
    return Util.storage.set({ Profiles: this.profiles })
      .then(() => this.sendMessage('profilesSaved', this.profiles));
  }

  profileUpdate(props:Partial<NZBUnityProfileOptions>) {
    for (const [k, v] of Object.entries(props)) {
      const el = $(`#${k}`);
      if (el.attr('type') === 'checkbox') {
        el.prop('checked', v as boolean);
      } else {
        el.val(v as string);
      }
      this.profileData[k] = v;
    }
    this.profileSave();
  }

  profileNameChanged(oldName:string, newName:string):Promise<void> {
    if (newName) {
      const profile = this.profiles[oldName];
      delete this.profiles[oldName];
      this.profiles[newName] = profile;

      if (this.profileCurrent.val() === oldName) {
        this.profileSelectUpdate();
        this.profileCurrent.val(newName);
      }

      return this.profileSave()
        .then(() => this.sendMessage('profileNameChanged', { old: oldName, new: newName }));
    }
  }

  profileSelectUpdate() {
    this.profileCurrent.empty();
    for (const k in this.profiles) {
      this.profileCurrent.append(`<option value="${k}">${k}</option>`);
    }
  }

  profileSelect(name:string) {
    if (this.profiles[name]) {
      this.debug('[OptionsPage.profileSelect] ', name);
      this.profileCurrent.val(name);
      this.profileData = this.profiles[name];

      for (const k in this.profiles[name]) {
        const el = $(`#${k}`);

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
    const name:string = this.profileCreateName();
    const profile:Object = {};
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
    const name:string = this.profileCreateName();
    const profile:Object = {};
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
      const name:string = this.profileCurrent.val() as string;
      delete this.profiles[name];

      return this.profileSave()
        .then(() => {
          this.profileSelectUpdate();

          if (Object.keys(this.profiles).length) {
            this.profileSelectFirst();
          } else {
            this.profileInputs.toArray().forEach((el:HTMLElement) => {
              const e = $(el);
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

  async profileTest() {
    const name:string = this.profileData.ProfileName;
    this.debug('[OptionsPage.profileTest] ', name);
    this.profileTestClear();

    if (this.profileData.ProfileHostAsEntered) {
      // If the host is set to use the entered value, we'll just send it off to main to test
      this.sendMessage('profileTest', name);
    } else {
      // Otherwise, we'll check the entered value and try to find the aboslute API URL
      // and then set the host and lock it and manage the events ourselves.
      this.debug('[OptionsPage.profileTest] Finding API URL for', name, this.profileData.ProfileType, this.profileData.ProfileHost);
      this.profileTestStart();

      let url:string;
      switch (this.profileData.ProfileType) {
        case 'SABnzbd':
          url = await SABnzbdHost.findApiUrl(this.profileData);
          break;

        case 'NZBGet':
          url = await NZBGetHost.findApiUrl(this.profileData);
          break;

        default:
          this.profileTestFailure('Invalid profile type');
          break;
      }

      if (url) {
        this.debug('[OptionsPage.profileTest] Found API URL for', name, url);
        this.profileUpdate({ ProfileHost: url, ProfileHostAsEntered: true });
        this.profileTestSuccess(`Found running ${this.profileData.ProfileType} at "${url}"!<br>Settings updated.`);
      } else {
        this.debug('[OptionsPage.profileTest] Could not find API URL for', name);
        this.profileTestFailure('Could not find host URL');
      }
    }
  }

  profileTestEnd(res:any) {
    if (res) {
      if (res.success) {
        this.profileTestSuccess();
      } else {
        let error:string;

        if (typeof res.error === 'string') {
          error = res.error;
        } if (res.error && res.error['statusText']) {
          error = res.error['statusText'];
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

  profileTestSuccess(message:string = null):JQuery<HTMLElement> {
    if (message) {
      $('#profileTest-result').empty()
        .append(`<span class="text-success">${message}</span>`);
    }

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
    const matches:string[] = provider.Matches
      .map(m => m.replace('*://', '').replace('*.', '').replace('/*', ''));

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
    for (const [k, v] of Object.entries(message)) {
      if (k === 'main.debug') continue;
      console.debug('[OptionsPage.debugMessage]', k, v);
    }
  }
}

let page = new OptionsPage();
