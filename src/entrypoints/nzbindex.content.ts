import { defineContentScript } from 'wxt/sandbox';
import { Content } from '@/Content';
import { sendMessage } from '@/utils';

export default defineContentScript({
  matches: ['*://*.nzbindex.com/*', '*://*.nzbindex.nl/*'],
  main() {
    new NzbIndexContent();
  },
});

class NzbIndexContent extends Content {
  readonly checkboxSelector: string = 'input[id^="release_"][type="checkbox"]';

  useLightTheme: boolean = true;

  results: HTMLElement[] = [];
  isList: boolean = false;
  isDetail: boolean = false;

  async ready() {
    sendMessage({
      log: { entry: { level: 'log', message: 'NZBIndex content script loaded' } },
    });
    this.results = Array.from(
      await this.waitForQuerySelectorAll('#results-table .result:not(#template)'),
    );
    this.isDetail = /^\/(collection)/.test(window.location.pathname);
    this.isList = !this.isDetail && this.results.length > 0;

    if (this.isDetail) {
      this.initializeDetailLinks();
    } else if (this.isList) {
      this.initializeListLinks();
    } else {
      console.error(`[NZB Unity] Not a detail or list page, 1-click disabled`);
    }
  }

  getNzbUrl(id: string): string {
    return `${window.location.origin}/download/${id}`;
  }

  getNzbIds(): string[] {
    return this.results
      .filter((el) => el.querySelector(`${this.checkboxSelector}:checked`))
      .map((el) => el.id.replace('release_', ''));
  }

  initializeDetailLinks() {
    const button = this.createButton();
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      const [, nzbId] = window.location.pathname.match(/^\/\w+\/(\d+)/) || [];

      if (nzbId) {
        console.info(`[NZB Unity] Adding NZB ${nzbId}`);
        this.addUrlFromElement(button, this.getNzbUrl(nzbId));
      }
    });

    const download = document.querySelector('#actions .download');

    if (!download) {
      return document.querySelector('#actions')?.prepend(button);
    }

    if (this.replaceLinks) {
      return download.replaceWith(button);
    }

    return download.insertAdjacentElement('beforebegin', button);
  }

  initializeListLinks() {
    // Direct download links
    for (const checkbox of this.results.flatMap(
      (el) =>
        Array.from(el.querySelectorAll(this.checkboxSelector)) as HTMLInputElement[],
    )) {
      const container = checkbox.closest('tr');
      if (!container) continue;

      const download = container.querySelector('a[href*="/download/"]');

      const link = this.createLink({
        label: this.replaceLinks,
      });
      link.addEventListener('click', async (e) => {
        e.preventDefault();

        const nzbId = checkbox.id.replace('release_', '');
        const nzbUrl = download?.getAttribute('href');

        if (nzbUrl || nzbId) {
          console.info(`[NZB Unity] Adding NZB ${nzbId}`);
          this.addUrlFromElement(link, nzbUrl || this.getNzbUrl(nzbId));
        }
      });

      // Can't find the download link, insert after the checkbox
      if (!download) {
        checkbox.insertAdjacentElement('afterend', link);
        continue;
      }
      // Replace the download link with the 1-click link
      if (this.replaceLinks) {
        download.replaceWith(link);
        continue;
      }

      link.style.marginRight = '6px';
      download.insertAdjacentElement('beforebegin', link);
    }

    // Create download all button
    const button = this.createButton({ context: 'selected' });
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      const nzbIds = this.getNzbIds();
      if (nzbIds.length) {
        console.info(`[NZB Unity] Adding ${nzbIds.length} NZBs`);
        button.dispatchEvent(new Event('nzb.pending'));

        const results = await Promise.all(
          nzbIds.map((nzbId) =>
            this.client.addUrl(this.getNzbUrl(nzbId), { category: '' }),
          ),
        );

        if (results.every((r) => r?.success)) {
          button.dispatchEvent(new Event('nzb.success'));
        } else {
          button.dispatchEvent(new Event('nzb.failure'));
        }
      }
    });

    const download = document.querySelector('#actions button');

    if (download && this.replaceLinks) {
      download.replaceWith(button);
    } else {
      document.getElementById('actions')?.prepend(button);
    }
  }
}
