import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

export default defineContentScript({
  matches: ['*://*.nzbindex.com/*', '*://*.nzbindex.nl/*'],
  main(ctx) {
    new NzbIndexContent(ctx);
  },
});

class NzbIndexContent extends Content {
  get id() {
    return 'nzbindex';
  }

  get useLightTheme() {
    return true;
  }

  readonly checkboxSelector: string = 'input[id^="release_"][type="checkbox"]';
  results: HTMLElement[] = [];

  getNzbUrl(id: string): string {
    return `${window.location.origin}/download/${id}`;
  }

  get isDetail(): boolean {
    return /^\/(collection)/.test(window.location.pathname);
  }

  get isList(): boolean {
    return !this.isDetail && this.results.length > 0;
  }

  async ready() {
    // Wait for the results to load before continuing
    this.results = Array.from(
      await this.waitForQuerySelectorAll('#results-table .result:not(#template)'),
    );
  }

  initializeDetailLinks = () => {
    const button = this.createButton();
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      const [, nzbId] = window.location.pathname.match(/^\/\w+\/(\d+)/) || [];

      if (nzbId) {
        console.info(`[NZB Unity] Adding NZB ${nzbId}`);
        this.addUrlAndNotify(button, this.getNzbUrl(nzbId));
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
  };

  initializeListLinks = () => {
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
          this.addUrlAndNotify(link, nzbUrl || this.getNzbUrl(nzbId));
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

      this.addUrlsFromElementsAndNotify(
        button,
        // Get all the checked checkboxes
        this.results.filter((el) => el.querySelector(`${this.checkboxSelector}:checked`)),
        // Get the ID from each checkbox
        (el) => el.id.replace('release_', ''),
        // Get the category from the checkbox
        () => '',
      );
    });

    const download = document.querySelector('#actions button');

    if (download && this.replaceLinks) {
      download.replaceWith(button);
    } else {
      document.getElementById('actions')?.prepend(button);
    }
  };
}
