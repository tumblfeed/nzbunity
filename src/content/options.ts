declare var $:any;
declare var weh:any;
declare var browser:any;


class OptionsPage {

    private store:any = browser.storage.local;
    private form:HTMLFormElement;

    constructor() {
        this.form = $('#FormSettings');


        console.log('lol');
    }

}

let page = new OptionsPage();
