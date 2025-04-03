import { defineContentScript } from 'wxt/sandbox';
import { Content, request } from '~/Content';

export default defineContentScript({
  matches: ['*://*.gingadaddy.com/*'],

  main(ctx) {
    new GingaDaddyContent(ctx);
  },
});

class GingaDaddyContent extends Content {
  get id() {
    return 'gingadaddy';
  }

  profileContent: string = '';

  get isDetail(): boolean {
    return false;
  }

  get isList(): boolean {
    return false;
  }

  get uid(): string {
    const [, uid] = (
      document.querySelector(
        '#accblck a[href*="userdetails.php?id="]',
      ) as HTMLAnchorElement
    )?.href.match(/id=(\d+)/) ?? [, ''];
    return uid;
  }

  get apikey(): string {
    return '';
  }

  getNzbUrl(id: string): string {
    return `${window.location.origin}/gingasrssdownload.php?h=${id}&i=${this.apikey}&uid=${this.uid}&t=dlnzb`;
  }

  async ready() {
    this.profileContent = (await request({
      url: `/userdetails.php?id=${this.uid}`,
    })) as string;
    if (!this.profileContent) {
      console.warn(`[NZB Unity] Unable to load profile page`);
      return false;
    }

    [, , this._apikey] = this.profileContent.match(
      /API KEY<\/td>\s*<td><b>(.*)<\/b>/im,
    ) ?? [, , ''];
    this._apikey = this._apikey?.trim();

    // warn on missing parms
    this.debug(`[NZB Unity] ready()`, { uid: this.uid, apikey: this.apikey });
    if (!this.uid) console.warn(`[NZB Unity] Unable to find username`);
    if (!this.apikey) console.warn(`[NZB Unity] Unable to find apikey`);
  }

  initializeLinks = () => {
    // Create direct download links on individual items
    for (const el of document.querySelectorAll('.dlnzb a')) {
      const a = el as HTMLAnchorElement;
      const [, id] = a.href.match(/id=(\d+)/i) ?? [, ''];
      const url = this.getNzbUrl(id);

      const [, category] = a
        .closest('[id^=row]')
        ?.querySelector('a.catimg')
        ?.getAttribute('title')
        ?.replace(/^Show all in: /, '')
        .match(/^(\w+)/) ?? [, ''];

      const link = this.createAddUrlLink({
        url,
        category,
        linkOptions: {
          styles: {
            float: 'left',
            margin: '0 0 0 20px',
          },
        },
      });
      link.title = 'Download with NZB Unity (VIP ONLY)';
      a.closest('[id^=row]')?.querySelector('[class^="pstrow"]:last')?.prepend(link);
    }
  };
}
