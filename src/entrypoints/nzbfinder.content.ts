import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.nzbfinder.ws/*'],

  main() {
    console.log('Hello nzbfinder.ws.');
  },
});
