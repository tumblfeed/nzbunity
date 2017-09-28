class NZBUnityOmgwtfnzbs {
  public username:string;
  public apikey:string;
  public apiurl:string;

  constructor() {
    Util.storage.get('Providers')
      .then((opts) => {
        let provider = opts.Providers && opts.Providers.omgwtfnzbs;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);

          this.username = this.getUsername();
          this.apiurl = `${window.location.protocol}//api.omgwtfnzbs.me/nzb/`;

          this.getApiKey()
            .then((apikey) => {
              this.apikey = apikey;

              if (this.username && this.apikey) {
                console.info(`Got username and api key: ${this.username}, ${this.apikey}`);
                this.initializeLinks();
              } else {
                console.warn('Could not get API key');
              }
            });
        } else {
          console.info(`[NZB Unity] 1-click functionality disabled for this site`);
        }
      });
  }

  getUsername():string {
    return $('a[href="/account"]')[0].innerText;
  }

  getApiKey():Promise<string> {
    return PageUtil.request({ url: '/account', params: { action: 'api' } })
      .then((r) => {
        let el = $(r).find('[color="orange"]');
        return el.length ? el[0].innerText : null
      })
  }

  getNzbUrl(id:string):string {
    return `${this.apiurl}?user=${this.username}&api=${this.apikey}&id=${id}`;
  }

  initializeLinks() {
    // Create direct download links
    // I'm not a huge fan of matching against the download icon, but it works for this site without hitting multiple links in the same row.
    $('img[src*="pics/dload"]').closest('a[href*="send?"]').each((i, el) => {
      let a:JQuery<HTMLElement> = $(el);
      let idMatch:string[] = a.attr('href').match(/id=(\w+)/i);
      let id:string = idMatch && idMatch[1];

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';

      if ($('#category').length) {
        // Short circuit if there is a category element (usually the details page)
        category = $('#category').text();
        catSrc = '#';
      } else if (window.location.pathname.match(/^\/trends/)) {
        // Trends page
        category = a.closest('li,tr').find('.bmtip.cat_class').text();
        catSrc = 'trends';
      } else {
        // Everything else (usually the browse page)
        category = a.closest('li,tr').find('[href^="/browse?cat"]').text();
        catSrc = 'href';
      }

      let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
      category = split.length ? split[0] : category;

      let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
        url: this.getNzbUrl(id),
        category: category
      }, el)
        .css({ margin: '0 .2em 0 .5em' })
        .on('addUrl.success', (e) => {
          link.closest('tr').find('a[href*="details"]').first()
            .prepend('<img src="pics/downloaded.png" class="hastip" title="" style="width:13px;margin-right:.25em;" border="0">');
        });
    });

    // If NZB intercept is enabled, we should go ahead and make that work as well.
    Util.storage.get('InterceptDownloads')
      .then((opts) => {
        if (opts.InterceptDownloads) {
          $('a[href*="send?"]').each((i, el) => {
            let a:JQuery<HTMLElement> = $(el);
            let idMatch:string[] = a.attr('href').match(/id=(\w+)/i);
            let id:string = idMatch && idMatch[1];
            a.attr('href', this.getNzbUrl(id));
          });
        }
      });
  }
}

let omgwtfnzbs = new NZBUnityOmgwtfnzbs();




