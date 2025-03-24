import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.nzbserver.com/*'],

  main() {
    console.log('Hello nzbserver.com.');
  },
});
