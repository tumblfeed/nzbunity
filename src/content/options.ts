class OptionsPage {

    public _debug:boolean = false;
    public storage:chrome.storage.StorageArea;
    public providers:Object;
    public form:JQuery<HTMLElement>;
    private elements:JQuery<HTMLElement>;

    constructor() {
        this.providers = {};
        this.form = $('#FormSettings');
        this.elements = $();

        // Init data
        this.storage = chrome.storage.local

        this.getOpt(null)
            .then((opts) => {
                this._debug = opts.Debug;
                this.debug('[OptionsPage.constructor] Got data!', opts);

                this.providers = opts.Providers;

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
                        .join(', '));
            });

        // Handle messages from the UI
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

        chrome.runtime.sendMessage({ 'options.onInit': 'Options initialized.' });
    }

    /* MESSAGING */

    setOptions(options:Object) {
        chrome.runtime.sendMessage({ 'options.setOptions': options });
    }

    handleMessage(message:MessageEvent) {
        if (this._debug) this.debugMessage(message);
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

        console.debug('[NZBUnity.debugMessage]', msg);
    }
}

let page = new OptionsPage();
