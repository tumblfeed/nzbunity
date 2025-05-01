import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

export default defineContentScript({
  matches: ['*://*.nzbking.com/*'],
  main(ctx) {
    new NZBKingContent(ctx);
  },
});

class NZBKingContent extends Content {
  get id() {
    return 'nzbking';
  }

  get apikey(): string {
    return (
      (document.querySelector('input[name="csrfmiddlewaretoken"]') as HTMLInputElement)
        ?.value ?? ''
    );
  }

  getNzbUrl(id: string): string {
    return `${window.location.origin}/nzb:${id}/`;
  }

  async ready() {
    // warn on missing parms
    this.debug(`[NZB Unity] ready()`, { apikey: this.apikey });
    if (!this.apikey) console.warn(`[NZB Unity] Unable to find apikey`);
  }

  initializeLinks = () => {
    for (const el of document.querySelectorAll('a[href^="/nzb:"]')) {
      const a = el as HTMLAnchorElement;
      const link = this.createAddUrlLink({
        url: a.href,
        linkOptions: {
          styles: {
            margin: '0 5px 0 0',
            'vertical-align': 'middle',
          },
        },
      });

      a.insertAdjacentElement('beforebegin', link);
    }
  };
}
