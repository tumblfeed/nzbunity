import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

export default defineContentScript({
  matches: ['*://*.nzb.su/*'],
  main(ctx) {
    new NZBsuContent(ctx);
  },
});

class NZBsuContent extends Content {
  get id() {
    return 'nzbsu';
  }

  get useLightTheme() {
    return true;
  }

  get uid(): string {
    const rssUrl =
      document.querySelector('link[href^="/rss"]')?.getAttribute('href') || '';
    return new URL(rssUrl, window.location.origin).searchParams.get('i') || '';
  }

  get apikey(): string {
    const rssUrl =
      document.querySelector('link[href^="/rss"]')?.getAttribute('href') || '';
    return new URL(rssUrl, window.location.origin).searchParams.get('r') || '';
  }

  getNzbUrl(id: string): string {
    return `${window.location.origin}/getnzb/${id}.nzb?i=${this.uid}&r=${this.apikey}`;
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
      const [, id] = a.href.match(/\/getnzb\/(\w+)/i) ?? [, ''];
      const url = this.getNzbUrl(id);

      // Get the category
      const [, category] = (
        a.closest('.row')?.querySelector('[href^="/browse?t"]') as HTMLElement
      )?.dataset.originalTitle
        ?.replace(/^Browse /, '')
        .match(/^(\w+)/) ?? [, ''];

      if (this.replaceLinks) {
        this.bindAddUrl(a, url, category, true);
      } else {
        if (window.location.pathname.startsWith('/details')) {
          const button = this.createAddUrlButton({
            url,
            category,
            buttonOptions: {
              styles: {
                margin: '0 0.5em 0 0',
              },
            },
          });

          a.closest('.btn-group')?.insertAdjacentElement('beforebegin', button);
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
    }

    // Create download all buttons
    for (const el of document.querySelectorAll('.nzb_multi_operations_download')) {
      const button = this.createButton({
        styles: {
          margin: '0.2em',
          padding: '6px 10px 6px 26px',
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
          // Get the category from the checkbox
          (el) =>
            el
              .closest('.row')
              ?.querySelector('[href^="/browse?t"]')
              ?.getAttribute('title')
              ?.replace(/^Browse /, '') ?? '',
        );
      });

      el.closest('.nzb_multi_operations')?.prepend(button);
    }
  };
}
