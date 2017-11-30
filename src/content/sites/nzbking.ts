class NZBUnityNzbking {
  public form:JQuery<HTMLElement>;
  public csrfToken:string;
  public isList:boolean;
  public isDetail:boolean;

  constructor() {
    Util.storage.get('Providers')
      .then((opts) => {
        let provider = opts.Providers && opts.Providers.nzbking;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);
          this.form = $('form[name="r"]');
          this.csrfToken = <string> this.form.find('input[name="csrfmiddlewaretoken"]').val();
          this.isList = /^\/(group|search)/.test(window.location.pathname);
          this.isDetail = /^\/(details)/.test(window.location.pathname);

          if (this.form && this.csrfToken) {
            console.info(this.csrfToken);
            this.initializeLinks();
          } else {
            console.error(`[NZB Unity] Could not locate csrf token, 1-click disabled`);
          }
        } else {
          console.info(`[NZB Unity] 1-click functionality disabled for this site`);
        }
      });
  }

  getNzbIds():string[] {
    return this.form.serializeArray()
      .filter((i) => { return i.name === 'nzb' })
      .map((i) => { return i.value });
  }

  initializeLinks() {
    // Create direct download button
    this.form.find('[type="submit"]').each((i, el) => {
      let submit:JQuery<HTMLElement> = $(el);
      let button:JQuery<HTMLElement> = PageUtil.createButton()
        .on('click', (e) => {
          e.preventDefault();

          let nzbIds:string[] = this.getNzbIds();
          if (nzbIds.length) {
            console.info(`[NZB Unity] Adding ${nzbIds.length} NZB(s)`);
            button.trigger('nzb.pending');

            Promise.all(nzbIds.map((nzbId) => {
              let category = '';
              let filename = nzbId;

              // NZBKing requires a POST request to retreive NZBs. Since SAB can't do that, get the data here and upload it.
              return Util.request({
                method: 'POST',
                url: 'http://nzbking.com/nzb/',
                params: {
                  csrfmiddlewaretoken: this.csrfToken,
                  nzb: nzbId
                }
              })
                .then((nzbContent) => {
                  return Util.sendMessage({
                    'content.addFile': {
                      filename: filename,
                      content: nzbContent,
                      category: category
                    }
                  });
                })
                .catch((e) => {
                  console.error(`[NZB Unity] Error fetching NZB content (${nzbId}): ${e.status} ${e.statusText}`);
                });
            }))
              .then((results:any[]) => {
                setTimeout(() => {
                  if (results.some((r) => { return r === false; })) {
                    button.trigger('nzb.failure');
                  } else {
                    button.trigger('nzb.success');
                  }
                }, 1000);
              });
          }
        })
        .insertBefore(submit);

      if (this.isDetail) {
        button.text('Download All').attr('title', 'Download with NZB Unity');
      }

      // Direct download links
      if (this.isList) {
        $('input[name="nzb"][type="checkbox"]').each((i, el) => {
          let checkbox = $(el);
          let link = PageUtil.createLink()
            .css({ 'margin': '0 0 3px 3px' })
            .on('click', (e) => {
              e.preventDefault();
              link.trigger('nzb.pending');

              let nzbId = checkbox.val();
              let category = '';
              let filename = nzbId;

              console.info(`[NZB Unity] Adding NZB ${nzbId}`);

              // NZBKing requires a POST request to retreive NZBs. Since SAB can't do that, get the data here and upload it.
              return Util.request({
                method: 'POST',
                url: 'http://nzbking.com/nzb/',
                params: {
                  csrfmiddlewaretoken: this.csrfToken,
                  nzb: nzbId
                }
              })
                .then((nzbContent) => {
                  return Util.sendMessage({
                    'content.addFile': {
                      filename: filename,
                      content: nzbContent,
                      category: category
                    }
                  });
                })
                .then((r) => {
                  setTimeout(() => {
                    link.trigger(r === false ? 'nzb.failure' : 'nzb.success');
                  }, 1000);
                })
                .catch((e) => {
                  link.trigger('nzb.failure');
                  console.error(`[NZB Unity] Error fetching NZB content (${nzbId}): ${e.status} ${e.statusText}`);
                });

            })
            .insertAfter(checkbox);
        });
      }

    });
  }
}

$(($) => {
  let nzbIntegration = new NZBUnityNzbking();
});
