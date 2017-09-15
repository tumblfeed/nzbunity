class OptionsPage {

    public _debug: boolean;
    private _form: JQuery<HTMLElement>;

    constructor() {
        this._debug = true; // TODO: No debug
        this.form = $('#FormSettings');

        // Grab all the form elements and watch em



        // Handle messages from the UI
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));



        chrome.runtime.sendMessage({ 'options.onInit': 'Options initialized.' });
    }

    get form():JQuery<HTMLElement> { return this._form; }
    set form(form:JQuery<HTMLElement>) { this._form = form; }

    setOptions(options:Object) {
        chrome.runtime.sendMessage({ 'options.setOption': options });
    }

    handleMessage(message:MessageEvent):boolean {
        if (this._debug) this.debugMessage(message);

        return true;
    }

    debugMessage(message:MessageEvent) {
        let msg = '';
        for (let k in message) {
            msg += `[${k}] :: ${message[k]}\n`;
        }
        console.debug('[NZB Unity Debug]', message);
    }
}

let page = new OptionsPage();
