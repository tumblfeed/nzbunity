import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.nzbking.com/*'],

  main() {
    console.log('Hello nzbking.com.');
  },
});
