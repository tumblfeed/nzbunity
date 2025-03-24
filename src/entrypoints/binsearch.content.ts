import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.binsearch.info/*'],

  main() {
    console.log('Hello binsearch.info.');
  },
});
