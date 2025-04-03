import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  extensionApi: 'chrome',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: [
      // "<all_urls>",
      'notifications',
      'storage',
      'tabs',
      'webRequest',
      // "webRequestBlocking",
    ],
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Ctrl+Shift+U',
          mac: 'Command+Shift+U',
        },
        description: 'Open the popup',
      },
      'toggle-queue': {
        description: 'Toggle queue',
      },
      'open-web-ui': {
        description: 'Open downloader web UI',
      },
    },
  },
});
