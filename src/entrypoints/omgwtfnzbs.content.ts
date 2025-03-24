import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.omgwtfnzbs.org/*'],

  main() {
    console.log('Hello omgwtfnzbs.org.');
  },
});
