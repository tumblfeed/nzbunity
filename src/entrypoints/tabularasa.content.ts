import { defineContentScript } from 'wxt/sandbox';
import { Content, request } from '~/Content';

export default defineContentScript({
  matches: ['*://*.tabula-rasa.pw/*'],

  main(ctx) {
    new TabulaRasaContent(ctx);
  },
});

class TabulaRasaContent extends Content {
  get id() {
    return 'tabularasa';
  }

  profileContent: string = '';

  get useLightTheme() {
    return true;
  }

  getNzbUrl(id: string): string {
    return `${window.location.origin}/api/v2/getnzb?id=${id}&api_token=${this.apikey}`;
  }

  async ready() {
    this.profileContent = (await request({ url: '/profile' })) as string;
    if (!this.profileContent) {
      console.warn(`[NZB Unity] Unable to load profile page`);
      return false;
    }

    [, , this._apikey] = this.profileContent.match(/\/rss\?.*(r=([a-z0-9]+))/i) || [];

    // warn on missing parms
    this.debug(`[NZB Unity] ready()`, { apikey: this.apikey });
    if (!this.apikey) console.warn(`[NZB Unity] Unable to find apikey`);
  }

  initializeLinks = () => {
    // Create direct download links on individual items
    for (const el of document.querySelectorAll('a[href*="/getnzb?id="]')) {
      const a = el as HTMLAnchorElement;
      const [, id] = a.href.match(/\/getnzb\?id=([\w-]+)/i) ?? [, ''];
      const url = this.getNzbUrl(id);

      if (window.location.pathname.startsWith('/details')) {
        const category = this.extractCategory(
          '.tab-content a[href*="/browse/"]:not([href*="?"])',
        );

        if (this.replaceLinks) {
          this.bindAddUrl(a, url, category, true);
        } else {
          const link = this.createAddUrlLink({
            url,
            category,
            linkOptions: {
              styles: {
                display: '',
                height: '',
                width: '',
                'margin-left': '-1px',
              },
            },
          });
          link.classList.add(
            'btn',
            'btn-light',
            'btn-sm',
            'btn-success',
            'btn-transparent',
          );
          a.insertAdjacentElement('beforebegin', link);
        }
      } else if (a.getAttribute('role') === 'button') {
        if (this.replaceLinks) {
          this.bindAddUrl(a, url, '', true);
        } else {
          const link = this.createAddUrlLink({
            url,
            linkOptions: {
              styles: {
                float: 'left',
                margin: '0 0.25em 0 0',
              },
            },
          });
          a.parentElement?.parentElement?.querySelector('.release-name')?.prepend(link);
        }
      } else {
        // List
        const category = this.extractCategory(
          a.closest('tr[id^="guid"]')?.querySelector('td:nth-child(3)'),
        );
        if (this.replaceLinks) {
          this.bindAddUrl(a, url, category, true);
        } else {
          const link = this.createAddUrlLink({
            url,
            category,
            linkOptions: {
              styles: {
                margin: '0 0.25em 0 0',
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
          'border-top-right-radius': '0',
          'border-bottom-right-radius': '0',
          'line-heignt': '11px',
          margin: '0',
        },
      });
      button.classList.add('btn', 'btn-sm');

      button.addEventListener('click', async (e) => {
        e.preventDefault();

        this.addUrlsFromElementsAndNotify(
          button,
          // Get all the checked checkboxes
          document.querySelectorAll('input[name="table_records"]:checked'),
          // Get the ID from each checkbox
          (el) => (el as HTMLInputElement).value,
          // Get the category from the checkbox
          () => '',
        );
      });

      el.insertAdjacentElement('beforebegin', button);
    }
  };
}
