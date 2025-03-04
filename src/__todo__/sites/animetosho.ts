class NZBUnityAnimeTosho {
  constructor() {
    Util.storage.get('Providers')
      .then((opts) => {
        const provider = opts.Providers && opts.Providers.animetosho;
        const enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);
          this.initializeLinks();
        } else {
          console.info(`[NZB Unity] 1-click functionality disabled for this site`);
        }
      });
  }

  initializeLinks() {
    $('a[href*="/nzbs/"]').each((i, el) => {
      const a = $(el);
      console.log(decodeURIComponent(a.attr('href')).replace(/\.gz$/, ''));
      PageUtil.createAddUrlLink({
        url: decodeURIComponent(a.attr('href')).replace(/\.gz$/, ''),
      })
        .css({ margin: '0 0 0 3px', 'vertical-align': 'middle' })
        .insertAfter(a);
    });
  }
}

$(($) => {
  const nzbIntegration = new NZBUnityAnimeTosho();
});
