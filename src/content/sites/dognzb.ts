class NZBUnityDognzb {
  public username:string;
  public observer:MutationObserver;
  public replace:boolean = false;

  constructor() {
    Util.storage.get(['Providers', 'ReplaceLinks'])
      .then((opts) => {
        this.replace = opts.ReplaceLinks;
        let provider = opts.Providers && opts.Providers.dognzb;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);
          this.username = this.getUsername();

          // dognzb uses an ajax filter, watch for dom changes.
          this.observer = new MutationObserver((mutations) => {
            console.info(`[NZB Unity] Content changed, updating links...`);
            this.initializeLinks();
          });
          this.observer.observe(document.getElementById('content'), { childList: true });

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
    return `${window.location.origin}/fetch/${id}/${rsstoken}`;
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

        let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
          url: this.getNzbUrl(id),
          category: category
        })
          .on('nzb.success', (e) => {
            catLabel.closest('tr')
              .prepend('<td width="19"><div class="dog-icon-tick"></div></td>');
          });

        console.warn(this.replace);

        if (this.replace) {
          a.closest('td').attr('width', '20');
          a.replaceWith(link);
        } else {
          a.closest('td').attr('width', '36');
          a.css({ float: 'left' });
          link.insertAfter(a);
        }
      });

      // Create download all buttons
      $('[onclick^="doZipDownload"]').each((i, el) => {
        let getNzbUrl = (id:string) => { return this.getNzbUrl(id); };
        let button:JQuery<HTMLElement> = PageUtil.createButton()
          .css({ 'margin': '0 0.3em 0 0' })
          .on('click', (e) => {
            e.preventDefault();

            let checked:JQuery<HTMLElement> = $('#featurebox .ckbox:checked');
            if (checked.length) {
              console.info(`[NZB Unity] Adding ${checked.length} NZB(s)`);
              button.trigger('nzb.pending');

              Promise.all(checked.map((i, el) => {
                let check = $(el);
                let idMatch:string[] = check.closest('tr')
                  .find('[onclick^="doOneDownload"]').attr('onclick').match(/\('(\w+)'\)/i);
                let id = idMatch && idMatch[1];

                if (/[a-d0-9]+/.test(id)) {
                  // Get the category
                  let catLabel:JQuery<HTMLElement> = check.closest('tr')
                    .find('.label').not('.label-empty').not('.label-important');
                  let category:string = catLabel.text();
                  let catSrc:string = 'default';

                  let options = {
                    url: getNzbUrl(id),
                    category: category
                  };

                  console.info(`[NZB Unity] Adding URL`, options);
                  return Util.sendMessage({ 'content.addUrl': options });
                } else {
                  return Promise.resolve();
                }
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

    } else if (window.location.pathname.startsWith('/details')) {
      let id:string = window.location.pathname.match(/\/details\/(\w+)/i)[1];

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';
      let catLabel:JQuery<HTMLElement> = $('#details tr:nth-child(3) td:nth-child(2)');

      if (catLabel.length) {
        category = catLabel.text().split(/\s*->\s*/)[0];
      }

      let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
        url: this.getNzbUrl(id),
        category: category
      });

      if (this.replace) {
        $('[onclick^="doOneDownload"]').replaceWith(link);
        link.css({ padding: '0 0 0 5px' });
        link.append('download');
      } else {
        link.appendTo($('#preview .btn-group').closest('tr').find('td:first-child'));
      }
    }
  }
}

$(($) => {
  let nzbIntegration = new NZBUnityDognzb();
});
