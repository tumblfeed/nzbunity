import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.nzbindex.com/*', '*://*.nzbindex.nl/*'],

  main() {
    console.log('Hello content.');
  },
});
