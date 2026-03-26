import { browser } from 'wxt/browser';
import { Logger } from '~/logger';
import { getOptions, DefaultIndexers } from '~/store';
import { request } from '~/utils';
import '~/assets/content.css';
export { request } from '~/utils';
export class ContentDisabledError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContentDisabledError';
  }
}

export const classLight = 'NZBUnityLight';
export class Content {
  ctx;

  /**
   * ID of the indexer, matching the key in options.Indexers
   * This is used to get options, and to get the display name for logging.
   * Must be a function so that it can be overridden in subclasses.
   */
  get id() {
    return '';
  }

  get name() {
    if (typeof this.indexerOptions?.Display === 'string')
      return this.indexerOptions.Display;
    return DefaultIndexers[this.id]?.Display ?? this.id;
  }

  logger = new Logger(this.name);

  debug(...args) {
    if (import.meta.env.DEV) console.debug(...args);
  }

  // Options
  // Override in subclasses to set the light theme
  get useLightTheme() {
    return false;
  }

  indexerOptions = undefined;

  replaceLinks = false;

  // Commonly used property accessors, override in subclasses to provide various behavior
  get isList() {
    return false;
  }

  get isDetail() {
    return false;
  }

  _uid = ''; // Can set this in ready() instead of using accessor
  get uid() {
    return this._uid;
  }

  _apikey = '';

  get apikey() {
    return this._apikey;
  }

  _apiurl = '';

  get apiurl() {
    return this._apiurl;
  }

  /**
   * Given an ID, returns the URL to fetch the NZB file,
   * typically passed to the downloader on link click.
   * eg. `${window.location.origin}/download/${id}`
   * @param {string} id
   * @returns {string}
   */
  getNzbUrl(id) {
    return id;
  }

  /**
   * Get a meta tag by name returning the value of the attribute.
   * @param {string} name
   * @param {string} [attr]
   * @returns {string | undefined}
   */
  getMeta(name, attr = 'content') {
    return (
      document.querySelector(`meta[name="${name}"]`)?.getAttribute(attr) ?? undefined
    );
  }

