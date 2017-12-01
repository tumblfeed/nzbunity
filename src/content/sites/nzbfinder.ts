class NZBUnityNzbfinder {
  public uid:string;
  public apikey:string;

  constructor() {
    Util.storage.get('Providers')
      .then((opts) => {
        let provider = opts.Providers && opts.Providers.nzbfinder;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);

          let uidMatch = $('script:not([src])').text().match(/Uid = "([0-9]+)"/);
          let apikeyMatch = $('script:not([src])').text().match(/RSSTOKEN = "([a-z0-9]+)"/);

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
    return `https://nzbfinder.ws/getnzb/${id}?i=${this.uid}&r=${this.apikey}`;
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


      if (/^\/(details)/.test(window.location.pathname)) {
        if ($('a[href^="/browse?t="]').length) {
          category = $('a[href^="/browse?t="]').text();
          catSrc = 'href';
        }

        let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
        category = split.length ? split[0] : category;

        let link:JQuery<HTMLElement> = PageUtil.createAddUrlButton({
          url: url,
          category: category
        })
          .text('Download with NZB Unity')
          .css({ margin: '0 0 10px 0' })
          .insertBefore(a);

      } else {
        if (a.closest('tr').find('.label:first-child').length) {
          category = a.closest('tr').find('.label:first-child').text();
          catSrc = 'href';
        }

        let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
        category = split.length ? split[0] : category;

        let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
          url: url,
          category: category
        })
          .css({ margin: '0 0.5em 0 0' })
          .insertBefore(a);

        a.parent().css({ 'white-space': 'nowrap' });
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
  let nzbIntegration = new NZBUnityNzbfinder();
});

undefined;