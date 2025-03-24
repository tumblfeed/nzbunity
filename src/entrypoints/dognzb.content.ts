import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.dognzb.cr/*'],

  main() {
    console.log('Hello dognzb.cr.');
  },
});
