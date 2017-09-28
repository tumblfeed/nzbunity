class NZBUnityNzbgeek {
  constructor() {
    Util.storage.get('Providers')
      .then((opts) => {
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
    // I'm not a huge fan of matching against the download icon, but it works for this site without hitting multiple links in the same row.
    $('img[src$="download.png"]').closest('a[href*="getnzb"]').each((i, el) => {
      let a:JQuery<HTMLElement> = $(el);
      let row:JQuery<HTMLElement> = a.closest('tr[id^="guid"]');

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';
      let pathSearch:string = window.location.pathname + window.location.search;

      if (row.find('a[href*="geekseek.php?c="]').length) {
        // Standard page
        category = row.find('a[href*="geekseek.php?c="]').text().split(/\s*>\s*/)[0];
        catSrc = 'row';
      } else if (pathSearch.match(/^\/geekseek.php\?c=/)) {
        // Category search
        let match:string[] = $('center > font[size="4"] > b').text().match(/your seek returned [\d,]+ ([^,]+)/i);
        if (match) {
          category = match[1];
          catSrc = 'header'
        }
      }

      let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
        url: a.attr('href'),
        category: category
      }, el)
        .css({  })
        .on('addUrl.success', (e) => {
          link.closest('tr').find('a[href*="details"]').first()
            .prepend('<img src="pics/downloaded.png" class="hastip" title="" style="width:13px;margin-right:.25em;" border="0">');
        });
    });
  }
}

let nzbgeek = new NZBUnityNzbgeek();
