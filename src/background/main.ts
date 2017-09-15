const DefaultOptions = {
    Initialized: false,
    Debug: false,
    Profiles: <any>[],
    ProviderEnabled: true,
    ProviderDisplay: true,
    ProviderNewznab: '',
    RefreshRate: 15,
    NotificationTimeout: 15,
    EnableGraph: true,
    EnableContextMenu: true,
    EnableNotifications: true,
    EnableNewznab: true,
    DebugNotifications: true,
    CategoriesUseGroupNames: true,
    CategoriesUseMenu: true,
    CategoriesUseHeader: true,
    CategoriesOverride: '',
    CategoriesDefault: ''
};

class NZBUnity {
    public _debug:boolean;
    public storage:chrome.storage.StorageArea;


    constructor() {
        this.storage = chrome.storage.local

        // Initialize default options
        this.getOpt('Debug')
            .then((result) => {
                this._debug = result.Debug;
                return this.initOptions()
            })
            .then(() => {
                this.debug('[NZBUnity.constructor] Options Ok!');
            })
            .then(() => {
                // Handle messages from the UI
                chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
                this.debug('[NZBUnity.constructor] Message handler Ok!');
            })
            .then(() => {
                this.debug('[NZBUnity.constructor] Init Done!');
            });
    }

    /* MESSAGING */

    handleMessage(message:MessageEvent) {
        if (this._debug) this.debugMessage(message);

        // Handle message
        for (let k in message) {
            this.debug(k, message[k]);
            switch (k) {
                case 'options.setOption':
                    this.setOpt(message[k]);
                    break;
            }
        }
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
        this.debug('[NZBUnity.setOpt]', items);
        return new Promise((resolve, reject) => {
            if (!this.isValidOpt(Object.keys(items))) {
                reject('items contain invalid option names');
            }

            this.storage.set(items, () => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve();
                }
            });
        });
    }

    isValidOpt(opt:string | string[]):boolean {
        opt = Array.isArray(opt) ? opt : [opt];
        return opt.every((k:string) => {
            return Object.keys(DefaultOptions).indexOf(k) >= 0;
        });
    }

    initOptions():Promise<any> {
        return this.getOpt('Initialized')
            .then((items) => {
                if (!items.Initialized) {
                    // Storage is fresh. Add in defaults
                    return this.setOptionDefaults()
                        .then(() => {
                            return this.setOpt({ Initialized: true });
                        });
                }
            });
    }

    setOptionDefaults():Promise<any> {
        return this.setOpt(DefaultOptions)
            .catch((err) => {
                this.error('[NZBUnity.setOptionDefaults]', err);
            });
    }

    /* DEBUGGING */

    debug(...args:any[]) {
        if (this._debug) console.debug.apply(this, args);
    }

    error(...args:any[]) {
        if (this._debug) console.error.apply(this, args);
    }

    debugMessage(message:MessageEvent):boolean {
        let msg = '';
        for (let k in message) {
            msg += `${k}: ${message[k]}`;
        }

        console.debug('[NZBUnity.debugMessage]', msg);

        return true;
    }

    debugNotify(message:string):void {
        chrome.notifications.create('nzbunity.debug', {
            'type': 'basic',
            'iconUrl': chrome.extension.getURL('content/images/icon-32.png'),
            'title': 'NZB Unity Debug Message',
            'message': message
        });
    }
}

let nzbUnity:NZBUnity = new NZBUnity();
