import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.althub.co.za/*'],

  main() {
    console.log('Hello althub.co.za.');
  },
});
