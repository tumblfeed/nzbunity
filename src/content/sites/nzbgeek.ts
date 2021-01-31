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
      let row:JQuery<HTMLElement> = a.closest('tr[id^="guid"]');

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';
      let pathSearch:string = window.location.pathname + window.location.search;

      // TODO: Category fetch disabled until it can be confirmed
      // if (row.find('a[href*="geekseek.php?c="]').length) {
      //   // Standard page
      //   category = row.find('a[href*="geekseek.php?c="]').text().split(/\s*>\s*/)[0];
      //   catSrc = 'row';
      // } else if (pathSearch.match(/^\/geekseek.php\?c=/)) {
      //   // Category search
      //   let match:string[] = $('center > font[size="4"] > b').text().match(/your seek returned [\d,]+ ([^,]+)/i);
      //   if (match) {
      //     category = match[1];
      //     catSrc = 'header'
      //   }
      // }

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
