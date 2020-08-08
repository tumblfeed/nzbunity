if (!window['NZBUnityNewznabDetect']) { // Only run once
  class NZBUnityNewznabDetect {
    static detect() {
      if (NZBUnityNewznabDetect.isNewznab()) {
        console.log('[NewznabDetect] Newznab page detected');

        // Newznab usually has jQuery already, if so use it to notify the user
        const iconUrl:string = chrome.extension.getURL('content/images/nzb-64-green.png');
        const div:HTMLElement = document.createElement('div');
        div.id = 'NZBUnityAlert';
        div.innerHTML = `
          <h3>NZB Unity - Newznab site detected!</h3>
          <p>Would you like to enable NZB Unity integration on this site?</p>
          <a id="NZBUnityAlertEnable">Enable</a> | <a id="NZBUnityAlertIgnore">Ignore</a>
          <a id="NZBUnityAlertClose">×</a>
        `;

        const enableBtn:HTMLElement = div.querySelector('#NZBUnityAlertEnable') as HTMLElement;
        const ignoreBtn:HTMLElement = div.querySelector('#NZBUnityAlertIgnore') as HTMLElement;
        const closeBtn:HTMLElement = div.querySelector('#NZBUnityAlertClose') as HTMLElement;

        // Styles
        div.style.cssText = `
          background: rgba(249, 249, 217, .95) url(${iconUrl}) no-repeat scroll 20px center;
          background-size: 48px;
          border: 1px solid #877234;
          border-radius: 4px;
          bottom: 15px;
          color: #333;
          font-size: 15px;
          padding: 10px 35px 15px 90px;
          position: fixed;
          right: 15px;
          width: 335px;
        `;

        div.querySelector('h3').style.cssText = `
          color: #665627;
          font-size: 18px;
          line-height: 28px;
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
          font-size: 16px;
          margin: 3px 10px 0 0;
        `;

        ignoreBtn.style.cssText = `
          color: #17a2b8;
          cursor: pointer;
          display: inline-block;
          font-size: 16px;
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
          const hostname = (window.location.hostname.match(/([^.]+)\.\w{2,3}(?:\.\w{2})?$/) || [])[0];
          chrome.runtime.sendMessage({ 'newznab.enable': hostname }, () => {
            document.body.removeChild(div);
            window.location.reload();
          })
        });

        ignoreBtn.addEventListener('click', () => document.body.removeChild(div));

        closeBtn.addEventListener('click', () => document.body.removeChild(div));

        // Show the notification
        document.body.insertBefore(div, document.body.firstChild);

        // Remove notification after 15 seconds
        setTimeout(() => document.body.removeChild(div), 15000);
      }
    }

    static isNewznab():boolean {
      return (
        (
          document.querySelectorAll('[name="RSSTOKEN" i]').length > 0
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