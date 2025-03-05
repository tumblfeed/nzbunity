import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: [
      // "<all_urls>",
      "notifications",
      "storage",
      "tabs",
      "webRequest",
      // "webRequestBlocking",
    ],
  },
});
