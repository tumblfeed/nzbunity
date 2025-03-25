import { ContentClient } from '@/Client';
import { NZBAddUrlResult } from '@/downloader';
import { Logger } from '@/logger';
import { getOptions, type IndexerOptions } from '@/store';
import { request } from '@/utils';

import '@/assets/content.css';

export { request, RequestOptions } from '@/utils';
export const icons = {
  green: browser.runtime.getURL('/icon/nzb-16-green.png'),
  grey: browser.runtime.getURL('/icon/nzb-16-grey.png'),
  orange: browser.runtime.getURL('/icon/nzb-16-orange.png'),
  red: browser.runtime.getURL('/icon/nzb-16-red.png'),
};
export const classLight: string = 'NZBUnityLight';
export const backgroundNormal: string = 'var(--nzb-button-background)';
export const backgroundPending: string = 'var(--nzb-pending)';
export const backgroundSuccess: string = 'var(--nzb-success)';
export const backgroundFailure: string = 'var(--nzb-error)';

export abstract class Content {
  get client() {
    return ContentClient.getInstance();
  }

  get name(): string {
    return this.constructor.name.replace(/(Content|Page)$/, '');
  }

  get indexerKey(): string {
    return this.name.toLowerCase();
  }

  useLightTheme: boolean = false;
  indexerOptions: IndexerOptions | undefined = undefined;
  replaceLinks: boolean = false;

  constructor() {
    if (!this.indexerKey) {
      throw new Error('Indexer key must be defined in subclass');
    }

    getOptions().then((options) => {
      this.replaceLinks = options.ReplaceLinks;

      // Check that the indexer is present and enabled
      if (!options.Indexers[this.indexerKey]) {
        throw new Error(`Indexer key not found: ${this.indexerKey}`);
      }

      this.indexerOptions = options.Indexers[this.indexerKey];

      if (!this.indexerOptions?.Enabled) {
        console.info(`[NZB Unity] 1-click functionality disabled for this site`);
        return;
      }

      // Set page params
      if (this.useLightTheme) {
        document.documentElement.classList.add(classLight);
      }

      // All good, continue
      console.info(`[NZB Unity] Initializing ${this.name} 1-click functionality...`);
      this.ready();
    });
  }

  // Called after constructor, when customizations can be applied, listeners added, etc.
  abstract ready(): void;

  waitForQuerySelector(selector: string, root = document): Promise<HTMLElement> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const el = root.querySelector(selector);
        if (el) {
          clearInterval(interval);
          resolve(el as HTMLElement);
        }
      }, 100);
    });
  }

  waitForQuerySelectorAll(
    selector: string,
    root = document,
  ): Promise<NodeListOf<HTMLElement>> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const els = root.querySelectorAll(selector);
        if (els.length) {
          clearInterval(interval);
          resolve(els as NodeListOf<HTMLElement>);
        }
      }, 100);
    });
  }

  async addFileByRequest(
    filename: string,
    category: string = '',
    url: string = window.location.origin,
    params: Record<string, unknown> = {},
  ): Promise<NZBAddUrlResult | undefined> {
    console.info(`[NZB Unity] Adding file: ${filename} ${url}`);
    // A lot of sites require POST to fetch NZB and follow this pattern (binsearch, nzbindex, nzbking)
    // Fetches a single NZB from a POST request and adds it to the server as a file upload
    const content = await request({ method: 'POST', url, params });
    return this.client.addFile(filename, content as string, { category });
  }

  async addUrlFromElement(
    el: HTMLElement,
    url: string,
    category: string = '',
    delay: number = 500,
  ): Promise<NZBAddUrlResult | undefined> {
    console.info(`[NZB Unity] Adding URL: ${url}`);

    el?.dispatchEvent(new Event('nzb.pending'));

    const res = await this.client.addUrl(url, { category: category });

    // Delay the event to allow the icon to change; too fast feels like a glitch
    setTimeout(() => {
      el?.dispatchEvent(new Event(res?.success ? 'nzb.success' : 'nzb.failure'));
    }, delay || 0);

    return res;
  }

  bindAddUrl(
    el: HTMLElement,
    url: string,
    category: string = '',
    exclusive: boolean = false,
  ): HTMLElement {
    el.addEventListener(
      'click',
      async (event) => {
        event.preventDefault();
        await this.addUrlFromElement(el, url, category);
      },
      {
        capture: Boolean(exclusive),
      },
    );

    return el;
  }

  createLink({
    label,
    styles,
  }: {
    label?: string | boolean;
    styles?: Record<string, string>;
  } = {}): HTMLElement {
    const a = document.createElement('a');
    a.classList.add('NZBUnityLink');
    a.title = 'Download with NZB Unity';

    const img = document.createElement('img');
    img.src = icons.green;
    a.append(img);

    if (label) {
      if (label === true) label = 'Download';
      a.insertAdjacentText('beforeend', ` ${label}`);
    }

    Object.assign(a.style, { ...styles });

    a.addEventListener('nzb.pending', () => (img.src = icons.grey));
    a.addEventListener('nzb.success', () => (img.src = icons.green));
    a.addEventListener('nzb.failure', () => (img.src = icons.red));

    return a;
  }

  createButton({
    context,
    styles,
    element = 'button',
  }: {
    context?: string;
    styles?: Record<string, string>;
    element?: 'button' | 'a';
  } = {}): HTMLElement {
    const btn = document.createElement(element);
    btn.classList.add('NZBUnityButton');

    switch (context) {
      case 'list':
      case 'selected':
        btn.textContent = 'Download Selected';
        btn.title = 'Download selected items with NZB Unity';
        break;

      default:
        btn.textContent = 'Download NZB';
        btn.title = 'Download with NZB Unity';
    }

    Object.assign(btn.style, { ...styles });

    btn.addEventListener('nzb.pending', () =>
      Object.assign(btn.style, {
        backgroundColor: backgroundPending,
        backgroundImage: `url(${icons.grey})`,
      }),
    );

    btn.addEventListener('nzb.success', () =>
      Object.assign(btn.style, {
        backgroundColor: backgroundNormal,
        backgroundImage: `url(${icons.green})`,
      }),
    );

    btn.addEventListener('nzb.failure', () =>
      Object.assign(btn.style, {
        backgroundColor: backgroundNormal,
        backgroundImage: `url(${icons.red})`,
      }),
    );

    return btn;
  }

  createAddUrlLink({
    url,
    category = '',
    adjacent,
    linkOptions,
  }: {
    url: string;
    category: string;
    adjacent?: HTMLElement;
    linkOptions?: Parameters<Content['createLink']>[0];
  }): HTMLElement {
    console.debug(`${this.name}.createAddUrlLink`, url, category);
    const a = this.bindAddUrl(this.createLink(), url, category);
    a.setAttribute('href', url);

    Object.assign(a.style, {
      height: '16px',
      width: '16px',
    });

    if (adjacent) {
      adjacent.insertAdjacentElement('afterend', a);
    }

    return a;
  }

  createAddUrlButton({
    url,
    category = '',
    adjacent,
    buttonOptions,
  }: {
    url: string;
    category: string;
    adjacent?: HTMLElement;
    buttonOptions?: Parameters<Content['createButton']>[0];
  }): HTMLElement {
    console.debug(`${this.name}.createAddUrlButton`, url, category);
    const btn = this.bindAddUrl(this.createButton(), url, category);

    if (adjacent) {
      adjacent.insertAdjacentElement('afterend', btn);
    }

    return btn;
  }
}
