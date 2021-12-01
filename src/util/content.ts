import browser from 'webextension-polyfill';
import { FlatDictionary } from './interfaces';
import { CreateAddLinkOptions, request } from '.';

export const iconGreen: string = browser.runtime.getURL('content/images/nzb-16-green.png');
export const iconGrey: string = browser.runtime.getURL('content/images/nzb-16-grey.png');
export const iconOrange: string = browser.runtime.getURL('content/images/nzb-16-orange.png');
export const iconRed: string = browser.runtime.getURL('content/images/nzb-16-red.png');
export const backgroundNormal: string = 'rgb(23, 162, 184)';
export const backgroundPending: string = 'rgb(156, 166, 168)';

export { request };

export function ready(callback: () => void): void {
  if (document.readyState != 'loading'){
    callback();
  } else {
    document.addEventListener('DOMContentLoaded', callback);
  }
}

export function addFileByRequest(
  filename: string,
  category: string = '',
  url: string = window.location.origin,
  params: FlatDictionary = {},
): Promise<any> {
  // A lot of sites require POST to fetch NZB and follow this pattern (binsearch, nzbindex, nzbking)
  // Fetches a single NZB from a POST request and adds it to the server as a file upload
  return request({ method: 'POST', url, params })
    .then(content => browser.runtime.sendMessage({
      'content.addFile': { filename, content, category }
    }));
}

export function bindAddUrl(
  options: CreateAddLinkOptions,
  el: HTMLElement,
  exclusive: boolean = false,
): HTMLElement {
  el.addEventListener('click', (event) => {
    event.preventDefault();
    console.info(`[NZB Unity] Adding URL: ${options.url}`);

    el.dispatchEvent(new Event('nzb.pending'));

    browser.runtime.sendMessage({ 'content.addUrl': options })
      .then((rsp:boolean) => {
        setTimeout(() => {
          el.dispatchEvent(new Event(rsp === false ? 'nzb.failure' : 'nzb.success'));
        }, 500);
      });
  }, {
    capture: Boolean(exclusive)
  });

  return el;
}

export function createLink(): HTMLElement {
  const a = document.createElement('a');
  a.classList.add('NZBUnityLink');
  a.setAttribute('title', 'Download with NZB Unity');
  a.insertAdjacentHTML('afterbegin', `<img src="${iconGreen}">`);

  Object.assign(a.style, {
    cursor: 'pointer',
    display: 'inline-block',
  });

  a.addEventListener('nzb.pending', () => a.children[0].setAttribute('src', iconGrey));
  a.addEventListener('nzb.success', () => a.children[0].setAttribute('src', iconGreen));
  a.addEventListener('nzb.failure', () => a.children[0].setAttribute('src', iconRed));

  return a;
}

export function createButton(): HTMLElement {
  const btn = document.createElement('a');
  btn.classList.add('NZBUnityDownloadAll');
  btn.setAttribute('title', 'Download selected items with NZB Unity');
  btn.insertAdjacentText('afterbegin', 'Download Selected');

  Object.assign(btn.style, {
    background: `${backgroundNormal} url(${iconGreen}) no-repeat scroll 4px center`,
    border: '1px solid rgb(19, 132, 150)',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    display: 'inline-block',
    fontSize: '11px',
    fontWeight: 'normal',
    margin: '0 0.5em 0 0',
    padding: '3px 8px 3px 25px',
    textShadow: '0 -1px 0 rgba(0,0,0,0.25)',
    whiteSpace: 'nowrap',
  });

  btn.addEventListener('nzb.pending', () => Object.assign(btn.style, {
    backgroundColor: backgroundPending,
    backgroundImage: `url(${iconGrey})`,
  }));

  btn.addEventListener('nzb.success', () => Object.assign(btn.style, {
    backgroundColor: backgroundNormal,
    backgroundImage: `url(${iconGreen})`,
  }));

  btn.addEventListener('nzb.failure', () => Object.assign(btn.style, {
    backgroundColor: backgroundNormal,
    backgroundImage: `url(${iconRed})`,
  }));

  return btn;
}

export function createAddUrlLink(
  options: CreateAddLinkOptions,
  adjacent: HTMLElement = null
): HTMLElement {
  // console.log('createAddUrlLink', url, category);
  const a = bindAddUrl(options, createLink());
  a.setAttribute('href', options.url);

  Object.assign(a.style, {
    height: '16px',
    width: '16px',
  });

  if (adjacent) {
    adjacent.insertAdjacentElement('afterend', a);
  }

  return a;
}

export function createAddUrlButton(
  options: CreateAddLinkOptions,
  adjacent: HTMLElement = null
): HTMLElement {
  // console.log('createAddUrlLink', url, category);
  const btn = bindAddUrl(options, createButton());

  if (adjacent) {
    adjacent.insertAdjacentElement('afterend', btn);
  }

  return btn;
}
