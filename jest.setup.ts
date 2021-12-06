import browser from 'webextension-polyfill';
import consola from 'consola';

consola.wrapAll();

// Mock getManifest
browser.runtime.getManifest = jest.fn(() => ({
  manifest_version: 2,
  name: 'NZB Unity',
  version: '2.0.0',
  content_scripts: [
    {
      matches: ['*://*.althub.co.za/*', '*://*.binsearch.info/*', '*://*.dognzb.cr/*'],
      js: ['background/util.js'],
      run_at: 'document_start',
    },
    {
      matches: ['*://*.althub.co.za/*'],
      js: ['content/sites/althub.js'],
    },
    {
      matches: ['*://*.binsearch.info/*'],
      js: ['content/sites/binsearch.js'],
    },
    {
      matches: ['*://*.dognzb.cr/*'],
      js: ['content/sites/dognzb.js'],
    },
  ],
}));
