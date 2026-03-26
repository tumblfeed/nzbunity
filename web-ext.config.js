import { defineWebExtConfig } from 'wxt';

export default defineWebExtConfig({
  binaries: {
    chrome: 'chromium',
    firefox: 'firefox-developer-edition',
  },
  startUrls: [''],
  openConsole: true,
});
