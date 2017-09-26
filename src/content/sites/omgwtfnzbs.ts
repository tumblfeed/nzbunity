class NZBUnityOmgwtfnzbs {

  public username:string;
  public apikey:string;
  public apiurl:string;
  public wrapper:JQuery<HTMLElement>;

  constructor() {
    console.info(`[NZB Unity] Initializing 1-click functionality...`);

    this.username = this.getUsername();
    this.apiurl = `${window.location.protocol}//api.omgwtfnzbs.me/nzb/`;
    this.wrapper = $('#wrapper');

    this.getApiKey()
      .then((apikey) => {
        this.apikey = apikey;

        if (this.isValid) {
          console.info(`Got username and api key: ${this.username}, ${this.apikey}`);
        } else {
          console.warn('Could not get API key');
        }

        let btn = $('<button>Do Something</button>')
          .on('click', (e) => {
            console.log('Button Clicked');
          })
          .appendTo(this.wrapper);

        this.initializeLinks();
      });
  }

  isValid():boolean {
    return Boolean(this.username && this.apikey);
  }

  getUsername():string {
    return $('a[href="/account"]')[0].innerText;
  }

  getApiKey():Promise<string> {
    return PageUtil.request({ url: '/account', params: { action: 'api' } })
      .then((r) => {
        let el = $(r).find('[color="orange"]');
        return el.length ? el[0].innerText : null
      })
  }

  getNzbUrl(id:string):string {
    return `${this.apiurl}?user=${this.username}&api=${this.apikey}&id=${id}`;
  }

  initializeLinks() {
    $('a[href^="/send?"]').each((i, el) => {
      let a:JQuery<HTMLElement> = $(el);

      let idMatch:string[] = a.attr('href').match(/id=(\w+)/i);
      let id:string = idMatch && idMatch[1];

      // Get the category
      let category:string = '';
      let catSrc:string = 'default';

      if ($('#category').length) {
        // Short circuit if there is a category element (usually the details page)
        category = $('#category').text();
        catSrc = '#';
      } else if (window.location.pathname.match(/^\/trends/)) {
        // Trends page
        category = a.closest('li,tr').find('.bmtip.cat_class').text();
        catSrc = 'trends';
      } else {
        // Everything else (usually the browse page)
        // category = a.closest('li,tr').find('[href^="/browse?cat"] span').html().replace('<br>', ':');
        category = a.closest('li,tr').find('[href^="/browse?cat"]').text();
        catSrc = 'href';
      }

      let split:string[] = category.split(/[^\w-]/); // Either "Movies: HD" or "Movies HD"
      category = split.length ? split[0] : category;

      let link:JQuery<HTMLElement> = PageUtil.createAddUrlLink({
        url: this.getNzbUrl(id),
        category: category
      }, el)
        .css({ margin: '0 .25em 0 .75em' });
    });
  }
}

let omgwtfnzbs = new NZBUnityOmgwtfnzbs();




