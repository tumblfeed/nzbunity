declare var weh:any;
declare var browser:any;

let store = browser.storage.local;

/* if you don't need a panel that opens from a toolbar button:
   - delete the call below
   - remove entry browser_action in manifest.json
   - delete files src/content/popup.* files
*/
weh.ui.update('default', {
  type: 'popup',
  onMessage: function (message) {
    switch (message.type) {
      case 'open-options':
        weh.ui.close('default');
        weh.ui.open('options');
        break;
    }
  }
});

/* if you don't need options in your add-on:
   - delete the call below
   - remove entry options_page in manifest.json
   - delete files src/content/options.* files
*/
weh.ui.update('options', {
  type: 'tab',
  contentURL: 'content/options.html'
});
