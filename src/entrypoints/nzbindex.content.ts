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

  results: HTMLInputElement[] = [];

  getNzbUrl(id: string): string {
    return `${window.location.origin}/download/${id}.nzb`;
  }

  get isDetail(): boolean {
    return /^\/(collection)/.test(window.location.pathname);
  }

  get isList(): boolean {
    return !this.isDetail && this.results.length > 0;
  }

  async ready() {
    if (!this.isList) return true;

    // Wait for the results to load before continuing
    try {
      const results = await this.waitForQuerySelectorAll(
        'input[id^="select-"][type="checkbox"]',
      );
      this.results = Array.from(results) as HTMLInputElement[];
    } catch (e) {
      console.error('[NZB Unity] Failed to find results:', e);
      return false;
    }
  }

  initializeDetailLinks = () => {
    const button = this.createButton();
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      const [, nzbId] = window.location.pathname.match(/^\/\w+\/([a-f0-9\-]+)/) || [];

      if (nzbId) {
        console.info(`[NZB Unity] Adding NZB ${nzbId}`);
        this.addUrlAndNotify(button, this.getNzbUrl(nzbId));
      }
    });

    this.waitForQuerySelector('a[href^="/download"]')
      .then((download) => {
        if (!download) throw Error('Failed to find download button');

        if (this.replaceLinks) {
          download.replaceWith(button);
        } else {
          download.insertAdjacentElement('beforebegin', button);
        }
      })
      .catch(() => {
        document.querySelector('h1')?.prepend(button);
      });
  };

  initializeListLinks = () => {
    // Direct download links
    for (const checkbox of this.results) {
      const container = checkbox.closest('tr');
      if (!container) continue;

      const download = container.querySelector('a[href*="/download/"]');

      const link = this.createLink({
        label: this.replaceLinks,
      });
      link.addEventListener('click', async (e) => {
        e.preventDefault();

        const nzbId = checkbox.value;
        let nzbUrl = download?.getAttribute('href');
        if (nzbUrl) {
          nzbUrl = `${window.location.origin}${nzbUrl}`;
        }

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

    console.log(this.results);

    const button = this.createButton({
      context: 'selected',
      styles: {
        float: 'left',
      },
    });
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      this.addUrlsFromElementsAndNotify(
        button,
        // Get all the checked checkboxes
        this.results.filter((el) => el.checked),
        // Get the ID from each checkbox
        (el) => (el as HTMLInputElement).value,
        // Get the category from the checkbox
        () => '',
      );
    });

    const download = Array.from(document.querySelectorAll('button')).find(
      (el) => el.textContent === 'Download',
    );

    if (download && this.replaceLinks) {
      download.replaceWith(button);
    } else {
      download?.insertAdjacentElement('beforebegin', button);
    }
  };
}
