class NZBUnityNewznab {
  public uid:string;
  public apikey:string;
  public apiurl:string;

  constructor() {
    console.info(`[NZB Unity] Initializing Newznab 1-click functionality...`);
    console.info('asdgasdfasd');
    this.uid = String($('[name="UID"]').val());
    console.info('asdgasdfasd');
    this.apikey = String($('[name="RSSTOKEN"]').val());
    console.info('asdgasdfasd');
    this.apiurl = `${window.location.protocol}//${window.location.host}/api`;
    console.info('asdgasdfasd');
    console.info(this.apiurl, this.uid, this.apikey);

    this.initializeLinks();

  }

  getNzbUrl(guid:string):string {
    return `${this.apiurl}?t=get&i=${this.uid}&api=${this.apikey}&guid=${guid}`;
  }

  initializeLinks() {
    // Create direct download links
    // I'm not a huge fan of matching against the download icon, but it works for this site without hitting multiple links in the same row.
    $('a[href^="/getnzb/"]').each((i, el) => {
      let a:JQuery<HTMLElement> = $(el);
      let guidMatch:string[] = a.attr('href').match(/\/getnzb\/(\w+)\//i);
      let guid:string = guidMatch && guidMatch[1];

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';

      if ($('#category').length) {
        // Short circuit if there is a category element (usually the details page)
        category = $('#category').text();
        catSrc = '#';
      } else {
        // Everything else (usually the browse page)
        category = a.closest('tr').find('[href^="/browse?t"]').attr('title').replace(/^Browse /, '');
        catSrc = 'href';
      }

      let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
      category = split.length ? split[0] : category;

      let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
        url: this.getNzbUrl(guid),
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

let newznab = new NZBUnityNewznab();
