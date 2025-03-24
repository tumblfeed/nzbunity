import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.nzb.su/*'],

  main() {
    console.log('Hello nzb.su.');
  },
});
