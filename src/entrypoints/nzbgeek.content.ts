import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

export default defineContentScript({
  matches: ['*://*.nzbgeek.info/*'],
  main(ctx) {
    new NZBGeekContent(ctx);
  },
});

class NZBGeekContent extends Content {
  get id() {
    return 'nzbgeek';
  }

  initializeLinks = () => {
    // Create direct download links
    for (const el of document.querySelectorAll('a[href*="/api?t=get&id="]:has(i)')) {
      const a = el as HTMLAnchorElement;
      const row = a.closest('tr.releases');

      const url = a.href;

      // Get the category
      let category: string = '';
      const pathSearch: string = window.location.pathname + window.location.search;

      category =
        row
          ?.querySelector('a.releases_category_text')
          ?.textContent?.split(/\s*>\s*/)[0] || '';

      if (!category && /^\/geekseek.php\?movieid=/.test(pathSearch)) {
        for (const el of document.querySelectorAll('tr.details')) {
          const match = el.textContent?.replace(/\s/g, '')?.match(/Category:(.*)/i);
          if (match) {
            category = match[1].split('>')[0];
            break;
          }
        }
      }

      let link: HTMLAnchorElement;

      if (this.replaceLinks) {
        link = a;
        this.bindAddUrl(a, url, category);
      } else {
        link = this.createAddUrlLink({
          url,
          category,
          linkOptions: {
            styles: {
              marginRight: '5px',
            },
          },
        });
        a.insertAdjacentElement('beforebegin', link);
      }

      link.addEventListener('nzb.success', () => {
        const img = document.createElement('img');
        img.src = 'pics/downloaded.png';
        img.className = 'hastip';
        img.style.width = '13px';
        img.style.marginRight = '.25em';

        link.closest('tr')?.querySelector('a[href*="details"]')?.prepend(img);
      });
    }
  };
}
