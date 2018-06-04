class NZBUnityNzbserver {
  public apiurl:string;
  public replace:boolean = false;

  constructor() {
    Util.storage.get(['Providers', 'ReplaceLinks'])
      .then((opts) => {
        this.replace = opts.ReplaceLinks;
        let provider = opts.Providers && opts.Providers.nzbserver;
        let enabled:boolean = provider ? provider.Enabled : true;

        if (enabled) {
          console.info(`[NZB Unity] Initializing 1-click functionality...`);

          this.apiurl = `${window.location.protocol}//www.nzbserver.com/`;

          this.initializeLinks();
        } else {
          console.info(`[NZB Unity] 1-click functionality disabled for this site`);
        }
      });
  }

  getNzbUrl(id:string):string {
    return `${this.apiurl}?page=getnzb&action=display&messageid=${id}`;
  }

  initializeLinks() {
    $('a.NZBUnityLink').remove();

    // Create direct download links
    // I'm not a huge fan of matching against the download icon, but it works for this site without hitting multiple links in the same row.
    $('#spots a.nzb').each((i, el) => {
      let a:JQuery<HTMLElement> = $(el);
      let idMatch:string[] = a.attr('href').match(/messageid=([\w%.]+)/i);
      let id:string = idMatch && idMatch[1];

      // Get the category
      let category:string = '';
      let cats:any = a.closest('li,tr').find('a[data-cats]').data('cats');

      if (cats && cats.Type) {
        category = cats.Type;
      }

      let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
        url: this.getNzbUrl(id),
        category: category
      })
        .css({ margin: '0 5px' });

      if (this.replace) {
        a.replaceWith(link);
      } else {
        link.insertAfter(a);
      }
    });

    $('#details a.nzbbutton').each((i, el) => {
      let a:JQuery<HTMLElement> = $(el);
      let idMatch:string[] = a.attr('href').match(/messageid=([\w%.]+)/i);
      let id:string = idMatch && idMatch[1];

      // Get the category
      let category:string = a
        .closest('table')
        .find('th')
        .filter((i, el) => { return $(el).text() === ' Type'; })
        .closest('tr')
        .find('a')
        .text()

      let link:JQuery<HTMLElement> = PageUtil.createAddUrlButton({
        url: this.getNzbUrl(id),
        category: category
      })
        .text('Download with NZB Unity')
        .css({
          'font-size': '14px',
          'height': '28px',
          'margin': '0 5px 1px'
        });

      if (this.replace) {
        a.replaceWith(link);
      } else {
        link.insertAfter(a);
      }
    });

    // Create download all buttons
    $('a[title="MultiNZB"').each((i, el) => {
      let getNzbUrl = (id:string) => this.getNzbUrl(id);
      let button:JQuery<HTMLElement> = PageUtil.createButton()
        .css({
          'border': 'none',
          'border-radius': '0',
          'margin': '0'
        })
        .on('click', (e) => {
          e.preventDefault();

          let checked:JQuery<HTMLElement> = $('#spots input[type="checkbox"]:checked');
          if (checked.length) {
            console.info(`[NZB Unity] Adding ${checked.length} NZB(s)`);
            button.trigger('nzb.pending');

            Promise.all(checked.map((i, el) => {
              let check = $(el);
              let id = <string> check.val();

              // Get the category
              let category:string = '';
              let cats:any = check.closest('li,tr').find('a[data-cats]').data('cats');

              if (cats && cats.Type) {
                category = cats.Type;
              }

              let options = {
                url: getNzbUrl(id),
                category: category
              };

              console.info(`[NZB Unity] Adding URL`, options);
              return Util.sendMessage({ 'content.addUrl': options });
            }))
              .then((results:any[]) => {
                setTimeout(() => {
                  if (results.some(r => r === false)) {
                    button.trigger('nzb.failure');
                  } else {
                    button.trigger('nzb.success');
                  }
                }, 1000);
              });
          }
        });

      if (this.replace) {
        $(el).replaceWith(button);
      } else {
        button.insertAfter($(el));
      }
    });


  }
}

$(($) => {
  let nzbIntegration = new NZBUnityNzbserver();
});
