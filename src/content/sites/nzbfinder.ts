class NZBUnityNzbfinder {
  public uid:string;
  public apikey:string;
  public replace:boolean = false;
  
  constructor() {
    Util.storage.get(['Providers', 'ReplaceLinks'])
      .then((opts) => {
        this.replace = opts.ReplaceLinks;
        let provider = opts.Providers && opts.Providers.nzbfinder;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);

          let uidMatch = $('script:not([src])').text().match(/uid\s*=\s*["']([0-9]+)["']/i);
          let apikeyMatch = $('script:not([src])').text().match(/rsstoken\s*=\s*["']([a-z0-9]+)["']/i);

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
    return `${window.location.origin}/getnzb?id=${id}&r=${this.apikey}`;

  }

  initializeLinks() {
    // V4
    // Create direct download links on individual items
    $('a[href*="/getnzb?id="]').each((i, el) => {
      let a:JQuery<HTMLElement> = $(el);
      let guidMatch:string[] = a.attr('href').match(/\/getnzb\?id=([\w-]+)/i);
      let id:string = guidMatch && guidMatch[1];
      let url:string = this.getNzbUrl(id);

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';

      if (window.location.pathname.startsWith('/details')) {
        let catLink = $('.page-content a[href*="/browse/"]').filter(':not([href*="/browse/group?"])');
        if (catLink.length) {
          category = catLink.text();
          catSrc = 'href';
        }

        let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
        category = split.length ? split[0] : category;

        let opts:CreateAddLinkOptions = { url: url, category: category };

        if (this.replace) {
          PageUtil.bindAddUrl(opts, a, true);
        } else {
          let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink(opts);
          link
            .html(`${link.html()} NZB Unity`)
            .addClass('btn btn-default btn-transparent')
            .css({ display: '', height: '', width: '' })
            .insertBefore(a);
        }

      } else {
        if (a.closest('tr').find('.label:first-child').length) {
          // List
          category = a.closest('tr').find('.label:first-child').text();
          catSrc = 'href';
        }

        if (a.closest('.row').find('.label-primary').length) {
          // Covers
          category = a.closest('.row').find('.label-primary').text();
          catSrc = 'href-cover';
        }

        let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
        category = split.length ? split[0] : category;

        let opts:CreateAddLinkOptions = { url: url, category: category };

        if (this.replace) {
          PageUtil.bindAddUrl(opts, a, true);
        } else {
          let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink(opts)
            .css({ margin: '0 0.5em 0 0' })
            .insertBefore(a);

          a.parent().css({ 'white-space': 'nowrap' });
        }
      }
    });

    // Create download all buttons
    $('.nzb_multi_operations_download').each((i, el) => {
      let getNzbUrl = (id:string) => { return this.getNzbUrl(id); };
      let button:JQuery<HTMLElement> = PageUtil.createButton()
        .text('NZB Unity')
        .addClass('btn')
        .css({
          'border-top-right-radius': '0',
          'border-bottom-right-radius': '0',
          'height': '25px',
          'line-heignt': '11px',
          'margin': '0',
        })
        .on('click', (e) => {
          e.preventDefault();

          let checked:JQuery<HTMLElement> = $('#nzb_multi_operations_form .nzb_check:checked');
          if (checked.length) {
            console.info(`[NZB Unity] Adding ${checked.length} NZB(s)`);
            button.trigger('nzb.pending');

            Promise.all(checked.map((i, el) => {
              let check = $(el);
              let id = <string> check.val();

              if (/[a-d0-9\-]+/.test(id)) {
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
        })
        .insertBefore(el);
    });
  }
}

$(($) => {
  let nzbIntegration = new NZBUnityNzbfinder();
});

undefined;