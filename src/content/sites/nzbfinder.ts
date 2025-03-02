class NZBUnityNzbfinder {
  public uid: string;
  public apikey: string;
  public replace: boolean = false;

  constructor() {
    Util.storage.get(['Providers', 'ReplaceLinks'])
      .then((opts) => {
        this.replace = opts.ReplaceLinks;
        let provider = opts.Providers && opts.Providers.nzbfinder;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);

          this.uid = this.getMeta('user_id');
          this.apikey = this.getMeta('api_token');

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
    return `${this.getMeta('root_url') ?? window.location.origin}/api/v1/getnzb?id=${id}&r=${this.apikey}`;
  }

  isList(link: HTMLElement): boolean {
    return link.parentElement.tagName === 'TD';
  }

  getLinkContainer(link: HTMLElement): HTMLElement {
    return link.closest(this.isList(link) ? 'tr' : 'article') ?? link.closest('#buttongroup');
  }

  getFirstChild(container: HTMLElement): HTMLElement {
    return container.querySelector(':scope > :first-child') as HTMLElement;
  }

  getCategory(link: HTMLElement): string {
    const cat = this.getLinkContainer(link)?.querySelector('#catname')?.textContent.trim();

    if (/^\w+$/.test(cat)) {
      // If the category is a single word, it's probably a sub-category
      // try to get the main category from the url
      const catMatch = new RegExp(`/(\\w+)/${cat}`).exec(window.location.pathname);
      if (catMatch) {
        return `${catMatch[1]} ${cat}`;
      }
    }

    return cat;
  }

  initializeLinks() {
    // V5
    // Create direct download links on individual items
    document.querySelectorAll('a[href*="/getnzb?id="]').forEach(el => {
      const a = el as HTMLElement;
      const guidMatch = a.getAttribute('href').match(/\/getnzb\?id=([\w-]+)/i) as string[];
      const id = guidMatch && guidMatch[1];

      const opts: CreateAddLinkOptions = {
        url: this.getNzbUrl(id),
        category: this.getCategory(a),
      };

      if (window.location.pathname.startsWith('/details')) {
        // Item detail
        const catLink = document.querySelector('table a[href*="/browse/"]:not([href*="/browse/group?"])');
        if (catLink) {
          opts.category = (catLink as HTMLElement).innerText.trim();
        }

        if (this.replace) {
          PageUtil.bindAddUrl(opts, a, true);
        } else {
          const link = PageUtil.createAddUrlLink(opts)
            .addClass(this.getFirstChild(a).classList.value)
            .insertBefore(a);

          if (a.parentElement.id === 'buttongroup') {
            // Info tab, side
            link
              .html(`${link.html()} NZB Unity`)
              .css({ display: '', height: '', width: '' });

            link.find('> img')
              .css({ margin: '0 5px 0 3px' });

            this.getFirstChild(a).classList.remove('rounded-t-md');
          } else {
            // Similar tab, table.
            link
              .addClass('align-bottom')
              .css({ margin: '0 0 2px 0' });
          }
        }
      } else {
        if (this.replace) {
          PageUtil.bindAddUrl(opts, a, true);
        } else if (this.isList(a)) {
          // List
          const link = PageUtil.createAddUrlLink(opts)
            .addClass(this.getFirstChild(a).classList.value)
            .css({ display: 'inline', height: '', width: '' })
            .insertBefore(a);

          link.find('> img')
            .css({ display: 'inline' });

          a.parentElement.style.minWidth = `75px`;
        } else {
          // Covers
          PageUtil.createAddUrlLink(opts)
            .addClass(this.getFirstChild(a).classList.value)
            .addClass('align-bottom h-full')
            .css({ display: '', height: '', width: '' })
            .insertBefore(a);
        }
      }
    });

    // Create download all buttons
    document.querySelectorAll('#multidownload').forEach(el => {
      const button = PageUtil.createButton()
        .removeAttr('style')
        .text('NZB Unity')
        .addClass(el.classList.value)
        .css({
          background: `transparent url(${PageUtil.iconGreen}) no-repeat scroll 10px center`,
          'background-color': '',
          cursor: 'pointer',
          'padding-left': '30px',
          'white-space': 'nowrap',
        })
        .on('click', (e) => {
          e.preventDefault();

          const checked = document.querySelectorAll('input[type="checkbox"][name="chk"]:checked');
          if (checked.length) {
            console.info(`[NZB Unity] Adding ${checked.length} NZB(s)`);
            button.trigger('nzb.pending');

            Promise
              .all(Array.from(checked).map(el => {
                const check = el as HTMLInputElement;
                const id = check.value;

                if (/[a-d0-9\-]+/.test(id)) {
                  const opts: CreateAddLinkOptions = {
                    url: this.getNzbUrl(id),
                    category: this.getCategory(check),
                  };

                  console.info(`[NZB Unity] Adding URL`, opts);
                  return Util.sendMessage({ 'content.addUrl': opts });
                } else {
                  return Promise.resolve();
                }
              }))
              .then(results => {
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

      el.classList.remove('rounded-l-md');
    });
  }
}

PageUtil.ready(() => new NZBUnityNzbfinder());
