class NZBUnityTabulaRasa {
  public apikey:string;
  public replace:boolean = false;

  constructor() {
    this.initialize();
  }

  async initialize():Promise<void> {
    const { Providers, ReplaceLinks } = await Util.storage.get(['Providers', 'ReplaceLinks'])
    this.replace = ReplaceLinks;
    const provider = Providers && Providers.tabularasa;
    const enabled:boolean = provider ? provider.Enabled : true;

    if (enabled) {
      console.info(`[NZB Unity] Initializing 1-click functionality...`);

      this.apikey = await this.getApiKey();

      if (this.apikey) {
        console.info(`Got api key: ${this.apikey}`);
        return this.initializeLinks();
      } else {
        console.warn('Could not get API key');
      }
    } else {
      console.info(`[NZB Unity] 1-click functionality disabled for this site`);
    }
  }

  async getApiKey():Promise<string> {
    const r = await PageUtil.request({ url: '/profile' });
    const [match, token] = r.match(/api_token=([a-f0-9]+)/i);
    return token;
  }

  getNzbUrl(id:string):string {
    return `${window.location.origin}/api/v2/getnzb?id=${id}&api_token=${this.apikey}`;
  }

  initializeLinks() {
    // Create direct download links on individual items
    $('a[href*="/getnzb?id="]').each((i, el) => {
      const a:JQuery<HTMLElement> = $(el);
      const [match, id] = a.attr('href').match(/\/getnzb\?id=([\w-]+)/i);
      const url:string = this.getNzbUrl(id);

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';

      if (window.location.pathname.startsWith('/details')) {
        const catLink = $('.tab-content a[href*="/browse/"]').filter(':not([href*="?"])');
        if (catLink.length) {
          category = catLink.text();
          catSrc = 'href';
        }

        category = category.split(/[^\w-]/)[0]; // Either "Movies: HD" or "Movies HD"

        const linkOpts:CreateAddLinkOptions = { url, category };

        if (this.replace) {
          PageUtil.bindAddUrl(linkOpts, a, true);
        } else {
          const link:JQuery<HTMLElement> = PageUtil.createAddUrlLink(linkOpts);
          link
            .html(`${link.html()} NZB Unity`)
            .addClass('btn btn-light btn-sm btn-success btn-transparent')
            .css({ display: '', height: '', width: '', 'margin-left': '-1px' })
            .insertBefore(a);
        }

      } else if (a.attr('role') === 'button') {
          const linkOpts:CreateAddLinkOptions = { url, category: null };

          if (this.replace) {
            PageUtil.bindAddUrl(linkOpts, a, true);
          } else {
            const link:JQuery<HTMLElement> = PageUtil.createAddUrlLink(linkOpts)
              .css({ float: 'left', margin: '0 0.25em 0 0' });

            a.parent().parent().find('.release-name').prepend(link);
          }
      } else {
        // List
        category = a.closest('tr[id^="guid"]').find('td:nth-child(3)').text();
        catSrc = 'href';

        category = category.split(/[^\w-]/)[0]; // Either "Movies: HD" or "Movies HD"

        const linkOpts:CreateAddLinkOptions = { url, category };

        if (this.replace) {
          PageUtil.bindAddUrl(linkOpts, a, true);
        } else {
          const link:JQuery<HTMLElement> = PageUtil.createAddUrlLink(linkOpts)
            .css({ margin: '0 0.25em 0 0' })
            .insertBefore(a);
        }
      }
    });

    // Create download all buttons
    $('.nzb_multi_operations_download').each((i, el) => {
      const getNzbUrl = (id:string) => this.getNzbUrl(id);
      let button:JQuery<HTMLElement> = PageUtil.createButton()
        .text('NZB Unity')
        .addClass('btn btn-sm')
        .css({
          'border-top-right-radius': '0',
          'border-bottom-right-radius': '0',
          'line-heignt': '11px',
          'margin': '0',
        })
        .on('click', (e) => {
          e.preventDefault();

          const checked:JQuery<HTMLElement> = $('input[name="table_records"]:checked');
          if (checked.length) {
            console.info(`[NZB Unity] Adding ${checked.length} NZB(s)`);
            button.trigger('nzb.pending');

            Promise.all(checked.map((i, el) => {
              const check = $(el);
              const id = check.val() as string;

              if (/[a-d0-9\-]+/.test(id)) {
                const linkOpts:CreateAddLinkOptions = { url: getNzbUrl(id) };

                console.info(`[NZB Unity] Adding URL`, linkOpts);
                return Util.sendMessage({ 'content.addUrl': linkOpts });
              } else {
                return Promise.resolve();
              }
            }))
              .then((results:any[]) => {
                setTimeout(() => {
                  if (results.some(r => r === false)) {
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
  const nzbIntegration = new NZBUnityTabulaRasa();
});

undefined;