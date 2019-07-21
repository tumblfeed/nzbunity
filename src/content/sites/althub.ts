class NZBUnityAlthub {
  public uid:string;
  public apikey:string;
  public replace:boolean = false;

  constructor() {
    Util.storage.get(['Providers', 'ReplaceLinks'])
      .then((opts) => {
        this.replace = opts.ReplaceLinks;
        let provider = opts.Providers && opts.Providers.althub;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);

          let uidMatch = $('head link[href^="/rss"]').attr('href').match(/i=([0-9]+)/);
          let apikeyMatch = $('head link[href^="/rss"]').attr('href').match(/r=([a-z0-9]+)/);

          this.uid = uidMatch ? uidMatch[1] : null;
          this.apikey = apikeyMatch ? apikeyMatch[1] : null;

          if (this.uid && this.apikey) {
            console.info(`Got uid and api key: ${this.uid}, ${this.apikey}`);
            this.initializeLinks();
          } else {
            console.error('[NZB Unity] Could not get UID or API key');
          }
        } else {
          console.info(`[NZB Unity] 1-click functionality disabled for this site`);
        }
      });
  }

  getNzbUrl(id:string):string {
    return `https://api.althub.co.za/getnzb/${id}?i=${this.uid}&r=${this.apikey}`;
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
        if ($('a[href^="/browse?t="]').length) {
          category = $('a[href^="/browse?t="]').text();
          catSrc = 'href';
        }

        let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
        category = split.length ? split[0] : category;

        let opts:CreateAddLinkOptions = { url: url, category: category };

        if (this.replace) {
          PageUtil.bindAddUrl(opts, a, true);
        } else {
          let link:JQuery<HTMLElement> = PageUtil.createAddUrlButton(opts)
            .text('Download with NZB Unity')
            .css({ margin: '0' })
            .appendTo(a.parent());
        }

      } else {
        if (a.closest('div.row').find('a[href^="/browse"]').length) {
          category = a.closest('div.row').find('a[href^="/browse"]').text();
          catSrc = 'href';
        }

        let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
        category = split.length ? split[0] : category;

        let opts:CreateAddLinkOptions = { url: url, category: category };

        if (this.replace) {
          PageUtil.bindAddUrl(opts, a, true);
        } else {
          let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink(opts)
            .css({
              position: 'absolute',
              right: '-5px',
              top: '0'
            })
            .prependTo(a.parent());
        }
      }
    });

    // Create download all buttons
    $('.nzb_multi_operations_download').each((i, el) => {
      let getNzbUrl = (id:string) => { return this.getNzbUrl(id); };
      let button:JQuery<HTMLElement> = PageUtil.createButton()
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

                if (check.closest('div.row').find('a[href^="/browse"]').length) {
                  category = check.closest('div.row').find('a[href^="/browse"]').text();
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
        })
        .css({ 'margin': '0 0.5em' });

      $('<div></div>')
        .css({ display: 'inline-block', 'vertical-align': 'middle' })
        .append(button)
        .prependTo($(el).closest('.nzb_multi_operations'));
    });
  }

}

$(($) => {
  let nzbIntegration = new NZBUnityAlthub();
});

undefined;