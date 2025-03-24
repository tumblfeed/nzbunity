import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.drunkenslug.com/*'],

  main() {
    console.log('Hello drunkenslug.com.');
  },
});
