import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';
import background from './background';

export default defineContentScript({
  matches: ['*://*.nzbfinder.ws/*'],

  main(ctx) {
    new NZBFinderContent(ctx);
  },
});

class NZBFinderContent extends Content {
  get id() {
    return 'nzbfinder';
  }

  get isDetail(): boolean {
    return window.location.pathname.startsWith('/details');
  }

  get isList(): boolean {
    return !this.isDetail;
  }

  get uid(): string {
    return this.getMeta('user_id') ?? '';
  }

  get apikey(): string {
    return this.getMeta('api_token') ?? '';
  }

  getNzbUrl(id: string): string {
    return `${
      this.getMeta('root_url') ?? window.location.origin
    }/api/v1/getnzb?id=${id}&r=${this.apikey}&utm_medium=nzbunity`;
  }

  isInList(link: HTMLElement): boolean {
    return link.parentElement?.tagName === 'TD';
  }

  getLinkContainer(link: HTMLElement): HTMLElement | null {
    return (
      link.closest(this.isInList(link) ? 'tr' : 'article') ?? link.closest('#buttongroup')
    );
  }

  getFirstChild(container: HTMLElement): HTMLElement | null {
    return container.querySelector(':scope > :first-child');
  }

  getCategory(link: HTMLElement): string {
    const cat =
      this.getLinkContainer(link)?.querySelector('#catname')?.textContent?.trim() || '';

    if (/^\w+$/.test(cat)) {
      // If the category is a single word, it's probably a sub-category
      // try to get the main category from the url
      const [, catMatch] =
        new RegExp(`/(\\w+)/${cat}`).exec(window.location.pathname) ?? [];
      if (catMatch) return `${catMatch} ${cat}`;
    }

    return cat;
  }

  async ready() {
    console.debug(this.getNzbUrl('lol'));
    // warn on missing parms
    this.debug(`[NZB Unity] ready()`, { uid: this.uid, apikey: this.apikey });
    if (!this.uid) console.warn(`[NZB Unity] Unable to find username`);
    if (!this.apikey) console.warn(`[NZB Unity] Unable to find apikey`);
  }

  initializeDetailLinks = () => {
    this.debug(`[NZB Unity] initializeDetailLinks()`);
    // V5
    // Create direct download links on individual items
    for (const el of document.querySelectorAll('a[href*="/getnzb?id="]')) {
      const a = el as HTMLElement;
      const [, id] = a.getAttribute('href')?.match(/\/getnzb\?id=([\w-]+)/i) ?? [];
      if (!id) continue;

      const url = this.getNzbUrl(id);
      let category = this.getCategory(a);

      const catLink = document.querySelector(
        'table a[href*="/browse/"]:not([href*="/browse/group?"])',
      );
      if (catLink) {
        category = (catLink as HTMLElement).innerText.trim();
      }

      if (this.replaceLinks) {
        this.bindAddUrl(a, url, category, true);
      } else {
        const link = this.createAddUrlLink({ url, category });
        link.classList.add(...(this.getFirstChild(a)?.classList.values() ?? []));

        a.insertAdjacentElement('beforebegin', link);

        if (a.parentElement?.id === 'buttongroup') {
          // Info tab, side
          link.innerHTML = `${link.innerHTML} NZB Unity`;
          Object.assign(link.style, {
            display: '',
            height: 'auto',
            width: '',
            padding: '10px 0 10px 32px',
            backgroundPosition: '10px center',
          });

          const linkImg = link.querySelector('& > img');
          if (linkImg) (linkImg as HTMLElement).style.margin = '0 5px 0 3px';

          this.getFirstChild(a)?.classList.remove('rounded-t-md');
        } else {
          // Similar tab, table.
          link.classList.add('align-bottom');
          link.style.margin = '0 0 2px 0';
        }
      }
    }
  };

  initializeListLinks = () => {
    this.debug(`[NZB Unity] initializeListLinks()`);
    // V5
    // Create direct download links on individual items
    for (const el of document.querySelectorAll('a[href*="/getnzb?id="]')) {
      const a = el as HTMLElement;
      const [, id] = a.getAttribute('href')?.match(/\/getnzb\?id=([\w-]+)/i) ?? [];
      if (!id) continue;

      const url = this.getNzbUrl(id);
      let category = this.getCategory(a);

      if (this.replaceLinks) {
        this.bindAddUrl(a, url, category, true);
        continue;
      }

      const link = this.createAddUrlLink({ url, category });
      link.classList.add(...(this.getFirstChild(a)?.classList.values() ?? []));
      Object.assign(link.style, {
        display: '',
        height: '',
        width: '',
      });

      if (this.isInList(a)) {
        // List
        link.style.display = 'inline';

        const linkImg = link.querySelector('& > img');
        if (linkImg) (linkImg as HTMLElement).style.display = 'inline';

        a.parentElement!.style.minWidth = `75px`;
      } else {
        // Covers
        link.style.backgroundPosition = 'center';
        link.style.width = '32px';
        link.classList.add('align-bottom', 'h-full');
      }

      a.insertAdjacentElement('beforebegin', link);
    }

    // Create download all buttons
    for (const el of document.querySelectorAll('#multidownload')) {
      const button = this.createButton();
      button.textContent = 'NZB Unity';
      button.classList.add(...el.classList.values());
      button.style.paddingLeft = '30px';

      button.addEventListener('click', async (e) => {
        e.preventDefault();

        this.addUrlsFromElementsAndNotify(
          button,
          // Get the checked checkboxes
          document.querySelectorAll('input[type="checkbox"][name="chk"]:checked'),
          // Get the ID from each checkbox
          (el) => (el as HTMLInputElement).value,
          // Get the category from each checkbox
          (el) => this.getCategory(el as HTMLElement),
        );
      });

      el.insertAdjacentElement('beforebegin', button);
      el.classList.remove('rounded-l-md');
    }
  };
}
