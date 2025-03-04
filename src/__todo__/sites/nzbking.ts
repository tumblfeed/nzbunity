class NZBUnityNzbking {
  constructor() {
    Util.storage.get('Providers')
      .then((opts) => {
        const provider = opts.Providers && opts.Providers.nzbking;
        const enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);
          this.initializeLinks();
        } else {
          console.info(`[NZB Unity] 1-click functionality disabled for this site`);
        }
      });
  }

  getCsrfToken():string {
    return String($('input[name="csrfmiddlewaretoken"]').val());
  }

  getNzbUrl(id:string):string {
    return `${window.location.origin}/nzb:${id}/`;
  }

  initializeLinks() {
    $('a[href^="/nzb:"]').each((i, el) => {
      const a = $(el);
      PageUtil.createAddUrlLink({
        url: `${window.location.origin}${a.attr('href')}`,
        // category: category
      })
        .css({ margin: '0 5px 0 0', 'vertical-align': 'middle' })
        .insertBefore(a);
    });
  }
}

$(($) => {
  const nzbIntegration = new NZBUnityNzbking();
});
