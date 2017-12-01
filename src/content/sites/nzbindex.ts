class NZBUnityNzbindex {
  public form:JQuery<HTMLElement>;
  public isList:boolean;
  public isDetail:boolean;

  constructor() {
    Util.storage.get('Providers')
      .then((opts) => {
        let provider = opts.Providers && opts.Providers.nzbindex;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);
          this.form = $('#results > form');
          this.isList = /^\/(groups|search)/.test(window.location.pathname);
          this.isDetail = /^\/(release)/.test(window.location.pathname);

          if (this.form) {
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
    return `${window.location.protocol}//${window.location.host}/download/${id}`;
  }

  getNzbIds():string[] {
    return this.form.serializeArray()
      .filter((i) => { return i.name === 'r[]' })
      .map((i) => { return i.value });
  }

  initializeLinks() {
    // Direct download links
    if (this.isList) {
      this.form.find('input[name="r[]"][type="checkbox"]').each((i, el) => {
        let checkbox = $(el);
        let link = PageUtil.createLink()
          .css({ 'display': 'block' })
          .on('click', (e) => {
            e.preventDefault();

            let nzbUrl = checkbox.closest('tr').find('a[href*="/download/"]').attr('href')
            let nzbId = <string> checkbox.val();

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
        .insertBefore(this.form.find('[type="submit"]:first'));
    }

    if (this.isDetail && this.form.find('[name="r[]"]')) {
      let button:JQuery<HTMLElement> = PageUtil.createButton()
        .text('Download All')
        .attr('title', 'Download with NZB Unity')
        .on('click', (e) => {
          e.preventDefault();

          let nzbId = <string> this.form.find('[name="r[]"]').val();

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
        })
        .prependTo(this.form);

    }
  }
}

$(($) => {
  let nzbIntegration = new NZBUnityNzbindex();
});
