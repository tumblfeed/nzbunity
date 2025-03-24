import { defineContentScript } from 'wxt/sandbox';
import { Page } from '@/Page';

export default defineContentScript({
  matches: ['*://*.nzbindex.com/*', '*://*.nzbindex.nl/*'],
  main() {
    new NzbIndexPage();
  },
});

class NzbIndexPage extends Page {
  public readonly checkboxSelector: string = 'input[id^="release_"][type="checkbox"]';

  public results: HTMLElement[] = [];
  public isList: boolean = false;
  public isDetail: boolean = false;

  async ready() {
    this.results = Array.from(
      await this.waitForQuerySelectorAll('#results-table .result'),
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
    button.textContent = 'Download NZB';
    button.title = 'Download with NZB Unity';
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      const [, nzbId] = window.location.pathname.match(/^\/\w+\/(\d+)/) || [];

      if (nzbId) {
        console.info(`[NZB Unity] Adding NZB ${nzbId}`);
        this.addUrlFromElement(button, this.getNzbUrl(nzbId));
      }
    });
    document.getElementById('actions')?.prepend(button);
  }

  initializeListLinks() {
    console.log('List page');

    // Direct download links
    for (const checkbox of this.results.flatMap(
      (el) =>
        Array.from(el.querySelectorAll(this.checkboxSelector)) as HTMLInputElement[],
    )) {
      const link = this.createLink();
      link.style.display = 'block';
      link.addEventListener('click', async (e) => {
        e.preventDefault();

        const nzbUrl = checkbox
          .closest('tr')
          ?.querySelector('a[href*="/download/"]')
          ?.getAttribute('href');
        const nzbId = checkbox.id.replace('release_', '');

        if (nzbUrl && nzbId) {
          console.info(`[NZB Unity] Adding NZB ${nzbId}`);
          this.addUrlFromElement(link, nzbUrl);
        }
      });
      checkbox.closest('tr')?.prepend(link);
    }

    // Create download all button
    const button = this.createButton();
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

    document.getElementById('actions')?.prepend(button);
  }
}
