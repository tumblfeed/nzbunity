import browser from 'webextension-polyfill';

// Mock getManifest
browser.runtime.getManifest = jest.fn(() => ({
  manifest_version: 2,
  name: 'NZB Unity',
  version: '2.0.0',
}));
