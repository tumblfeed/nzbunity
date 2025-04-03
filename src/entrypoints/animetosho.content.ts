import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

export default defineContentScript({
  matches: ['*://*.animetosho.org/*'],

  main(ctx) {
    new AnimeToshoContent(ctx);
  },
});

class AnimeToshoContent extends Content {
  get id() {
    return 'animetosho';
  }

  initializeLinks = () => {
    for (const el of document.querySelectorAll('a[href*="/nzbs/"]')) {
      const a = el as HTMLAnchorElement;
      const url = a.href.replace(/\.gz$/, '');
      const link = this.createAddUrlLink({
        url,
        linkOptions: {
          styles: {
            margin: '0 0 0 3px',
            'vertical-align': 'middle',
          },
        },
      });

      if (this.replaceLinks) {
        a.replaceWith(link);
      } else {
        a.insertAdjacentElement('afterend', link);
      }
    }
  };
}
