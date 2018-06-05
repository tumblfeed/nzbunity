class Popup {
  public _debug:boolean = false;
  public profiles:NZBUnityProfileDictionary;
  public profileCurrent:JQuery<HTMLElement>;
  public btnRefresh:JQuery<HTMLElement>;
  public btnServer:JQuery<HTMLElement>;
  public btnOptions:JQuery<HTMLElement>;

  public errorVal:JQuery<HTMLElement>;
  public statusVal:JQuery<HTMLElement>;
  public speedVal:JQuery<HTMLElement>;
  public maxSpeedVal:JQuery<HTMLElement>;
  public sizeVal:JQuery<HTMLElement>;
  public timeVal:JQuery<HTMLElement>;
  public queue:JQuery<HTMLElement>;

  public queuePause:JQuery<HTMLElement>;
  public overrideCategory:JQuery<HTMLElement>;
  public maxSpeed:JQuery<HTMLElement>;

  public messages = {
    queueEmpty: '<div id="queueEmpty" class="empty">Queue empty, add some NZBs!</div>',
    noProfiles: '<div id="noProfiles" class="empty">No server profile, click the gear to get started! <i class="fa fa-arrow-down"></i></div>',
  };

  constructor() {
    this.profileCurrent = $('#ProfileCurrent');
    this.btnRefresh = $('#btn-refresh');
    this.btnServer = $('#btn-server');
    this.btnOptions = $('#btn-options');

    this.errorVal = $('#errors');
    this.statusVal = $('#statusVal');
    this.speedVal = $('#speedVal');
    this.maxSpeedVal = $('#maxSpeedVal');
    this.sizeVal = $('#sizeleftVal');
    this.timeVal = $('#timeleftVal');
    this.queue = $('#queue');

    this.queuePause = $('#QueuePause');
    this.overrideCategory = $('#OverrideCategory');
    this.maxSpeed = $('#MaxSpeed');

    // Init options
    Util.storage.get(null)
      .then((opts) => {
        this._debug = opts.Debug;
        this.debug('[Popup.constructor] Got data!', opts);

        this.profiles = opts.Profiles;

        if (Object.keys(this.profiles).length === 0) {
          this.queue.empty().append(this.messages.noProfiles);
        }

        // Set up profile listeners
        this.profileCurrent.on('change', this.handleProfileSelect.bind(this));
        this.profileSelectUpdate();
        this.setActiveProfile();

        this.setActiveTheme(opts.UITheme);

        // Init storage on change watcher
        chrome.storage.onChanged.addListener(this.handleStorageChanged.bind(this));

        // Controls
        this.overrideCategory.on('change', (e) => {
          Util.storage.set({ OverrideCategory: this.overrideCategory.val() });
        });

        this.maxSpeed.on('change', (e) => {
          let val:string = <string> this.maxSpeed.val();
          let n:number = parseFloat(val);

          if (n && n <= 0) {
            n = 0;
          }

          this.maxSpeed.val(n ? n : '');
          this.sendMessage('setMaxSpeed', n ? n * Util.Megabyte : null);
        });

        // Buttons
        this.queuePause.on('click', (e) => {
          e.preventDefault();
          if (this.queuePause.find('.icon').hasClass('fa-pause-circle')) {
            this.sendMessage('pauseQueue');
          } else {
            this.sendMessage('resumeQueue');
          }
        });

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

        this.sendMessage('refresh');
      });

    // Handle messages from the UI
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

    this.sendMessage('onInit', 'Popup initialized.');
  }

  update(queue:NZBQueueResult, error:string = null) {
    // this.debug('Popup.update', queue, error);
    this.errorVal.empty();

    if (Object.keys(this.profiles).length === 0) {
      this.queue.empty().append(this.messages.noProfiles);

    } else if (queue) {
      console.log(queue);

      this.maxSpeed.val(Number(queue.maxSpeedBytes / Util.Megabyte).toFixed(1));

      // Summary
      this.statusVal.text(queue.status || 'Idle');
      this.speedVal.text(`${queue.speed || '0 B/s'}`);
      this.maxSpeedVal.text(`(${queue.maxSpeed || '0'})`);
      this.sizeVal.text(`${queue.sizeRemaining || '0 B'} Left`);
      this.timeVal.text(`(${queue.timeRemaining || '∞'})`);

      if (queue.status.toLowerCase() === 'paused') {
        this.queuePause.find('.icon-glyph').removeClass('fa-pause').addClass('fa-play');
      } else {
        this.queuePause.find('.icon-glyph').removeClass('fa-play').addClass('fa-pause');
      }

      // Queue
      this.queue.empty();

      if (queue.queue.length) {
        queue.queue.forEach((i) => {
          // console.log(i);
          this.queue.append(`
            <div class="nzb">
              <span class="name" title="${i.name}">${Util.trunc(i.name, 30)}</span>
              <span class="category">${i.category}</span>
              <span class="size">${i.size}</span>
              <span class="bar" style="width:${i.percentage}%;"></span>
            </div>
          `);
        });
      } else {
        this.queue.append(this.messages.queueEmpty);
      }

      // Viddles
      let currentOverride:string = <string> this.overrideCategory.val();

      this.overrideCategory.empty().append(`<option val=""></option>`);
      queue.categories.forEach((k:string) => {
        this.overrideCategory.append(`<option value="${k}">${k}</option>`);
      });

      this.overrideCategory.val(queue.categories.includes(currentOverride) ? currentOverride : '');
    }

    if (error) {
      this.errorVal.text(error);
    }
  }

  /* MESSAGING */

  sendMessage(name:string, data:any = null):Promise<any> {
    return Util.sendMessage({ [`popup.${name}`]: data });
  }

  handleMessage(message:MessageEvent, sender:any, sendResponse:(response:any) => void) {
    if (this._debug) this.debugMessage(message);

    // Handle message
    for (let k in message) {
      let val:any = message[k];

      switch (k) {
        case 'main.refresh':
          this.update(<NZBQueueResult> val);
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
      }
    }

    sendResponse(undefined);
    return true;
  }

  /* HANDLERS */

  handleStorageChanged(changes:{ string: chrome.storage.StorageChange }, area:string) {
    // If ProfileName has changed, we need to update the select field.
    if (changes['Profiles']) {
      this.profiles = changes['Profiles'].newValue;
      let profilesCount:number = Object.keys(this.profiles).length;

      let oldProfiles:Object = changes['Profiles'].oldValue;
      let oldProfilesCount:number = Object.keys(oldProfiles).length;

      if (profilesCount !== oldProfilesCount) {
        // Profile added or removed
        this.profileSelectUpdate();

        if (!profilesCount) {
          // All profiles removed
          this.profileCurrent.val('');
        }
      }

      for (let k in this.profiles) {
        if (this.profiles[k].ProfileName !== k) {
          this.profileNameChanged(k, this.profiles[k].ProfileName);
        }
      }
    }
    // Set theme if changed
    if (changes['UITheme']) {
      this.setActiveTheme(changes['UITheme'].newValue);
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
        // this.debug('[Popup.profileSelect]', name);
        this.sendMessage('profileSelect', name)
          .then(this.handleActiveProfileSet.bind(this));
      }
    } else {
      Util.storage.get('ActiveProfile')
        .then((opts) => {
          // this.debug('[Popup.profileSelect]', opts.ActiveProfile);
          this.sendMessage('profileSelect', opts.ActiveProfile)
            .then(this.handleActiveProfileSet.bind(this));
        });
    }
  }

  handleActiveProfileSet(r:NZBResult) {
    this.debug('activeProfileSet', r);
    Util.storage.get('ActiveProfile')
      .then((opts) => {
        this.profileCurrent.val(opts.ActiveProfile);
        this.sendMessage('refresh');
      });
  }

  setActiveTheme(theme:string = '') {
    this.debug('setActiveTheme', theme);
    if (theme) {
      $('body').removeClass().addClass(`theme-${theme}`);
    }
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
      console.debug('[Popup.debugMessage]', k, message[k]);
    }
  }
}

let popup = new Popup();
