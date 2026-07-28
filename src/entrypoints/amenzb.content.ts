import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

export default defineContentScript({
  matches: ['*://*.amenzb.moe/*', '*://amenzb.moe/*'],

  main(ctx) {
    new AmenzbContent(ctx);
  },
});

class AmenzbContent extends Content {

  get id() {
    return 'amenzb';
  }

  apiKey: string = '';

  get isList(): boolean {
    return document.querySelectorAll('a[href*="/download/"]').length > 1;
  }

  get isDetail(): boolean {
    return window.location.pathname.startsWith('/release/');
  }

  // Fetches the API key from the profile page and caches it
  async ready(): Promise<void> {
    const res = await fetch('https://amenzb.moe/profile', { credentials: 'include' });
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const input = doc.getElementById('apiKeyInput') as HTMLInputElement;
    if (input?.value) {
      this.apiKey = input.value;
      console.info(`[NZB Unity] ameNZB API key loaded`);
    } else {
      console.warn(`[NZB Unity] ameNZB API key not found — are you logged in?`);
    }
  }

  // Converts a /download/123456 URL into the authenticated API URL
  buildApiUrl(downloadUrl: string): string {
    const id = downloadUrl.split('/download/')[1];
    return `https://amenzb.moe/api?t=get&apikey=${this.apiKey}&id=${id}`;
  }

  initializeListLinks = () => {
    const links = document.querySelectorAll('a[href*="/download/"]');
    links.forEach(el => {
      const anchor = el as HTMLAnchorElement;
      this.createAddUrlLink({
        url: this.buildApiUrl(anchor.href),
        adjacent: anchor,
      });
    });
  }

  initializeDetailLinks = () => {
    const anchor = document.querySelector('a[href*="/download/"]') as HTMLAnchorElement;
    if (anchor) {
      this.createAddUrlLink({
        url: this.buildApiUrl(anchor.href),
        adjacent: anchor,
      });
    }
  }
}