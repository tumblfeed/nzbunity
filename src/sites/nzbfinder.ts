class NZBUnityNzbfinder {
  public uid: string;
  public apikey: string;
  public replace: boolean = false;

  // TODO: Remove after not likely to revert to v4
  private v4: boolean = false;

  constructor() {
    Util.storage.get(['Providers', 'ReplaceLinks'])
      .then((opts) => {
        this.replace = opts.ReplaceLinks;
        let provider = opts.Providers && opts.Providers.nzbfinder;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);

          // TODO: Remove after not likely to revert to v4
          this.v4 = /v4/i.test(this.getMeta('version'));

          if (this.v4) {
            let uidMatch = $('script:not([src])').text().match(/uid\s*=\s*["']([0-9]+)["']/i);
            let apikeyMatch = $('script:not([src])').text().match(/rsstoken\s*=\s*["']([a-z0-9]+)["']/i);

            this.uid = uidMatch ? uidMatch[1] : null;
            this.apikey = apikeyMatch ? apikeyMatch[1] : null;
          } else {
            this.uid = this.getMeta('user_id');
            this.apikey = this.getMeta('api_token');
          }

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

  getMeta(name: string, attr: string = 'content'): string {
    return document.querySelector(`meta[name="${name}"]`)?.getAttribute(attr);
  }

  getNzbUrl(id: string): string {
    return `${this.getMeta('root_url') ?? window.location.origin}/getnzb?id=${id}&r=${this.apikey}`;

  }

  initializeLinks() {
    // TODO: Remove after not likely to revert to v4
    if (this.v4) {
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
            'line-height': '11px',
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
    } else {
      // V5
      // Create direct download links on individual items
      $('a[href*="/getnzb?id="]').each((i, el) => {
        const a = $(el);
        const guidMatch: string[] = a.attr('href').match(/\/getnzb\?id=([\w-]+)/i);
        const id: string = guidMatch && guidMatch[1];
        const url: string = this.getNzbUrl(id);

        // Get the category
        let category:string = '';

        if (window.location.pathname.startsWith('/details')) {
          // Item detail
          const catLink = $('table a[href*="/browse/"]').filter(':not([href*="/browse/group?"])');
          if (catLink.length) {
            category = catLink.text();
          }

          const opts:CreateAddLinkOptions = { url, category };

          if (this.replace) {
            PageUtil.bindAddUrl(opts, a, true);
          } else {
            const link = PageUtil.createAddUrlLink(opts)
              .addClass(a.find('> :first-child').attr('class'))
              .insertBefore(a);

            if (/buttongroup/i.test(a.parent().prop('id'))) {
              // Info tab, side
              link
                .html(`${link.html()} NZB Unity`)
                .css({ display: '', height: '', width: '' });

              link.find('> img')
                .css({ margin: '0 5px 0 3px' });

              a.find('> :first-child').removeClass('rounded-t-md');
            } else {
              // Similar tab, table.
              link
                .addClass('align-bottom')
                .css({ margin: '0 0 2px 0' });
            }
          }
        } else if (window.location.pathname.startsWith('/browse')) {
          // List
          const catMatch = /^\/browse\/(\w+)\/(\w+)\/?$/.exec(window.location.pathname);
          if (catMatch) {
            category = window.location.pathname.split('/').slice(2).join(' ');
          }

          const opts:CreateAddLinkOptions = { url, category };

          if (this.replace) {
            PageUtil.bindAddUrl(opts, a, true);
          } else {
            PageUtil.createAddUrlLink(opts)
              .addClass(a.find('> :first-child').attr('class'))
              .removeClass('h-5 w-5')
              .css({ display: '', height: '', width: '', margin: '0 2px 2px 0' })
              .insertBefore(a);

            a.parent().css({
              display: 'flex',
              'flex-wrap': 'nowrap',
              'align-items': 'flex-end',
              'justify-content': 'flex-end',
              'margin-top': '5px',
            });
          }
        } else {
          // Covers
          const catMatch = /^\/(\w+)\/(\w+)\/?$/.exec(window.location.pathname);
          if (catMatch) {
            // Probably in the path
            category = catMatch.slice(1).join(' ');
          }

          const opts:CreateAddLinkOptions = { url, category };

          if (this.replace) {
            PageUtil.bindAddUrl(opts, a, true);
          } else {
            PageUtil.createAddUrlLink(opts)
              .addClass(a.find('> :first-child').attr('class'))
              .addClass('align-bottom h-full')
              .css({ display: '', height: '', width: '' })
              .insertBefore(a);
          }
        }
      });

      // Create download all buttons
      Array.from(document.querySelectorAll('main button[type="button"]'))
        .filter(el => el.innerHTML.trim() === 'Download')
        .forEach(el => {
          const button = PageUtil.createButton()
            .text('NZB Unity')
            .addClass(el.getAttribute('class'))
            .css({
              'background-color': '',
              'background-position': '7px center',
              border: '',
              'border-radius': '',
              color: '',
              display: '',
              'font-size': '',
              'font-weight': '',
              height: '',
              margin: '',
              'padding-left': '28px',
              'text-shadow': '',
            })
            .on('click', (e) => {
              e.preventDefault();

              const checked = $('input[type="checkbox"][name="chk"]:checked');
              if (checked.length) {
                console.info(`[NZB Unity] Adding ${checked.length} NZB(s)`);
                button.trigger('nzb.pending');

                Promise.all(checked.map((i, el) => {
                  const check = $(el);
                  const id = check.val() as string;

                  if (/[a-d0-9\-]+/.test(id)) {
                    const url = this.getNzbUrl(id);

                    // Get the category
                    let category:string = '';

                    if (check.closest('tr').find('.rounded-md:first-child').length) {
                      category = check.closest('tr').find('.rounded-md:first-child').text().trim();
                    }

                    const opts: CreateAddLinkOptions = { url, category };

                    console.info(`[NZB Unity] Adding URL`, opts);
                    return Util.sendMessage({ 'content.addUrl': opts });
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

          el.classList.remove('rounded-l-md');
        });
    }
  }
}

$(($) => {
  let nzbIntegration = new NZBUnityNzbfinder();
});

undefined;
