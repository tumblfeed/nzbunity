class NZBUnityNzbking {
  constructor() {
    Util.storage.get('Providers')
      .then((opts) => {
        let provider = opts.Providers && opts.Providers.nzbking;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);
          this.initializeLinks();
        } else {
          console.info(`[NZB Unity] 1-click functionality disabled for this site`);
        }
      });
  }

  initializeLinks() {
    // Create direct download links
    $('form[name="r"] [type="submit"]').each((i, el) => {

      let button:JQuery<HTMLElement> = $(el);
      let form:JQuery<HTMLElement> = button.closest('form');
      let link = $(
        `<a class="NZBUnityLink" href="#" title="Download with NZB Unity">`
          + `<img src="${PageUtil.iconGreen}">`
        + `</a>`
      );
      let img = link.find('img');

      console.log(form, button, link);

      link
        .css({
          float: 'left',
          margin: '4px -4px 0 10px',
          height: '16px',
          width: '16px'
        })
        .on('click', (e) => {
          e.preventDefault();
          console.info(`[NZB Unity] Adding NZB(s)`);

          img.attr('src', PageUtil.iconGrey);

          let values:JQuery.NameValuePair[] = form.serializeArray();
          let csrfToken:string = values
            .find((i) => { return i.name === 'csrfmiddlewaretoken'; })
            .value;
          let nzbIds:string[] = values
            .filter((i) => { return i.name === 'nzb' })
            .map((i) => { return i.value });

          nzbIds.forEach((nzbId) => {
            let category = '*';
            let filename = nzbId;

            // This currently works but results in unstable filenames.
            // if (/\/(search|groups)\//.test(window.location.pathname)) {
            //   let s = $(`input[value="${nzbId}"]`).closest('tr').find('.s');
            //   if (s.length) {
            //     filename = s[0].innerText;
            //   }
            // }

            // if (/\/details/.test(window.location.pathname)) {
            //   let s = $('.xMenuT .s');
            //   if (s.length) {
            //     filename = s[0].innerText;
            //   }
            // }

            // NZBKing requires a POST request to retreive NZBs. Since SAB can't do that, get the data here and upload it.
            Util.request({
              method: 'POST',
              url: 'http://nzbking.com/nzb/',
              params: {
                csrfmiddlewaretoken: csrfToken,
                nzb: nzbId
              }
            }).then((nzbContent) => {
              Util.sendMessage({
                'content.addFile': {
                  filename: filename,
                  content: nzbContent,
                  category: category
                }
              }).then((r:boolean) => {
                  setTimeout(() => {
                    if (r === false) {
                      img.attr('src', PageUtil.iconRed);
                      link.trigger('addUrl.failure');
                    } else {
                      img.attr('src', PageUtil.iconGreen);
                      link.trigger('addUrl.success');
                    }
                  }, 1000);
                });

            }).catch((e) => {
              img.attr('src', PageUtil.iconRed);
              console.error(`[NZB Unity] Error fetching NZB content (${nzbId}): ${e.status} ${e.statusText}`);
            });
          });

        })
        .on('addUrl.success', (e) => {
          // link.closest('tr').find('a[href*="details"]').first()
          //   .prepend('<img src="pics/downloaded.png" class="hastip" title="" style="width:13px;margin-right:.25em;" border="0">');
        })
        .insertBefore(button);
    });
  }
}

let nzbking = new NZBUnityNzbking();
