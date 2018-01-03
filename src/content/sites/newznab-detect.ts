if (!window['NZBUnityNewznabDetect']) { // Only run once
  class NZBUnityNewznabDetect {
    static detect() {
      if (NZBUnityNewznabDetect.isNewznab()) {
        console.log('[NewznabDetect] Newznab page detected');

        // Newznab usually has jQuery already, if so use it to notify the user
        let iconUrl:string = chrome.extension.getURL('content/images/nzb-64-green.png');
        let div:HTMLElement = document.createElement('div');
        div.id = 'NZBUnityAlert';
        div.innerHTML = `
          <h3>NZB Unity - Newznab site detected!</h3>
          <p>Would you like to enable NZB Unity integration on this site?</p>
          <a id="NZBUnityAlertEnable">Enable</a> | <a id="NZBUnityAlertIgnore">Ignore</a>
          <a id="NZBUnityAlertClose">×</a>
        `;

        let enableBtn:HTMLElement = <HTMLElement> div.querySelector('#NZBUnityAlertEnable');
        let ignoreBtn:HTMLElement = <HTMLElement> div.querySelector('#NZBUnityAlertIgnore');
        let closeBtn:HTMLElement = <HTMLElement> div.querySelector('#NZBUnityAlertClose');

        // Styles
        div.style.cssText = `
          background: #f2eacb url(${iconUrl}) no-repeat scroll 25px center;
          background-size: 48px;
          border: 1px solid #877234;
          border-radius: 4px;
          bottom: 15px;
          color: #333;
          font-size: 16px;
          left: calc(50% - 300px);
          margin-bottom: 10px;
          padding: 15px 15px 20px 105px;
          position: fixed;
          width: 600px;
        `;

        div.querySelector('h3').style.cssText = `
          color: #665627;
          margin: 0;
          padding: 0;
        `;

        div.querySelector('p').style.cssText = `
          line-height: 24px;
          margin: 0;
        `;

        enableBtn.style.cssText = `
          color: #17a2b8;
          cursor: pointer;
          display: inline-block;
          font-size: 18px;
          margin: 3px 10px 0 0;
        `;

        ignoreBtn.style.cssText = `
          color: #17a2b8;
          cursor: pointer;
          display: inline-block;
          font-size: 18px;
          margin: 3px 0 0 10px;
        `;

        closeBtn.style.cssText = `
          color: #333;
          cursor: pointer;
          font-size: 32px;
          font-weight: bold;
          position: absolute;
          right: 13px;
          text-decoration: none;
          top: 10px;
        `;

        // Button events
        enableBtn.addEventListener('click', () => {
          let hostname = (window.location.hostname.match(/([^.]+)\.\w{2,3}(?:\.\w{2})?$/) || [])[0];
          chrome.runtime.sendMessage({ 'newznab.enable': hostname }, (response:any) => {
            document.body.removeChild(div);
            window.location.reload();
          })
        });

        ignoreBtn.addEventListener('click', () => {
          document.body.removeChild(div);
        });

        closeBtn.addEventListener('click', () => {
          document.body.removeChild(div);
        });

        document.body.insertBefore(div, document.body.firstChild);
      }
    }

    static isNewznab():boolean {
      return <boolean> (
        (
          document.querySelectorAll('[name=RSSTOKEN]').length > 0
          && document.querySelectorAll('input.nzb_multi_operations_cart').length > 0
        )
        || document.querySelectorAll('#browsetable tr td.item label').length > 0
      );
    }
  }

  chrome.runtime.onMessage.addListener(() => {});
  NZBUnityNewznabDetect.detect();
}

undefined;