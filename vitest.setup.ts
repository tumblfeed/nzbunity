// Disable the same-origin policy for fetch requests in tests (route-info doesn't allow CORS requests)
import type DetachedWindowAPI from 'happy-dom/lib/window/DetachedWindowAPI.js';
(globalThis.happyDOM as DetachedWindowAPI).settings.fetch.disableSameOriginPolicy = true;

Object.defineProperty(browser.runtime, 'getManifest', {
  value: () => ({
    version: '2.0.0-test.0',
    content_scripts: [
      {
        matches: ['*://*.example.com/*'],
        js: ['sites/example.ts'],
      },
      {
        matches: ['*://*.lol.lmao/*'],
        js: ['sites/lol.ts'],
      },
    ],
  }),
});

// Catch all messages to prevent errors in tests (this is mostly logging, so will need to implement addUrl / addFile if needed for a test)
browser.runtime.onMessage.addListener(
  (message: MessageEvent, sender: any, sendResponse: (response: any) => void) => {},
);
