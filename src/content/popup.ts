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

  constructor() {
    this.profileCurrent = $('#ProfileCurrent');
    this.btnRefresh = $('#btn-refresh');
    this.btnServer = $('#btn-server');
    this.btnOptions = $('#btn-options');

    this.errorVal = $('#error');
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

        // Set up profile listeners
        this.profileCurrent.on('change', this.handleProfileSelect.bind(this));
        this.profileSelectUpdate();
        this.setActiveProfile();

        // Init storage on change watcher
        browser.storage.onChanged.addListener(this.handleStorageChanged.bind(this));

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
          browser.runtime.openOptionsPage();
        });

        this.sendMessage('refresh');
      });

    // Handle messages from the UI
    browser.runtime.onMessage.addListener(this.handleMessage.bind(this));

    this.sendMessage('onInit', 'Popup initialized.');
  }

  update(queue:NZBQueueResult, error:string = null) {
    // this.debug('Popup.update', queue, error);
    this.errorVal.empty();

    if (queue) {
      console.log(queue);

      this.maxSpeed.val(Number(queue.maxSpeedBytes / Util.Megabyte).toFixed(1));

      // Summary
      this.statusVal.text(queue.status);
      this.speedVal.text(queue.speed);
      this.maxSpeedVal.text(queue.maxSpeed);
      this.sizeVal.text(queue.sizeRemaining);
      this.timeVal.text(queue.timeRemaining);

      if (queue.status.toLowerCase() === 'paused') {
        this.queuePause.find('.icon').removeClass('fa-pause-circle').addClass('fa-play-circle');
      } else {
        this.queuePause.find('.icon').removeClass('fa-play-circle').addClass('fa-pause-circle');
      }

      // Queue
      this.queue.empty();
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
    return browser.runtime.sendMessage({ [`popup.${name}`]: data });
  }

  handleMessage(message:MessageEvent) {
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
  }

  /* HANDLERS */

  handleStorageChanged(changes:{ string: browser.storage.StorageChange }, area:string) {
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
        this.sendMessage('profileSelect', name)
          .then(this.handleActiveProfileSet.bind(this));
      }
    } else {
      Util.storage.get('ActiveProfile')
        .then((opts) => {
          this.debug('[Popup.profileSelect]', opts.ActiveProfile);
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
