class NZBUnityNewznab {
  public uid:string;
  public apikey:string;
  public apiurl:string;

  constructor() {
    console.info(`[NZB Unity] Initializing Newznab 1-click functionality...`);
    this.uid = $('[name="UID"]').attr('value');
    this.apikey = $('[name="RSSTOKEN"]').attr('value');
    this.apiurl = `${window.location.protocol}//${window.location.host}/api`;
    console.info(this.apiurl, this.uid, this.apikey);

    if (this.uid && this.apikey) {
      this.initializeLinks();
    } else {
      console.error('[NZB Unity] Could not get UID or API key');
    }
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

      // If NZB intercept is enabled, just change the download nzb button to work
      Util.storage.get('InterceptDownloads')
        .then((opts) => {
          if (opts.InterceptDownloads) {
            a.attr('href', this.getNzbUrl(id));
          } else {
            // Otherwise give the user a separate NZB Unity link
            // Get the category
            let category:string = '';
            let catSrc:string = 'default';

            if ($('#category').length) {
              // Short circuit if there is a category element (usually the details page)
              category = $('#category').text();
              catSrc = '#';
            } else if (a.closest('tr').find('[href^="/browse?t"]').length) {
              // Everything else (usually the browse page)
              category = a.closest('tr').find('[href^="/browse?t"]').attr('title').replace(/^Browse /, '');
              catSrc = 'href';
            }

            let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
            category = split.length ? split[0] : category;

            let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
              url: this.getNzbUrl(id),
              category: category
            })
              .css({ margin: '0 .2em 0 .5em' })
              .appendTo(a.closest('td'));
          }
        });
    });

    // Create download all buttons
    $('.nzb_multi_operations_download').each((i, el) => {
      let getNzbUrl = (id:string) => { return this.getNzbUrl(id); };
      let button:JQuery<HTMLElement> = $(`<button class="NZBUnityDownloadAll">NZB Unity Download</button>`)
        .css({
          'background': '#17a2b8',
          'border': '1px solid #1599ae',
          'border-radius': '0.3em',
          'color': '#fff',
          'display': 'inline-block',
          'font-size': '.875em',
          'font-weight': 'normal',
          'height': '2em',
          'line-height': '1em',
          'margin': '0 0.2em 0 0',
          'padding': '0.15em 0.4em',
          'text-align': 'center',
          'text-shadow': '0 -1px 0 rgba(0,0,0,0.25)',
          'vertical-align': 'middle',
          'white-space': 'nowrap'
        })
        .on('click', (e) => {
          e.preventDefault();

          $('#browsetable .nzb_check:checked').each(function(i, el) {
            let check = $(el);
            let id = <string> check.val();

            if (/[a-d0-9]+/.test(id)) {
              // Get the category
              let category:string = '';
              let catSrc:string = 'default';

              if ($('#category').length) {
                // Short circuit if there is a category element (usually the details page)
                category = $('#category').text();
                catSrc = '#';
              } else if (check.closest('tr').find('[href^="/browse?t"]').length) {
                // Everything else (usually the browse page)
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
  let newznab = new NZBUnityNewznab();
});

undefined;