import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.gingadaddy.com/*'],

  main() {
    console.log('Hello gingadaddy.com.');
  },
});
