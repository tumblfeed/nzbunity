import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

const autoLoadHosts = [
  'newz-complex.org',
  'ninjacentral.co.za',
  'miatrix.com',
  'nzbplanet.net',
  'oznzb.com',
];

export default defineContentScript({
  // Automatically load on these sites (still allows hotkey loading)
  matches: autoLoadHosts.map((host) => `*://*.${host}/*`),
  main(ctx) {
    new NewznabContent(ctx);
  },
});

class NewznabContent extends Content {
  get id() {
    return 'newznab';
  }

  get uid(): string {
    return document.querySelector('[name="UID" i]')?.getAttribute('value') ?? '';
  }

  get apikey(): string {
    return document.querySelector('[name="RSSTOKEN" i]')?.getAttribute('value') ?? '';
  }

  getNzbUrl(id: string): string {
    return `${this.apiurl}?t=get&i=${this.uid}&apikey=${this.apikey}&guid=${id}&id=${id}`;
  }

  getCategory(el: HTMLElement): string {
    const [, category] = el
      .closest('tr')
      ?.querySelector('[href^="/browse?t"]')
      ?.getAttribute('title')
      ?.replace(/^Browse /, '')
      ?.match(/^(\w+)/) ?? [, ''];
    return category;
  }

  async ready() {
    this._apiurl = `${window.location.origin}/api`;

    // Site specific api urls
    if (/newz-complex\.org/i.test(window.location.host)) {
      this._apiurl = `${window.location.origin}/www/api`;
    }
    if (/oznzb\.com/i.test(window.location.host)) {
      this._apiurl = `${window.location.protocol}//api.oznzb.com/api`;
    }

    // warn on missing parms
    this.debug(`[NZB Unity] ready()`, { uid: this.uid, apikey: this.apikey });
    if (!this.uid) console.warn(`[NZB Unity] Unable to find username`);
    if (!this.apikey) console.warn(`[NZB Unity] Unable to find apikey`);

    if (!this.uid || !this.apikey) {
      this.toast(
        'NZB Unity: Unable to find UID or API key (this may not be a Newznab site)!',
      );
      return false;
    }

    if (!autoLoadHosts.some((host) => window.location.host.includes(host))) {
      // If not auto loading, script was injected by the user, so give some feedback
      this.toast('NZB Unity: 1-click activated for this page!');
    }
  }

  initializeLinks = () => {
    // Create direct download links on individual items
    for (const el of document.querySelectorAll('a[href^="/getnzb/"]')) {
      const a = el as HTMLAnchorElement;
      const [, id] = a.href.match(/\/getnzb\/(\w+)/i) ?? [, ''];
      const url = this.getNzbUrl(id);
      const category = this.getCategory(a);

      const link = this.createAddUrlLink({
        url,
        category,
      });

      if (this.replaceLinks) {
        a.replaceWith(link);
      } else {
        if (/nzbplanet\.net/i.test(window.location.host)) {
          a.closest('td')!.style.width = '62px';
          link.style.margin = '2px 0 0 3px';
        } else {
          link.style.margin = '0 .2em 0 .5em';
        }

        a.insertAdjacentElement('beforebegin', link);
      }
    }

    // Create download all buttons
    for (const el of document.querySelectorAll('.nzb_multi_operations_download')) {
      const button = this.createButton();

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

      // el.insertAdjacentElement('beforebegin', button);

      if (el.parentElement?.classList.contains('btn-group')) {
        button.style.margin = '0.2em';
        el.parentElement?.insertAdjacentElement('beforebegin', button);
      } else {
        el.insertAdjacentElement('beforebegin', button);
      }
    }
  };
}
