import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';
import { getQueryParam } from '~/utils';

export default defineContentScript({
  matches: ['*://*.omgwtfnzbs.org/*'],

  main(ctx) {
    new OmgwtfnzbsContent(ctx);
  },
});

class OmgwtfnzbsContent extends Content {
  get uid(): string {
    // Username is in an html comment that looks like:
    // <!---<extention_user>somebody</extention_user>-->
    const [, uid] =
      document.body.innerHTML.match(/<extention_user>(.*?)<\/extention_user>/) ?? [];
    return uid?.trim() ?? '';
  }

  get apikey(): string {
    // API key is in an html comment that looks like:
    // <!---<extention_api>deadbeefcafe1234</extention_api>-->
    const [, apikey] =
      document.body.innerHTML.match(/<extention_api>(.*?)<\/extention_api>/) ?? [];
    return apikey?.trim() ?? '';
  }

  getNzbUrl(id: string): string {
    return `${window.location.protocol}//api.omgwtfnzbs.org/nzb/?user=${this.uid}&api=${this.apikey}&id=${id}`;
  }

  async ready() {
    // warn on missing parms
    this.debug(`[NZB Unity] ready()`, { uid: this.uid, apikey: this.apikey });
    if (!this.uid) console.warn(`[NZB Unity] Unable to find username`);
    if (!this.apikey) console.warn(`[NZB Unity] Unable to find apikey`);
  }

  initializeLinks = () => {
    this.debug(`[NZB Unity] initializeLinks()`);

    // Create direct download links (works for detail page as well)
    // I'm not a huge fan of matching against the download icon, but it works for this site without hitting multiple links in the same row.
    for (const el of document.querySelectorAll('img[src*="pics/dload"]')) {
      const a = el.closest('a[href*="send?"]') as HTMLAnchorElement;
      const [, id] = a.href.match(/id=(\w+)/i) ?? [];
      if (!id) continue;

      // Get the category
      let category: string = '';

      if (document.getElementById('category')) {
        // Short circuit if there is a category element (usually the details page)
        category = document.getElementById('category')?.textContent ?? '';
      } else if (window.location.pathname.match(/^\/trends/)) {
        // Trends page
        category =
          a.closest('li,tr')?.querySelector('.bmtip.cat_class')?.textContent ?? '';
      } else {
        // Everything else (usually the browse page)
        category =
          a.closest('li,tr')?.querySelector('[href^="/browse?cat"]')?.textContent ?? '';
      }

      // Either "Movies: HD" or "Movies HD", take the first word
      [, category] = category.match(/^(\w+)/) ?? [];

      const link = this.createAddUrlLink({
        url: this.getNzbUrl(id),
        category,
        linkOptions: {
          styles: { margin: '0 5px' },
        },
      });

      link.addEventListener('nzb.success', (e) => {
        link
          .closest('tr')
          ?.querySelector('a[href*="details"]')
          ?.insertAdjacentHTML(
            'afterbegin',
            '<img src="pics/downloaded.png" class="hastip" title="" style="width:13px;margin-right:.25em;" border="0">',
          );
      });

      if (this.replaceLinks) {
        a.replaceWith(link);
      } else {
        a.insertAdjacentElement('afterend', link);
      }
    }

    // Create download all buttons (uase of # in selector is not a mistake)
    for (const el of document.querySelectorAll('#browseDLButton')) {
      const button = this.createButton({
        styles: { padding: '6px 6px 6px 26px' },
      });

      button.addEventListener('click', async (e) => {
        e.preventDefault();

        const checked = document.querySelectorAll('.nzbt_row .checkbox:checked');
        if (checked.length) {
          console.info(`[NZB Unity] Adding ${checked.length} NZB(s)`);
          button.dispatchEvent(new Event('nzb.pending'));

          const results = await Promise.all(
            Array.from(checked).map((el) => {
              const check = el as HTMLInputElement;
              const id = check.value;
              if (!id) return false;

              // Get the category
              let category =
                check.closest('li,tr')?.querySelector('[href^="/browse?cat"]')
                  ?.textContent ?? '';

              // Either "Movies: HD" or "Movies HD", take the first word
              [, category] = category.match(/^(\w+)/) ?? [];

              let options = {
                url: this.getNzbUrl(id),
                category,
              };

              console.info(`[NZB Unity] Adding URL`, options);
              return this.client.addUrl(this.getNzbUrl(id), { category });
            }),
          );

          if (results.every((r) => r)) {
            button.dispatchEvent(new Event('nzb.success'));
          } else {
            button.dispatchEvent(new Event('nzb.failure'));
          }
        }
      });

      el.insertAdjacentElement('beforebegin', button);
    }

    // Add dates to rows for convenience
    if (getQueryParam('view', 'list') === 'list') {
      for (const el of document.querySelectorAll('.nzbt_row > [data-sort]:last-child')) {
        let date = (el as HTMLElement).dataset.sort;
        if (date) {
          date = new Date(Number(date) * 1000).toDateString();

          const [dName, mm, dd, yy] = date.split(' ');
          const isCurYear = `${new Date().getFullYear()}` === yy;
          const container = el.querySelector('span');
          if (!container) continue;

          container.style.fontSize = '0.9em';
          container.textContent = `${mm} ${dd} ${isCurYear ? '' : yy} (${
            container.textContent
          })`;
        }
      }
    }
  };
}
