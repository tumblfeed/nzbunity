import { defineContentScript } from 'wxt/sandbox';

export default defineContentScript({
  matches: ['*://*.tabula-rasa.pw/*'],

  main() {
    console.log('Hello tabula-rasa.pw.');
  },
});
