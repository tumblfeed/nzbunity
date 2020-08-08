class NZBUnityDrunkenslug {
  public uid:string;
  public apikey:string;
  public replace:boolean = false;

  constructor() {
    Util.storage.get(['Providers', 'ReplaceLinks'])
      .then((opts) => {
        this.replace = opts.ReplaceLinks;
        const provider = opts.Providers && opts.Providers.drunkenslug;
        const enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click for drunkenslug.com...`);

          this.getApiKey()
            .then(({ uid, apiKey }) => {
              this.uid = uid;
              this.apikey = apiKey;

              if (this.uid && this.apikey) {
                console.info(`[NZB Unity] Got uid and api key: ${this.uid}, ${this.apikey}`);
                this.initializeLinks();
              } else {
                console.error('[NZB Unity] Could not get UID or API key');
              }
            });
        } else {
          console.info(`[NZB Unity] 1-click functionality disabled for this site`);
        }
      });
  }

  getApiKey():Promise<{ uid:string, apiKey:string }> {
    return PageUtil.request({ url: '/profile' })
      .then((r) => {
        const el = $(r).find('a[href*="/rss?"]');
        const [, uid] = el.prop('href').match(/i=([0-9]+)/i);
        const [, apiKey] = el.prop('href').match(/r=([a-z0-9]+)/i);
        return {
          uid,
          apiKey,
        };
      });
  }

  getNzbUrl(id:string):string {
    return `https://drunkenslug.com/getnzb/${id}?i=${this.uid}&r=${this.apikey}`;
  }

  initializeLinks() {
    // Create direct download links on individual items
    $('a[href^="/getnzb/"]').each((i, el) => {
      let a:JQuery<HTMLElement> = $(el);
      let guidMatch:string[] = a.attr('href').match(/\/getnzb\/(\w+)/i);
      let id:string = guidMatch && guidMatch[1];
      let url:string = this.getNzbUrl(id);

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';


      if (window.location.pathname.startsWith('/details')) {
        if ($('dd a[href^="/browse?t="]').length) {
          category = $('dd a[href^="/browse?t="]').text();
          catSrc = 'href';
        }
      } else {
        if (a.closest('tr').find('a[href^="/browse?t="]').length) {
          category = a.closest('tr').find('a[href^="/browse?t="]').text();
          catSrc = 'href';
        }
      }

      let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
      category = split.length ? split[0] : category;

      let opts:CreateAddLinkOptions = { url: url, category: category };

      if (this.replace) {
        PageUtil.bindAddUrl(opts, a, true);
      } else {
        let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink(opts)
          // .text('Download with NZB Unity')
          .css({ margin: '0 0.5em 0 0' })
          .insertBefore(a);
      }
    });

    // Create download all buttons
    $('.nzb_multi_operations_download').each((i, el) => {
      let getNzbUrl = (id:string) => { return this.getNzbUrl(id); };
      let button:JQuery<HTMLElement> = PageUtil.createButton()
        .css({ 'margin': '0 0.5em 10px 0' })
        .on('click', (e) => {
          e.preventDefault();

          let checked:JQuery<HTMLElement> = $('#nzb_multi_operations_form .nzb_check:checked');
          if (checked.length) {
            console.info(`[NZB Unity] Adding ${checked.length} NZB(s)`);
            button.trigger('nzb.pending');

            Promise.all(checked.map((i, el) => {
              let check = $(el);
              let id = <string> check.val();

              if (/[a-d0-9]+/.test(id)) {
                // Get the category
                let category:string = '';
                let catSrc:string = 'default';

                if (check.closest('tr').find('.label:first-child').length) {
                  category = check.closest('tr').find('.label:first-child').text();
                  catSrc = 'href';
                }

                let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
                category = split.length ? split[0] : category;

                let options = {
                  url: getNzbUrl(id),
                  category: category
                };

                console.info(`[NZB Unity] Adding URL`, options);
                return Util.sendMessage({ 'content.addUrl': options });
              } else {
                return Promise.resolve();
              }
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
        });

      $('<div></div>')
        .css({ display: 'inline-block', 'vertical-align': 'middle' })
        .append(button)
        .insertBefore($(el).parent());
    });
  }

}

$(($) => {
  let nzbIntegration = new NZBUnityDrunkenslug();
});

undefined;