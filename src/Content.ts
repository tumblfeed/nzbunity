import { ContentScriptContext } from 'wxt/client';
import { ContentClient } from '@/Client';
import { Logger } from '@/logger';
import { getOptions, type IndexerOptions } from '@/store';
import { request } from '@/utils';

import type { NZBAddUrlResult } from '@/downloader';

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

  logger: Logger = new Logger(this.constructor.name);
  debug(...args: unknown[]) {
    if (import.meta.env.DEV) console.debug(...args);
  }

  // Options

  useLightTheme: boolean = false;
  indexerOptions: IndexerOptions | undefined = undefined;
  replaceLinks: boolean = false;

  // Commonly used property accessors

  get isList(): boolean {
    return false;
  }
  get isDetail(): boolean {
    return false;
  }

  get uid(): string {
    return '';
  }
  get apikey(): string {
    return '';
  }
  get apiurl(): string {
    return '';
  }

  /**
   * Given an ID, returns the URL to fetch the NZB file,
   * typically passed to the downloader on link click.
   * eg. `${window.location.origin}/download/${id}`
   */
  getNzbUrl(id: string): string {
    return id;
  }

  constructor(public ctx: ContentScriptContext) {
    if (!this.indexerKey) {
      throw new Error('Indexer key must be defined in subclass');
    }

    getOptions()
      .then((options) => {
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

        // All good, ready up
        console.info(`[NZB Unity] Initializing ${this.name} 1-click functionality...`);
        return this.ready();
      })
      .then((readyState: void | boolean) => {
        if (readyState === false) {
          console.warn(`[NZB Unity] Ready failed, disabling ${this.name} content script`);
          return;
        }
        // Ready succeeded, continue
        return this.onReady();
      })
      .then(() => {
        this.debug(`[NZB Unity] ${this.name} initialized!`);
        // Initialize should be complete, add listeners
        this.ctx.onInvalidated(() => this.cleanup());
      })
      .catch((err) => {
        console.error(`[NZB Unity] Error initializing ${this.name} content script`, err);
      });
  }

  /**
   * Called after constructor, client and options are available and
   * customizations can now be applied, listeners added, etc.
   * This is technically optional in child classes, but should be implemented.
   * Return false or throw an error to disable the content script.
   * Then (only) of the following will be called based in order:
   * - `this.initializeLinks` if it is defined, regardless of page type
   * - `this.initializeListLinks` if `this.isList` is true
   * - `this.initializeDetailLinks` if `this.isDetail` is true
   * - An error will be logged if none of the above are called
   */
  ready(): void | boolean | Promise<void | boolean> {
    return; // Default to no-op
  }

  /**
   * Called after `ready` if it does not return false.
   * See `ready` for more information.
   * Can be called manually if links need to be updated.
   */
  onReady(): void {
    if (typeof this.initializeLinks === 'function') return this.initializeLinks();

    if (this.isList && typeof this.initializeListLinks === 'function')
      return this.initializeListLinks();

    if (this.isDetail && typeof this.initializeDetailLinks === 'function')
      return this.initializeDetailLinks();

    console.warn(
      `[NZB Unity] Not a detail or list page; missing init function for ${this.name}`,
    );
  }

  /**
   * If set, will be called unconditionally after `ready` (if ready does not return false)
   * `initializeListLinks` and `initializeDetailLinks` will be ignored if this is set.
   */
  initializeLinks: undefined | (() => void);
  /**
   * If set, will be called when `this.isList` is true after `ready`
   * if `this.initializeLinks` is not set.
   */
  initializeListLinks: undefined | (() => void);
  /**
   * If set, will be called when `this.isDetail` is true after `ready`
   * if `this.isList` is false or `this.initializeLinks` is not set.
   */
  initializeDetailLinks: undefined | (() => void);

  /**
   * Given a selector, waits for the element to be present in the DOM
   * and resolves with the element.
   * @param selector
   * @param root The root element to search within
   */
  waitForQuerySelector(selector: string, root = document): Promise<HTMLElement> {
    return new Promise((resolve) => {
      const interval = this.ctx.setInterval(() => {
        const el = root.querySelector(selector);
        if (el) {
          clearInterval(interval);
          resolve(el as HTMLElement);
        }
      }, 100);
    });
  }

  /**
   * Given a selector, waits for the element to be present in the DOM
   * and resolves with all matching elements.
   * @param selector
   * @param root The root element to search within
   */
  waitForQuerySelectorAll(
    selector: string,
    root = document,
  ): Promise<NodeListOf<HTMLElement>> {
    return new Promise((resolve) => {
      const interval = this.ctx.setInterval(() => {
        const els = root.querySelectorAll(selector);
        if (els.length) {
          clearInterval(interval);
          resolve(els as NodeListOf<HTMLElement>);
        }
      }, 100);
    });
  }

  /**
   * Cleanup function to remove any added elements or classes.
   * Called when the content script is invalidated.
   */
  cleanup() {
    if (this.replaceLinks) {
      // Can't cleanup because replace is destructive, just reload the page
      return window.location.reload();
    }
    // Remove classes and elements added by the content script
    document.documentElement.classList.remove(classLight);
    document
      .querySelectorAll('.NZBUnityLink, .NZBUnityButton')
      .forEach((el) => el.remove());
  }

  /**
   * Adds a file to the downloader by fetching the NZB file content from a URL.
   * Used for sites that require a POST request to fetch the NZB file.
   * @param filename The name of the file to add
   * @param category The category to add the file to
   * @param url The URL to fetch the NZB file content from
   * @param params Additional parameters to pass to the fetch request
   */
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

  /**
   * Adds a URL to the downloader, dispatching progress events on the given element.
   * The element will receive a 'nzb.pending' event when the request is sent,
   * a 'nzb.success' event when the request is successful, and a 'nzb.failure' event
   * when the request fails.
   * A delay can be set to wait before dispatching the success or failure event,
   * as the request is very quick for localhost downloaders and immediate feedback can feel like a glitch.
   * @param el The element to dispatch events on
   * @param url The URL to add
   * @param category (optional) The category to add the URL to
   * @param delay (default 500ms) The delay before dispatching the success or failure event
   */
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

  /**
   * Binds a click event to the element to add a URL to the downloader.
   * The element will receive custom events 'nzb.pending' and 'nzb.success' or 'nzb.failure'.
   * @param el The element to watch for clicks
   * @param url The URL to add
   * @param category (optional) The category to add the URL to
   * @param exclusive (default false) If true, the event will be captured and not bubble
   * @returns
   */
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

  /**
   * Create a styled link element with no default binding.
   * Use `bindAddUrl` to add a click event to add the URL to the downloader.
   * Listens for custom events 'nzb.pending', 'nzb.success', and 'nzb.failure'
   * to update the icon.
   * @param param0.label The text to display next to the icon
   * @param param0.styles Additional styles to apply to the link
   */
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

  /**
   * Create a styled button element with no default binding.
   * Use `bindAddUrl` to add a click event to add the URL to the downloader.
   * Listens for custom events 'nzb.pending', 'nzb.success', and 'nzb.failure'
   * to update the icon.
   * @param param0.context The context of the button, used for setting the text and title.
   *                       Use 'list' to show 'Download Selected', a custom label, or empty for 'Download NZB'
   * @param param0.styles Additional styles to apply to the button
   * @param element The element to create, either 'button' or 'a'
   */
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
        btn.textContent = context || 'Download NZB';
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

  /**
   * Combines `createLink` and `bindAddUrl` to create a styled link element
   * with a click event to add the URL to the downloader.
   * @param param0.url The URL to add
   * @param param0.category (optional) The category to add the URL to
   * @param param0.adjacent (optional) The element to insert the link after
   * @param param0.linkOptions Additional options to pass to `createLink`
   */
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
    // console.debug(`${this.name}.createAddUrlLink`, url, category, adjacent, linkOptions);
    const a = this.bindAddUrl(this.createLink(linkOptions), url, category);
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

  /**
   * Combines `createButton` and `bindAddUrl` to create a styled button element
   * with a click event to add the URL to the downloader.
   * @param param0.url The URL to add
   * @param param0.category (optional) The category to add the URL to
   * @param param0.adjacent (optional) The element to insert the button after
   * @param param0.buttonOptions Additional options to pass to `createButton`
   */
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
    // console.debug(`${this.name}.createAddUrlButton`, url, category, adjacent, buttonOptions);
    const btn = this.bindAddUrl(this.createButton(buttonOptions), url, category);

    if (adjacent) {
      adjacent.insertAdjacentElement('afterend', btn);
    }

    return btn;
  }
}
