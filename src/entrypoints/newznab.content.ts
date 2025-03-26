import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.nzbgeek.info/*'],

  main() {
    console.log('Hello nzbgeek.info.');
  },
});
