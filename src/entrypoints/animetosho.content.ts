import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.animetosho.org/*'],

  main() {
    console.log('Hello animetosho.org.');
  },
});
