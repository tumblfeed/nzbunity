class NZBUnityBinsearch {
  public form:JQuery<HTMLElement>;
  public isList:boolean;
  public isDetail:boolean;

  constructor() {
    Util.storage.get('Providers')
      .then((opts) => {
        let provider = opts.Providers && opts.Providers.binsearch;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);
          this.form = $('form[name="r"]');
          this.isList = /(\?|&)(q|bg|watchlist)=/.test(window.location.search);
          this.isDetail = /(\?|&)(b)=/.test(window.location.search);

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

  getNzbIds():string[] {
    return this.form.serializeArray()
      .filter((i) => { return i.name !== 'action' })
      .map((i) => { return i.name });
  }

  initializeLinks() {
    // Direct download links
    if (this.isList) {
      this.form.find('input[type="checkbox"]').each((i, el) => {
        let checkbox = $(el);
        let link = PageUtil.createLink()
          .css({ 'margin': '0 0 3px 3px' })
          .on('click', (e) => {
            e.preventDefault();
            link.trigger('nzb.pending');

            let nzbId = checkbox.attr('name');

            console.info(`[NZB Unity] Adding NZB ${nzbId}`);

            return PageUtil.requestAndAddFile(
              nzbId,
              '',
              `${window.location.origin}${this.form.attr('action')}`,
              {
                action: 'nzb',
                [nzbId]: 'on'
              }
            )
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
              return PageUtil.requestAndAddFile(
                nzbId,
                '',
                `${window.location.origin}${this.form.attr('action')}`,
                {
                  action: 'nzb',
                  [nzbId]: 'on'
                }
              )
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
        .prependTo(this.form);
    }

    if (this.isDetail) {
      let button:JQuery<HTMLElement> = PageUtil.createButton()
        .text('Download NZB')
        .attr('title', 'Download with NZB Unity')
        .on('click', (e) => {
          e.preventDefault();

          let params = {
            action: 'nzb',
            b: this.form.serializeArray()
              .find((i) => { return i.name === 'b' })
              .value
          };
          let filename = params.b;

          this.form.find('input[type="checkbox"]').each((i, el) => {
            params[$(el).attr('name')] = 'on';
          });

          console.info(`[NZB Unity] Adding ${filename}`);
          button.trigger('nzb.pending');

          return PageUtil.requestAndAddFile(
            filename,
            '',
            window.location.toString(),
            params
          )
            .then((r) => {
              setTimeout(() => {
                button.trigger(r === false ? 'nzb.failure' : 'nzb.success');
              }, 1000);
            })
            .catch((e) => {
              console.error(`[NZB Unity] Error fetching NZB content (${filename}): ${e.status} ${e.statusText}`);
            });
        })
        .prependTo(this.form);

    }
  }
}

$(($) => {
  let nzbIntegration = new NZBUnityBinsearch();
});
