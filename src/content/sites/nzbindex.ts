class NZBUnityNzbindex {
  public readonly checkboxSelector:string = 'input[id^="release_"][type="checkbox"]';

  public results:JQuery<HTMLElement>;
  public isList:boolean;
  public isDetail:boolean;

  constructor() {
    Util.storage.get('Providers')
      .then((opts) => {
        // result rows load async, so they are not immediately available on first load
        // but are available on reload. Just wait a little for them to show up.
        return new Promise((resolve) => setTimeout(() => resolve(opts), 500));
      })
      .then((opts: NZBUnityOptions) => {
        let provider = opts.Providers && opts.Providers.nzbindex;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);
          this.results = $('#results-table .result');
          this.isDetail = /^\/(collection)/.test(window.location.pathname);
          this.isList = this.results.length > 0 && !this.isDetail;

          if (this.results.length) {
            this.initializeLinks();
          } else {
            console.error(`[NZB Unity] Could not locate form, 1-click disabled`);
          }
        } else {
          console.info(`[NZB Unity] 1-click functionality disabled for this site`);
        }
      });
  }

  getNzbUrl(id:string):string {
    return `${window.location.origin}/download/${id}`;
  }

  getNzbIds():string[] {
    return this.results.find(`${this.checkboxSelector}:checked`).toArray()
      .map(el => el.id.replace('release_', ''))
  }

  initializeLinks() {
    console.info(this);

    // Direct download links
    if (this.isList) {
      this.results.find(this.checkboxSelector).each((i, el) => {
        let checkbox = $(el);

        console.info(checkbox);

        let link = PageUtil.createLink()
          .css({ 'display': 'block' })
          .on('click', (e) => {
            e.preventDefault();

            let nzbUrl = checkbox.closest('tr').find('a[href*="/download/"]').attr('href')
            let nzbId = el.id.replace('release_', '');

            console.info(`[NZB Unity] Adding NZB ${nzbId}`);
            link.trigger('nzb.pending');

            Util.sendMessage({ 'content.addUrl': {
              category: '',
              url: nzbUrl || this.getNzbUrl(nzbId)
            }})
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

    // Create direct download button
    if (this.isList) {
      let button:JQuery<HTMLElement> = PageUtil.createButton()
        .on('click', (e) => {
          e.preventDefault();

          let nzbIds:string[] = this.getNzbIds();
          if (nzbIds.length) {
            console.info(`[NZB Unity] Adding ${nzbIds.length} NZB(s)`);
            button.trigger('nzb.pending');

            Promise.all(nzbIds.map((nzbId) => {
              console.log(this.getNzbUrl(nzbId));
              return Util.sendMessage({ 'content.addUrl': {
                category: '',
                url: this.getNzbUrl(nzbId)
              }});
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
        .prependTo($('#actions'));
      }

    if (this.isDetail) {
      let button:JQuery<HTMLElement> = PageUtil.createButton()
        .text('Download NZB')
        .attr('title', 'Download with NZB Unity')
        .on('click', (e) => {
          e.preventDefault();

          let match = window.location.pathname.match(/^\/\w+\/(\d+)/);
          if (match) {
            let nzbId = match[1];

            console.info(`[NZB Unity] Adding NZB ${nzbId}`);
            button.trigger('nzb.pending');

            Util.sendMessage({ 'content.addUrl': {
              category: '',
              url: this.getNzbUrl(nzbId)
            }})
              .then((r) => {
                setTimeout(() => {
                  button.trigger(r === false ? 'nzb.failure' : 'nzb.success');
                }, 1000);
              })
              .catch((e) => {
                console.error(`[NZB Unity] Error fetching NZB content (${nzbId}): ${e.status} ${e.statusText}`);
              });
          }
        })
        .prependTo($('#actions'));
    }
  }
}

$(($) => {
  let nzbIntegration = new NZBUnityNzbindex();
});
