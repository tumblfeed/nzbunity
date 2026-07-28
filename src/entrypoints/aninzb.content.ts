import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

export default defineContentScript({
  matches: ['*://*.aninzb.moe/*', '*://aninzb.moe/*'],

  main(ctx) {
    new AninzbContent(ctx);
  },
});

class AninzbContent extends Content {
  get id() {
    return 'aninzb';
  }

  // Download buttons are plain links, eg:
  // <a class="btn btn-ghost btn-sm" href="/api/nzb/9470/Some.Release.Name.nzb">Download</a>
  // No API key or auth needed, so we can just grab the href directly on any page
  // (list or detail) and add a button next to it.
  initializeLinks = () => {
    for (const el of document.querySelectorAll('a[href*="/api/nzb/"]')) {
      const a = el as HTMLAnchorElement;

      const link = this.createAddUrlLink({
        url: a.href,
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
