class NZBUnityNzbgeek {
  public replace:boolean = false;

  constructor() {
    Util.storage.get(['Providers', 'ReplaceLinks'])
      .then((opts) => {
        this.replace = opts.ReplaceLinks;
        let provider = opts.Providers && opts.Providers.nzbgeek;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);
          this.initializeLinks();
        } else {
          console.info(`[NZB Unity] 1-click functionality disabled for this site`);
        }
      });
  }

  // getNzbUrl(id:string):string {
  //   return `${this.apiurl}?user=${this.username}&api=${this.apikey}&id=${id}`;
  // }

  initializeLinks() {
    // Create direct download links
    $('a[href*="/api?t=get&id="]').each((i, el) => {
      let a:JQuery<HTMLElement> = $(el);
      let row:JQuery<HTMLElement> = a.closest('tr.releases');

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';
      let pathSearch:string = window.location.pathname + window.location.search;

      if (row.find('a.releases_category_text').length) {
        // Standard page
        category = row.find('a.releases_category_text').text().split(/\s*>\s*/)[0];
        catSrc = 'row';
      } else if (/^\/geekseek.php\?movieid=/.test(pathSearch)) {
        $('tr.details').each((i, el) => {
          const text = $(el).text().replace(/\s/g, '');
          const match = text.match(/Category:(.*)/i);
          if (match) {
            category = match[1].split('>')[0];
            catSrc = 'detail';
          }
        })
      }

      let opts:CreateAddLinkOptions = { url: a.attr('href'), category };

      if (this.replace) {
        PageUtil.bindAddUrl(opts, a, true);
      } else {
        let link:JQuery<HTMLElement> = PageUtil.createAddUrlButton(opts)
          .on('nzb.success', (e) => {
            link.closest('tr').find('a[href*="details"]').first()
              .prepend('<img src="pics/downloaded.png" class="hastip" title="" style="width:13px;margin-right:.25em;" border="0">');
          })
          .insertAfter(a);
      }
    });
  }
}

$(($) => {
  let nzbIntegration = new NZBUnityNzbgeek();
});