  /**
   * Create a new content script instance.
   * @param ctx
   */
  constructor(ctx) {
    this.ctx = ctx;
    if (!this.id) {
      throw Error('Indexer id must be defined in subclass');
    }
    getOptions()
      .then((options) => {
        this.replaceLinks = options.ReplaceLinks;
        if (this.id === 'newznab') {
          // Newznab is a special case, and should be enabled by default
          this.indexerOptions = {
            Display: 'Newznab',
            Enabled: options.EnableNewznab ?? true,
          };
        } else {
          // Check that the indexer is present and enabled
          if (!options.Indexers[this.id]) {
            throw Error(`Indexer key not found: ${this.id}`);
          }
          this.indexerOptions = options.Indexers[this.id];
        }
        if (!this.indexerOptions?.Enabled) {
          throw new ContentDisabledError(
            `[NZB Unity] 1-click functionality disabled for this site`,
          );
        }

        // Set page params
        if (this.useLightTheme) {
          document.documentElement.classList.add(classLight);
        }

        // All good, ready up
        console.info(`[NZB Unity] Initializing ${this.name} 1-click functionality...`);
        return this.ready();
      })
      .then((readyState) => {
        if (readyState === false) {
          throw new ContentDisabledError(
            `[NZB Unity] Ready failed, disabling ${this.name} content script`,
          );
        }

        // Ready succeeded, continue
        return this.onReady();
      })
      .then(() => {
        console.info(`[NZB Unity] ${this.name} initialized!`);

        // Initialize should be complete, add listeners
        this.ctx.onInvalidated(() => this.cleanup());
      })
      .catch((err) => {
        if (err instanceof ContentDisabledError) {
          console.warn(err.message);
          return;
        }

        // Otherwise, log the error
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
  ready() {
    return; // Default to no-op
  }

  /**
   * Called after `ready` if it does not return false.
   * See `ready` for more information.
   * Can be called manually if links need to be updated.
   */
  onReady() {
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
  initializeLinks;

  /**
   * If set, will be called when `this.isList` is true after `ready`
   * if `this.initializeLinks` is not set.
   */
  initializeListLinks;

  /**
   * If set, will be called when `this.isDetail` is true after `ready`
   * if `this.isList` is false or `this.initializeLinks` is not set.
   */
  initializeDetailLinks;

  /**
   * Given a selector, waits for the element to be present in the DOM
   * and resolves with the element.
   * @param {string} selector
   * @param {Document | Element} [root] The root element to search within
   * @param {number} [timeout]
   * @returns {Promise<Element>}
   */
  waitForQuerySelector(selector, root = document, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const interval = this.ctx.setInterval(() => {
        const el = root.querySelector(selector);
        if (el) {
          clearInterval(interval);
          resolve(el);
        }
      }, 100);
      if (timeout > 0) {
        this.ctx.setTimeout(() => {
          clearInterval(interval);
          reject(`Timed out waiting for ${selector}`);
        }, timeout);
      }
    });
  }

  /**
   * Given a selector, waits for the element to be present in the DOM
   * and resolves with all matching elements.
   * @param {string} selector
   * @param {Document | Element} [root] The root element to search within
   * @param {number} [timeout]
   * @returns {Promise<NodeList>}
   */
  waitForQuerySelectorAll(selector, root = document, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const interval = this.ctx.setInterval(() => {
        const els = root.querySelectorAll(selector);
        if (els.length) {
          clearInterval(interval);
          resolve(els);
        }
      }, 100);
      if (timeout > 0) {
        this.ctx.setTimeout(() => {
          clearInterval(interval);
          reject(`Timed out waiting for ${selector}`);
        }, timeout);
      }
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
    document.querySelectorAll('[class^="NZBUnity"]').forEach((el) => el.remove());
  }

  /**
   * Display a toast message on the page.
   * Useful for notifications that don't need to be desktop notifications.
   * @param {string} message
   * @param {number} [duration]
   */
  toast(message, duration = 5000) {
    const toast = document.createElement('div');
    toast.classList.add('NZBUnityToast');
    toast.insertAdjacentHTML('beforeend', message);
    document.body.appendChild(toast);
    if (duration > 0) {
      this.ctx.setTimeout(() => {
        toast.remove();
      }, duration);
    }
  }

  /**
   * Adds a URL to the downloader by sending a message to the background script.
   * @param {string} url
   * @param {NZBAddOptions} [options]
   * @returns {Promise<NZBAddUrlResult>}
   */
  async addUrl(url, options) {
    return await browser.runtime.sendMessage({
      addUrl: { url, options },
    });
  }

  /**
   * Adds a file to the downloader by sending a message to the background script.
   * @param {string} filename The name of the file to add
   * @param {string} content The content of the file
   * @param {NZBAddOptions} [options] Additional options to pass to the downloader
   * @returns {Promise<NZBAddUrlResult>}
   */
  async addFile(filename, content, options) {
    return await browser.runtime.sendMessage({
      addFile: { filename, content, options },
    });
  }

  /**
   * Adds a file to the downloader by fetching the NZB file content from a URL.
   * Used for sites that require a POST request to fetch the NZB file.
   * @param {string} filename The name of the file to add
   * @param {string} [category] The category to add the file to
   * @param {string} [url] The URL to fetch the NZB file content from
   * @param {Record<string, *>} [params] Additional parameters to pass to the fetch request
   * @param {string} [method] The HTTP method to use for the request (default: POST)
   * @returns {Promise<NZBAddUrlResult>}
   */
  async addFileByRequest(
    filename,
    category = '',
    url = window.location.origin,
    params = {},
    method = 'POST',
  ) {
    console.info(`[NZB Unity] Adding file: ${filename} ${url}`);

    // A lot of sites require POST to fetch NZB and follow this pattern (binsearch, nzbindex, nzbking)
    // Fetches a single NZB from a POST request and adds it to the server as a file upload
    const content = await request({ method, url, params });
    console.debug(`[NZB Unity] File content:`, content);
    return this.addFile(filename, content, {
      category,
    });
  }

  /**
   * Adds a URL to the downloader, dispatching progress events on the given element.
   * The element will receive a 'nzb.pending' event when the request is sent,
   * a 'nzb.success' event when the request is successful, and a 'nzb.failure' event
   * when the request fails.
   * A delay can be set to wait before dispatching the success or failure event,
   * as the request is very quick for localhost downloaders and immediate feedback can feel like a glitch.
   * @param {Element} notifyEl The element to dispatch events on
   * @param {string} url The URL to add
   * @param {string} [category] The category to add the URL to
   * @param {number} [delay] The delay before dispatching the success or failure event
   */
  async addUrlAndNotify(notifyEl, url, category = '', delay = 500) {
    console.info(`[NZB Unity] Adding URL: ${url}`);
    notifyEl?.dispatchEvent(new Event('nzb.pending'));
    const res = await this.addUrl(url, { category });

    // Delay the event to allow the icon to change; too fast feels like a glitch
    this.ctx.setTimeout(() => {
      notifyEl?.dispatchEvent(new Event(res?.success ? 'nzb.success' : 'nzb.failure'));
    }, delay || 0);
    return res;
  }

  /**
   * Binds a click event to the element to add a URL to the downloader.
   * The element will receive custom events 'nzb.pending' and 'nzb.success' or 'nzb.failure'.
   * @param {Element} el The element to watch for clicks
   * @param {string} url The URL to add
   * @param {string} [category] The category to add the URL to
   * @returns {Element}
   */
  bindAddUrl(el, url, category = '') {
    el.addEventListener(
      'click',
      (event) => {
        event.preventDefault();
        this.addUrlAndNotify(el, url, category);
      },
      false,
    );
    return el;
  }

  /**
   * Given a list of elements, extracts the ID and category from each element
   * and adds the URL to the downloader.
   * @param {string | NodeList | Element[]} els
   * @param {(el: Element) => string} getId
   * @param {(el: Element) => string} getCategory
   * @returns {Promise<NZBAddUrlResult[]>}
   */
  async addUrlsFromElements(els, getId, getCategory) {
    if (typeof els === 'string') {
      els = document.querySelectorAll(els);
    }
    if (els instanceof NodeList) {
      els = Array.from(els);
    }
    return await Promise.all(
      els.map((el) => {
        const id = getId(el);
        const url = this.getNzbUrl(id);
        const category = getCategory(el);
        console.info(`[NZB Unity] Adding URL ${id} with category ${category}`);
        return this.addUrl(url, { category });
      }),
    );
  }

  /**
   * Given a list of elements, extracts the ID and category from each element
   * and adds the URL to the downloader.
   * Dispatches custom events on the notifyEl element to indicate progress.
   * @param {Element} notifyEl
   * @param {string | NodeList | Element[]} els
   * @param {(el: Element) => string} getId
   * @param {(el: Element) => string} getCategory
   * @param {number} [delay]
   * @returns {Promise<NZBAddUrlResult[]>}
   */
  async addUrlsFromElementsAndNotify(notifyEl, els, getId, getCategory, delay = 500) {
    if (typeof els === 'string') {
      els = document.querySelectorAll(els);
    }
    if (els instanceof NodeList) {
      els = Array.from(els);
    }
    if (els.length) {
      console.info(`[NZB Unity] Adding ${els.length} NZB(s)`);
      notifyEl.dispatchEvent(new Event('nzb.pending'));
      try {
        const results = await this.addUrlsFromElements(els, getId, getCategory);
        this.ctx.setTimeout(() => {
          if (results.every((r) => r)) {
            notifyEl.dispatchEvent(new Event('nzb.success'));
          } else {
            notifyEl.dispatchEvent(new Event('nzb.failure'));
          }
        }, delay || 0);
        return results;
      } catch (err) {
        console.error(`[NZB Unity] Error adding URLs`, err);
        notifyEl.dispatchEvent(new Event('nzb.failure'));
        return [];
      }
    }
    return [];
  }

  /**
   * Create a styled link element with no default binding.
   * Use `bindAddUrl` to add a click event to add the URL to the downloader.
   * Listens for custom events 'nzb.pending', 'nzb.success', and 'nzb.failure'
   * to update the icon.
   * @param {Object} [options]
   * @param {string | boolean} [options.label] The text to display next to the icon
   * @param {Object} [options.styles] Additional styles to apply to the link
   * @param {string} [options.className]
   * @returns {HTMLAnchorElement}
   */
  createLink({ label, styles, className = 'NZBUnityLink' } = {}) {
    const a = document.createElement('a');
    a.title = 'Download with NZB Unity';
    if (className) a.className = className;
    if (label) {
      if (label === true) label = 'Download';
      a.insertAdjacentText('beforeend', ` ${label}`);
    }
    Object.assign(a.style, { ...styles });
    const setClass = (className) => {
      a.classList.remove('success', 'failure', 'pending', 'disabled');
      a.classList.add(className);
    };
    a.addEventListener('nzb.pending', () => setClass('pending'));
    a.addEventListener('nzb.success', () => setClass('success'));
    a.addEventListener('nzb.failure', () => setClass('failure'));
    return a;
  }

  /**
   * Create a styled button element with no default binding.
   * Use `bindAddUrl` to add a click event to add the URL to the downloader.
   * Listens for custom events 'nzb.pending', 'nzb.success', and 'nzb.failure'
   * to update the icon.
   * @param {Object} [options]
   * @param {string} [options.context] The context of the button ('list', 'selected', or custom label)
   * @param {Object} [options.styles] Additional styles to apply to the button
   * @param {string} [options.className]
   * @param {string} [options.element] The element to create, either 'button' or 'a'
   * @returns {HTMLElement}
   */
  createButton({
    context,
    styles,
    className = 'NZBUnityButton',
    element = 'button',
  } = {}) {
    const btn = document.createElement(element);
    if (className) btn.className = className;
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
    const setClass = (className) => {
      btn.classList.remove('success', 'failure', 'pending', 'disabled');
      btn.classList.add(className);
    };
    btn.addEventListener('nzb.pending', () => setClass('pending'));
    btn.addEventListener('nzb.success', () => setClass('success'));
    btn.addEventListener('nzb.failure', () => setClass('failure'));
    return btn;
  }

  /**
   * Combines `createLink` and `bindAddUrl` to create a styled link element
   * with a click event to add the URL to the downloader.
   * @param {Object} options
   * @param {string} options.url The URL to add
   * @param {string} [options.category] The category to add the URL to
   * @param {Element} [options.adjacent] The element to insert the link after
   * @param {Object} [options.linkOptions] Additional options to pass to `createLink`
   * @returns {HTMLAnchorElement}
   */
  createAddUrlLink({ url, category = '', adjacent, linkOptions }) {
    // console.debug(`${this.name}.createAddUrlLink`, url, category, adjacent, linkOptions);
    const a = this.createLink(linkOptions);
    this.bindAddUrl(a, url, category);
    a.setAttribute('href', url);
    if (adjacent) {
      adjacent.insertAdjacentElement('afterend', a);
    }
    return a;
  }

  /**
   * Combines `createButton` and `bindAddUrl` to create a styled button element
   * with a click event to add the URL to the downloader.
   * @param {Object} options
   * @param {string} options.url The URL to add
   * @param {string} [options.category] The category to add the URL to
   * @param {Element} [options.adjacent] The element to insert the button after
   * @param {Object} [options.buttonOptions] Additional options to pass to `createButton`
   * @returns {HTMLElement}
   */
  createAddUrlButton({ url, category = '', adjacent, buttonOptions }) {
    // console.debug(`${this.name}.createAddUrlButton`, url, category, adjacent, buttonOptions);
    const btn = this.createButton(buttonOptions);
    this.bindAddUrl(btn, url, category);
    if (adjacent) {
      adjacent.insertAdjacentElement('afterend', btn);
    }
    return btn;
  }

  /**
   * Given an element or selector for an element, extracts the category from the text content.
   * If `firstWord` is true, only the first word is returned.
   * @param {Element | string | null} el
   * @param {boolean} [firstWord]
   * @returns {string}
   */
  extractCategory(el, firstWord = true) {
    if (!el) return '';
    if (typeof el === 'string') {
      el = document.querySelector(el);
    }
    let category = el.textContent ?? '';
    if (firstWord) {
      [, category] = category.match(/^(\w+)/) ?? [, ''];
    }
    return category.trim();
  }
}
