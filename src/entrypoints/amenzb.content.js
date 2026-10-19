// @ts-check
import { defineContentScript } from '#imports';
import { Content } from '~/Content';
import '~/assets/content.css';
export default defineContentScript({
  matches: ['*://*.amenzb.moe/*', '*://amenzb.moe/*'],
  main(ctx) {
    new AmenzbContent(ctx);
  },
});
class AmenzbContent extends Content {
  /** @override */
  get id() {
    return 'amenzb';
  }

  /** @override */
  get isList() {
    return document.querySelectorAll('a[href*="/download/"]').length > 1;
  }

  /** @override */
  get isDetail() {
    return window.location.pathname.startsWith('/release/');
  }

  /**
   * Fetches the API key from the profile page and caches it
   * @override
   */
  async ready() {
    const res = await fetch('https://amenzb.moe/profile', { credentials: 'include' });
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const input = /** @type {HTMLInputElement} */ (doc.getElementById('apiKeyInput'));
    if (input?.value) this._apikey = input.value;
    this.debug(`[NZB Unity] ready()`, { apikey: this.apikey });
    if (!this.apikey)
      console.warn(`[NZB Unity] Unable to find apikey — are you logged in?`);
  }

  // Converts a /download/123456 URL into the authenticated API URL
  buildApiUrl(downloadUrl) {
    const id = downloadUrl.split('/download/')[1];
    return `https://amenzb.moe/api?t=get&apikey=${this.apikey}&id=${id}`;
  }

  /** @override */
  initializeListLinks = () => {
    const links = document.querySelectorAll('a[href*="/download/"]');
    links.forEach((el) => {
      const anchor = /** @type {HTMLAnchorElement} */ (el);
      this.createAddUrlLink({
        url: this.buildApiUrl(anchor.href),
        adjacent: anchor,
      });
    });
  };

  /** @override */
  initializeDetailLinks = () => {
    const anchor = /** @type {HTMLAnchorElement} */ (
      document.querySelector('a[href*="/download/"]')
    );
    if (anchor) {
      this.createAddUrlLink({
        url: this.buildApiUrl(anchor.href),
        adjacent: anchor,
      });
    }
  };
}
