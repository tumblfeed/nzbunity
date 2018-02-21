class NZBUnityNewznab {
  public uid:string;
  public apikey:string;
  public apiurl:string;
  public replace:boolean = false;

  constructor() {
    Util.storage.get(['ReplaceLinks'])
      .then((opts) => {
        this.replace = opts.ReplaceLinks;
        this.uid = $('[name="UID"]').attr('value');
        this.apikey = $('[name="RSSTOKEN"]').attr('value');
        this.apiurl = `${window.location.origin}/api`;

        // Site specific api urls
        if (/newz-complex\.org/i.test(window.location.host)) {
          this.apiurl = `${window.location.origin}/www/api`;
        }
        if (/usenet-crawler\.com/i.test(window.location.host)) {
          this.apiurl = `${window.location.protocol}//api.usenet-crawler.com`;
        }

        console.info(`[NZB Unity] Initializing Newznab 1-click functionality...`);
        console.info(this.apiurl, this.uid, this.apikey);

        if (this.uid && this.apikey) {
          this.initializeLinks();
        } else {
          console.error('[NZB Unity] Could not get UID or API key');
        }
      });
  }

  getNzbUrl(guid:string):string {
    return `${this.apiurl}?t=get&i=${this.uid}&apikey=${this.apikey}&guid=${guid}&id=${guid}`;
  }

  initializeLinks() {
    // Create direct download links on individual items
    $('a[href^="/getnzb/"]').each((i, el) => {
      let a:JQuery<HTMLElement> = $(el);
      let guidMatch:string[] = a.attr('href').match(/\/getnzb\/(\w+)/i);
      let id:string = guidMatch && guidMatch[1];

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';

      if (a.closest('tr').find('[href^="/browse?t"]').length) {
        category = a.closest('tr').find('[href^="/browse?t"]').attr('title').replace(/^Browse /, '');
        catSrc = 'href';
      }

      let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
      category = split.length ? split[0] : category;

      let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
        url: this.getNzbUrl(id),
        category: category
      });

      if (this.replace) {
        a.replaceWith(link);
      } else {
        link.css({ margin: '0 .2em 0 .5em' });
        link.appendTo(a.closest('td'));
      }
    });

    // Create download all buttons
    $('.nzb_multi_operations_download').each((i, el) => {
      let getNzbUrl = (id:string) => { return this.getNzbUrl(id); };
      let button:JQuery<HTMLElement> = PageUtil.createButton()
        .on('click', (e) => {
          e.preventDefault();

          let checked:JQuery<HTMLElement> = $('#browsetable .nzb_check:checked');
          if (checked.length) {
            console.info(`[NZB Unity] Adding ${checked.length} NZB(s)`);
            button.trigger('nzb.pending');

            checked.each(function(i, el) {
              let check = $(el);
              let id = <string> check.val();

              if (/[a-d0-9]+/.test(id)) {
                // Get the category
                let category:string = '';
                let catSrc:string = 'default';

                if (check.closest('tr').find('[href^="/browse?t"]').length) {
                  category = check.closest('tr').find('[href^="/browse?t"]').attr('title').replace(/^Browse /, '');
                  catSrc = 'href';
                }

                let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
                category = split.length ? split[0] : category;

                let options = {
                  url: getNzbUrl(id),
                  category: category
                };

                console.info(`[NZB Unity] Adding URL`, options);
                Util.sendMessage({ 'content.addUrl': options });
              }
            });
          }
        });

      if ($(el).parent().hasClass('btn-group')) {
        button.css({ 'margin': '0.2em' });
        button.insertBefore($(el).parent());
      } else {
        button.insertBefore($(el));
      }
    });
  }

}

$(($) => {
  let nzbIntegration = new NZBUnityNewznab();
});

undefined;