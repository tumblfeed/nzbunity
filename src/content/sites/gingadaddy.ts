class NZBUnityGingadaddy {
  public uid:string;
  public apikey:string;
  public replace:boolean = false;

  constructor() {
    Util.storage.get(['Providers', 'ReplaceLinks'])
      .then((opts) => {
        this.replace = opts.ReplaceLinks;
        let provider = opts.Providers && opts.Providers.gingadaddy;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);

          this.uid = this.getUid();

          this.getApiKey()
            .then((apikey) => {
              this.apikey = apikey;

              if (this.uid && this.apikey) {
                console.info(`Got uid and api key: ${this.uid}, ${this.apikey}`);
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

  getUid():string {
    const [match, uid] = $('#accblck a[href*="userdetails.php?id="]').prop('href').match(/id=(\d+)/);
    return uid;
  }

  getApiKey():Promise<string> {
    return PageUtil.request({ url: `/userdetails.php?id=${this.uid}` })
      .then((r) => {
        const [match, apikey] = r.match(/API KEY<\/td>\s*<td><b>(.*)<\/b>/mi);
        return apikey?.trim();
      })
  }

  getNzbUrl(id:string):string {
    return `${window.location.origin}/gingasrssdownload.php?h=${id}&i=${this.apikey}&uid=${this.uid}&t=dlnzb`;
  }

  initializeLinks() {
    // Create direct download links on individual items
    $('.dlnzb a').each((i, el) => {
      let a:JQuery<HTMLElement> = $(el);
      let idMatch:string[] = a.attr('href').match(/id=(\d+)/i);
      let id:string = idMatch && idMatch[1];

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';

      if (a.closest('[id^=row]').find('a.catimg').length) {
        category = a.closest('[id^=row]').find('a.catimg').attr('title').replace(/^Show all in: /, '');
        catSrc = 'href';
      }

      let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
      category = split.length ? split[0] : category;

      let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
        url: this.getNzbUrl(id),
        category: category
      })
        .prop('title', 'Download with NZB Unity (VIP ONLY)')
        .css({ float: 'left', margin: '0 0 0 20px' })
        .prependTo(a.closest('[id^=row]').find('[class^="pstrow"]:last'));
    });
  }
}

$(($) => {
  let nzbIntegration = new NZBUnityGingadaddy();
});

undefined;