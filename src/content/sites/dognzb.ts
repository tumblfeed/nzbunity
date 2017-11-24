class NZBUnityDognzb {
  public username:string;

  constructor() {
    Util.storage.get('Providers')
      .then((opts) => {
        let provider = opts.Providers && opts.Providers.dognzb;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);

          this.username = this.getUsername();
          this.initializeLinks();
        } else {
          console.info(`[NZB Unity] 1-click functionality disabled for this site`);
        }
      });
  }

  getUsername():string {
    return $('#label').text().trim();
  }

  getNzbUrl(id:string):string {
    let rsstoken:string = <string> $('input[name="rsstoken"]').val();
    return `${window.location.protocol}//${window.location.host}/fetch/${id}/${rsstoken}`;
  }

  initializeLinks() {
    // Any page with a table of downloads (browse, search)
    if ($('tr[id^="row"]').length) {
      $('[onclick^="doOneDownload"]').each((i, el) => {
        let a:JQuery<HTMLElement> = $(el);
        let idMatch:string[] = a.attr('onclick').match(/\('(\w+)'\)/i);
        let id:string = idMatch && idMatch[1];

        // Get the category
        let catLabel:JQuery<HTMLElement> = a.closest('tr')
          .find('.label').not('.label-empty').not('.label-important');
        let category:string = catLabel.text();
        let catSrc:string = 'default';

        a.closest('td').attr('width', '36');
        a.css({ float: 'left' })

        let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
          url: this.getNzbUrl(id),
          category: category
        }, el)
          .on('addUrl.success', (e) => {
            catLabel.closest('tr')
              .prepend('<td width="19"><div class="dog-icon-tick"></div></td>');
          });
      });

    } else if (window.location.pathname.startsWith('/details')) {
      let id:string = window.location.pathname.match(/\/details\/(\w+)/i)[1];

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';
      let catLabel:JQuery<HTMLElement> = $('#details tr:nth-child(3) td:nth-child(2)');

      if (catLabel.length) {
        category = catLabel.text().split(/\s*->\s*/)[0];
      }

      // a.closest('td').attr('width', '36');
      // a.css({ float: 'left' })

      let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
        url: this.getNzbUrl(id),
        category: category
      })
        .appendTo($('#preview .btn-group').closest('tr').find('td:first-child'));
      }
  }
}

$(($) => {
  let dognzb = new NZBUnityDognzb();
});
