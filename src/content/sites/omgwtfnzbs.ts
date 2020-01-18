class NZBUnityOmgwtfnzbs {
  public username:string;
  public apikey:string;
  public apiurl:string;
  public replace:boolean = false;

  constructor() {
    Util.storage.get(['Providers', 'ReplaceLinks'])
      .then((opts) => {
        this.replace = opts.ReplaceLinks;
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
    return PageUtil.request({ url: '/account' })
      .then((r) => {
        let el = $(r).find('a[href="account?action=api"]');
        let api:string = el.length ? el[0].innerText : null;
        return api.match(/^[a-f0-9]+$/i) ? api : null; // api key must be hex
      })
  }

  getNzbUrl(id:string):string {
    return `${this.apiurl}?user=${this.username}&api=${this.apikey}&id=${id}`;
  }

  initializeLinks() {
    const view = Util.getQueryParam('view', 'list');

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
      })
        .css({ margin: '0 5px' })
        .on('nzb.success', (e) => {
          link.closest('tr').find('a[href*="details"]').first()
            .prepend('<img src="pics/downloaded.png" class="hastip" title="" style="width:13px;margin-right:.25em;" border="0">');
        });

      if (this.replace) {
        a.replaceWith(link);
      } else {
        link.insertAfter(a);
      }
    });

    // Create download all buttons
    $('#browseDLButton').each((i, el) => {
      let getNzbUrl = (id:string) => { return this.getNzbUrl(id); };
      let button:JQuery<HTMLElement> = PageUtil.createButton()
        .css({ 'margin': '0.2em' })
        .on('click', (e) => {
          e.preventDefault();

          let checked:JQuery<HTMLElement> = $('.nzbt_row .checkbox:checked');
          if (checked.length) {
            console.info(`[NZB Unity] Adding ${checked.length} NZB(s)`);
            button.trigger('nzb.pending');

            Promise.all(checked.map((i, el) => {
              let check = $(el);
              let id = <string> check.val();

              // Get the category
              let category:string = '';
              let catSrc:string = 'default';

              if (check.closest('li,tr').find('[href^="/browse?cat"]').length) {
                category = check.closest('li,tr').find('[href^="/browse?cat"]').text();
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
        .insertBefore($(el));
    });

    // Add dates to rows
    console.debug(view);

    if (view === 'list') {
      $('.nzbt_row > [data-sort]:last-child').each((i, el) => {
        let date = $(el).data('sort');
        if (date) {
          date = new Date(date * 1000);

          const [dName, mm, dd, yy] = date.toDateString().split(' ')
          const isCurYear = String((new Date()).getFullYear()) === yy;
          const container = $(el).find('span').first();

          container
            .css({ 'font-size': '0.9em' })
            .text(`${mm} ${dd} ${isCurYear ? '' : yy} (${container.text()})`);
        }
      });
    }
  }
}

$(($) => {
  let nzbIntegration = new NZBUnityOmgwtfnzbs();
});
