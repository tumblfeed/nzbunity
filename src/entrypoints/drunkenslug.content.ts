import { defineContentScript } from 'wxt/sandbox';
import { Content, request } from '~/Content';

export default defineContentScript({
  matches: ['*://*.drunkenslug.com/*'],

  main(ctx) {
    new DrunkenSlugContent(ctx);
  },
});

class DrunkenSlugContent extends Content {
  get id() {
    return 'drunkenslug';
  }

  profileContent: string = '';

  get isDetail(): boolean {
    return false;
  }

  get isList(): boolean {
    return false;
  }

  getNzbUrl(id: string): string {
    return `${window.location.origin}/getnzb/${id}?i=${this.uid}&r=${this.apikey}`;
  }

  async ready() {
    this.profileContent = (await request({ url: '/profile' })) as string;
    if (!this.profileContent) {
      console.warn(`[NZB Unity] Unable to load profile page`);
      return false;
    }

    [, , this._uid] = this.profileContent.match(/\/rss\?.*(i=([0-9]+))/i) || [];
    [, , this._apikey] = this.profileContent.match(/\/rss\?.*(r=([a-z0-9]+))/i) || [];

    // warn on missing parms
    this.debug(`[NZB Unity] ready()`, { uid: this.uid, apikey: this.apikey });
    if (!this.uid) console.warn(`[NZB Unity] Unable to find username`);
    if (!this.apikey) console.warn(`[NZB Unity] Unable to find apikey`);
  }

  initializeLinks = () => {
    // Create direct download links on individual items
    for (const el of document.querySelectorAll('a[href^="/getnzb/"]')) {
      const a = el as HTMLAnchorElement;

      const [, id] = a.href.match(/\/getnzb\/(\w+)/i) || [, ''];
      const url = this.getNzbUrl(id);

      // Get the category
      let category: string = '';

      if (window.location.pathname.startsWith('/details')) {
        category = this.extractCategory('dd a[href^="/browse?t="]');
      } else {
        category = this.extractCategory(
          a.closest('tr')?.querySelector('a[href^="/browse?t="]'),
        );
      }

      if (this.replaceLinks) {
        this.bindAddUrl(a, url, category, true);
      } else {
        const link = this.createAddUrlLink({
          url,
          category,
          linkOptions: {
            styles: {
              margin: '0 0.5em 0 0',
            },
          },
        });

        a.insertAdjacentElement('beforebegin', link);
      }
    }

    // Create download all buttons
    for (const el of document.querySelectorAll('.nzb_multi_operations_download')) {
      const button = this.createButton({
        styles: {
          margin: '0 0.5em 0 0',
          padding: '6px 8px 6px 26px',
        },
      });

      button.addEventListener('click', async (e) => {
        e.preventDefault();
        this.addUrlsFromElementsAndNotify(
          button,
          // Get all the checked checkboxes
          document.querySelectorAll('#nzb_multi_operations_form .nzb_check:checked'),
          // Get the ID from each checkbox
          (el) => (el as HTMLInputElement).value,
          // Get the category from each checkbox
          (el) => {
            return (
              (el as HTMLInputElement)
                .closest('tr')
                ?.querySelector('a[href^="/browse?t="]')
                ?.textContent?.trim() ?? ''
            );
          },
        );
      });

      el.insertAdjacentElement('beforebegin', button);
    }
  };
}
