class NZBUnityNzbsu {
  public uid:string;
  public apikey:string;
  public replace:boolean = false;

  constructor() {
    Util.storage.get(['Providers', 'ReplaceLinks'])
      .then((opts) => {
        this.replace = opts.ReplaceLinks;
        let provider = opts.Providers && opts.Providers.nzbsu;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);

          let rssUrl:string = $('link[href^="/rss"]').attr('href');
          let parsedRssUrl:ParsedUrl = Util.parseUrl(rssUrl);

          this.uid = rssUrl ? parsedRssUrl.search.i : null;
          this.apikey = rssUrl ? parsedRssUrl.search.r : null;

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
    return `https://nzb.su/getnzb/${id}.nzb?i=${this.uid}&r=${this.apikey}`;
  }

  initializeLinks() {
    // Create direct download links on individual items
    $('a[href^="/getnzb/"]').each((i, el) => {
      let a:JQuery<HTMLElement> = $(el);
      let guidMatch:string[] = a.attr('href').match(/\/getnzb\/(\w+)/i);
      let id:string = guidMatch && guidMatch[1];

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';

      if (a.closest('.row').find('[href^="/browse?t"]').length) {
        category = a.closest('.row').find('[href^="/browse?t"]').data('original-title').replace(/^Browse /, '');
        catSrc = 'href';
      }

      let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
      category = split.length ? split[0] : category;

      let opts:CreateAddLinkOptions = { url: this.getNzbUrl(id), category: category };

      if (this.replace) {
        PageUtil.bindAddUrl(opts, a, true);
      } else {
        let link:JQuery<HTMLElement> = PageUtil.createAddUrlButton(opts)
          .css({ margin: '0 0.5em 0 0' });

        if (window.location.pathname.startsWith('/details')) {
          link.insertBefore(a.closest('.btn-group'));
        } else {
          link.insertBefore(a);
        }
      }
    });

    // Create download all buttons
    $('.nzb_multi_operations_download').each((i, el) => {
      let getNzbUrl = (id:string) => { return this.getNzbUrl(id); };
      let button:JQuery<HTMLElement> = PageUtil.createButton()
        .css({ 'margin': '0.2em' })
        .on('click', (e) => {
          e.preventDefault();

          let checked:JQuery<HTMLElement> = $('#browsetable .nzb_check:checked');
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

                if (check.closest('.row').find('[href^="/browse?t"]').length) {
                  category = check.closest('.row').find('[href^="/browse?t"]').attr('title').replace(/^Browse /, '');
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
        .prependTo($(el).closest('.nzb_multi_operations'));
    });
  }

}

$(($) => {
  let nzbIntegration = new NZBUnityNzbsu();
});

undefined;