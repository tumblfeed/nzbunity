import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

export default defineContentScript({
  matches: ['*://*.abnzb.com/*'],
  main(ctx) {
    new AbnzbContent(ctx);
  },
});

class AbnzbContent extends Content {
  get id() {
    return 'abnzb';
  }

  get uid(): string {
    return document.querySelector('[name="UID" i]')?.getAttribute('value') ?? '';
  }

  get apikey(): string {
    return document.querySelector('[name="RSSTOKEN" i]')?.getAttribute('value') ?? '';
  }

  getNzbUrl(id: string): string {
    return `${window.location.origin}/api?t=get&i=${this.uid}&apikey=${this.apikey}&guid=${id}&id=${id}`;
  }

  getCategory(el: HTMLElement): string {
    let category = '';

    const coverCategoryRe = /^\/(movies)/;
    if (coverCategoryRe.test(window.location.pathname)) {
      // Cover view, category is in the path
      [, category] = window.location.pathname.match(coverCategoryRe) ?? [, ''];
    } else {
      [, category] = el
        .closest('tr')
        ?.querySelector('[href^="/browse?t"]')
        ?.getAttribute('title')
        ?.replace(/^Browse /, '')
        ?.match(/^(\w+)/) ?? [, ''];
    }

    return category;
  }

  async ready() {
    // warn on missing parms
    this.debug(`[NZB Unity] ready()`, { uid: this.uid, apikey: this.apikey });
    if (!this.uid) console.warn(`[NZB Unity] Unable to find username`);
    if (!this.apikey) console.warn(`[NZB Unity] Unable to find apikey`);
  }

  initializeLinks = () => {
    // This is basically a Newznab site, but with some added views.
    // For the most part, just create a button and insert next to the existing button, but use site classes

    // Create direct download links on individual items
    for (const el of document.querySelectorAll('a[href^="/getnzb/"]')) {
      const a = el as HTMLAnchorElement;
      const [, id] = a.href.match(/\/getnzb\/(\w+)/i) ?? [, ''];
      const url = this.getNzbUrl(id);
      const category = this.getCategory(a);

      if (this.replaceLinks) {
        this.bindAddUrl(a, url, category);
      } else {
        // Match dimensions of the original button (it's based on line height and rem, so this is easier)
        const width = Math.min(34, a.offsetWidth + 1);
        let height = a.offsetHeight + 1;
        let marginRight = a.offsetWidth > 34 ? '.3rem' : '.75rem';

        if (window.location.pathname.startsWith('/details/')) {
          height = 31; // Detail page button reports an incorrect height
          marginRight = '.8rem';
        }

        // Create the link using page BS classes
        const link = this.createAddUrlLink({
          url,
          category,
          linkOptions: {
            className: 'NZBUnityIcon btn btn-primary btn-browse ab_btn',
            styles: {
              height: `${height}px`,
              width: `${width}px`,
              marginRight,
            },
          },
        });

        a.insertAdjacentElement('beforebegin', link);
      }
    }

    // Create download all buttons
    for (const el of document.querySelectorAll('.nzb_multi_operations_download')) {
      const button = this.createButton({
        className: 'NZBUnityIcon btn btn-primary btn-browse ab_btn',
        styles: {
          backgroundPositionX: '5px',
          padding: '.3em .5em .3em 26px',
          marginRight: '0.3em',
        },
      });

      button.addEventListener('click', async (e) => {
        e.preventDefault();
        this.addUrlsFromElementsAndNotify(
          button,
          // Get all the checked checkboxes
          document.querySelectorAll('#browsetable .nzb_check:checked'),
          // Get the ID from each checkbox
          (el) => (el as HTMLInputElement).value,
          // Get the category from each checkbox
          (el) => this.getCategory(el as HTMLInputElement),
        );
      });

      el.insertAdjacentElement('beforebegin', button);
    }
  };
}
