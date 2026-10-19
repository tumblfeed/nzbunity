import { defineContentScript } from '#imports';
import { Content } from '~/Content';
import '~/assets/content.css';
export default defineContentScript({
  matches: ['*://*.dognzb.cr/*'],
  main(ctx) {
    new DognzbContent(ctx);
  },
});
class DognzbContent extends Content {
  get id() {
    return 'dognzb';
  }

  get useLightTheme() {
    return true;
  }

  // Dognzb uses an ajax filter, watch for dom changes and update links
  observer;

  get isDetail() {
    return window.location.pathname.startsWith('/details');
  }

  get isList() {
    return !this.isDetail && document.querySelectorAll('.dog-result-row').length > 0;
  }

  get apikey() {
    return (
      document.querySelector('input[name="rsstoken" i]')?.getAttribute('value') ?? ''
    );
  }

  getNzbUrl(id) {
    return `${window.location.protocol}//dl.${window.location.host}/fetch/${id}/${this.apikey}`;
  }

  async ready() {
    // Only apply CSS fix in Chrome — Firefox handles CSP differently and shows the icon fine
    const isChrome =
      navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Firefox');

    if (isChrome) {
      const style = document.createElement('style');
      style.textContent = `
    .NZBUnityLink {
      background-image: none !important;
      min-width: 16px !important;
      border-radius: 2px !important;
      background-color: #40a040 !important;
      color: white !important;
      font-size: 13px !important;
      font-weight: bold !important;
      text-align: center !important;
      line-height: 16px !important;
      text-decoration: none !important;
    }
    .NZBUnityLink::before {
      content: '↓' !important;
    }
    .NZBUnityLink.pending { background-color: #808080 !important; }
    .NZBUnityLink.success { background-color: #40a040 !important; }
    .NZBUnityLink.error   { background-color: #cc3333 !important; }
  `;
      document.head.appendChild(style);
    }

    this.observer = new MutationObserver((mutations) => {
      console.info(`[NZB Unity] Content changed, updating links...`);
      this.onReady(); // Re-run initialization
    });
    if (document.getElementById('content'))
      this.observer.observe(document.getElementById('content'), {
        childList: true,
      });

    // warn on missing parms
    this.debug(`[NZB Unity] ready()`, { apikey: this.apikey });
    if (!this.apikey) console.warn(`[NZB Unity] Unable to find apikey`);
  }

  initializeDetailLinks = () => {
    this.debug(`[NZB Unity] initializeDetailLinks()`);
    const [, idFromPath] = window.location.pathname.match(/\/details\/(\w+)/i) ?? [];
    const id = idFromPath || document.getElementById('guid')?.getAttribute('value') || '';
    if (!id) return;

    // Get the category (rendered as tag pills now, not a table cell)
    const category =
      document
        .querySelector('.dog-detail-category-tags .dog-media-tag-parent')
        ?.textContent?.trim() ?? '';

    const link = this.createAddUrlLink({
      url: this.getNzbUrl(id),
      category,
    });
    const download = document.querySelector('[onclick^="doOneDownload"]');
    if (download && this.replaceLinks) {
      // Replace the "download nzb" item inside the Actions dropdown
      const item = download.closest('li') ?? download;
      link.style.padding = '0 0 0 5px';
      link.insertAdjacentText('beforeend', ' download');
      item.replaceWith(link);
    } else {
      // Drop a standalone button next to the Actions dropdown
      const actionsMenu = document.querySelector('.dog-detail-actions-menu');
      const releasebar = document.querySelector('.dog-detail-releasebar');
      link.style.margin = '0 8px 0 0';
      if (actionsMenu) {
        actionsMenu.insertAdjacentElement('beforebegin', link);
      } else {
        releasebar?.append(link);
      }
    }
  };

  initializeListLinks = () => {
    this.debug(`[NZB Unity] initializeListLinks()`);
    for (const el of document.querySelectorAll('[onclick^="doOneDownload"]')) {
      const a = el;
      const [, id] = a.getAttribute('onclick')?.match(/\('(\w+)'\)/i) ?? [];
      if (!id) continue;

      // Get the row and category (rows are now divs, not table rows)
      const row = a.closest('.dog-result-row');
      const catLabel = row?.querySelector('.dog-media-tag-parent');
      const category = catLabel?.textContent?.trim() ?? '';
      const link = this.createAddUrlLink({
        url: this.getNzbUrl(id),
        category,
        linkOptions: {
          styles: { margin: '0 0 0 2px' },
        },
      });
      link.addEventListener('nzb.success', (e) => {
        link.insertAdjacentHTML(
          'afterend',
          '<span class="dog-icon-tick" style="margin-left:4px;" title="Added"></span>',
        );
      });
      if (this.replaceLinks) {
        a.replaceWith(link);
      } else {
        a.style.marginRight = '4px';
        const wrapper = a.closest('.dog-inline-download') ?? a;
        wrapper.insertAdjacentElement('afterend', link);
      }
    }

    // Create download all buttons
    for (const el of document.querySelectorAll('[onclick^="doZipDownload"]')) {
      const button = this.createButton({
        styles: { margin: '0 0.3em 0 0' },
      });
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        this.addUrlsFromElementsAndNotify(
          button,
          // Get all the checked checkboxes (rows are now divs, not table rows)
          document.querySelectorAll('.ckbox:checked'),
          // Get the ID from each checkbox
          (el) => {
            const [, id] =
              el
                .closest('.dog-result-row')
                ?.querySelector('[onclick^="doOneDownload"]')
                ?.getAttribute('onclick')
                ?.match(/\('(\w+)'\)/i) ?? [];
            return id;
          },

          // Get the category from each checkbox
          (el) => {
            return (
              el
                .closest('.dog-result-row')
                ?.querySelector('.dog-media-tag-parent')
                ?.textContent?.trim() ?? ''
            );
          },
        );
      });
      el.insertAdjacentElement('beforebegin', button);
    }
  };
}
