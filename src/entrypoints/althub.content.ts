import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

export default defineContentScript({
  matches: ['*://*.althub.co.za/*'],

  main(ctx) {
    new AlthubContent(ctx);
  },
});

class AlthubContent extends Content {
  get id() {
    return 'althub';
  }

  get uid(): string {
    const [, uid] =
      document
        .querySelector('head link[href^="/rss"]')
        ?.getAttribute('href')
        ?.match(/i=([0-9]+)/) ?? [];
    return uid ?? '';
  }

  get apikey(): string {
    const [, apikey] =
      document
        .querySelector('head link[href^="/rss"]')
        ?.getAttribute('href')
        ?.match(/r=([a-z0-9]+)/) ?? [];
    return apikey ?? '';
  }

  getNzbUrl(id: string): string {
    return `https://api.althub.co.za/getnzb/${id}?i=${this.uid}&r=${this.apikey}`;
  }

  async ready() {
    // warn on missing parms
    this.debug(`[NZB Unity] ready()`, { uid: this.uid, apikey: this.apikey });
    if (!this.uid) console.warn(`[NZB Unity] Unable to find username`);
    if (!this.apikey) console.warn(`[NZB Unity] Unable to find apikey`);
  }

  initializeLinks = () => {
    // Create direct download links on individual items
    for (const el of document.querySelectorAll('a[href^="/getnzb/"]')) {
      const a = el as HTMLAnchorElement;
      const [, id] = a.getAttribute('href')?.match(/\/getnzb\/(\w+)/i) ?? [];
      if (!id) continue;

      const url = this.getNzbUrl(id);
      let category = '';

      if (window.location.pathname.startsWith('/details')) {
        // Detail page
        category = this.extractCategory(document.querySelector('a[href^="/browse?t="]'));

        if (this.replaceLinks) {
          this.bindAddUrl(a, url, category, true);
        } else {
          const link = this.createAddUrlButton({
            url,
            category,
            buttonOptions: {
              styles: { margin: '0' },
            },
          });
          a.parentElement?.append(link);
        }
      } else {
        // List page
        category = this.extractCategory(
          a.closest('div.row')?.querySelector('a[href^="/browse"]'),
        );

        if (this.replaceLinks) {
          this.bindAddUrl(a, url, category, true);
        } else {
          const link = this.createAddUrlLink({
            url,
            category,
            linkOptions: {
              styles: {
                position: 'absolute',
                right: '-5px',
                top: '0',
              },
            },
          });
          a.parentElement?.prepend(link);
        }
      }
    }

    // Create download all buttons
    for (const el of document.querySelectorAll('.nzb_multi_operations_download')) {
      const button = this.createButton({
        styles: { margin: '0 0.5em' },
      });
      button.addEventListener('click', async (e) => {
        e.preventDefault();

        this.addUrlsFromElementsAndNotify(
          button,
          // Get the checked checkboxes
          document.querySelectorAll('#nzb_multi_operations_form .nzb_check:checked'),
          // Get the ID from each checkbox
          (el) => (el as HTMLInputElement).value,
          // Get the category from each checkbox
          (el) =>
            this.extractCategory(
              el.closest('div.row')?.querySelector('a[href^="/browse"]'),
            ),
        );
      });

      const div = document.createElement('div');
      div.style.display = 'inline-block';
      div.style.verticalAlign = 'middle';
      div.append(button);

      el.closest('.nzb_multi_operations')?.prepend(div);
    }
  };
}
