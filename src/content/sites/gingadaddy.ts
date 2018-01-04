class NZBUnityGingadaddy {
  constructor() {
    console.info(`[NZB Unity] Initializing Gingadaddy 1-click functionality...`);
    // this.initializeLinks();
  }

  getNzbUrl(id:string):string {
    return `https://www.gingadaddy.com/nzbgingadownload.php?id=${id}&t=dlnzb`;
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
        .css({ float: 'left', margin: '0 0 0 20px' })
        .prependTo(a.closest('[id^=row]').find('[class^="pstrow"]:last'));
    });
  }

}

$(($) => {
  let nzbIntegration = new NZBUnityGingadaddy();
});

undefined;