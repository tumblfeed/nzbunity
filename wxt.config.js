import { defineConfig } from 'wxt';
// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // Emits .wxt/eslint-auto-imports.json so eslint.config.js can declare the
  // WXT auto-import globals instead of hand-maintaining a stale list.
  imports: { eslintrc: { enabled: true } },
  manifest: {
    permissions: [
      // "<all_urls>",
      'activeTab',
      'notifications',
      'scripting',
      'storage',
      'tabs',
      'webRequest',

      // "webRequestBlocking",
    ],
    commands: {
      _execute_action: {
        description: 'Open the popup',
        suggested_key: {
          default: 'Alt+Shift+U',
        },
      },
      'toggle-queue': {
        description: 'Toggle queue',
      },
      'open-web-ui': {
        description: 'Open downloader web UI',
      },
      'activate-newznab': {
        description: 'Add 1-click actions to the current Newznab page',
        suggested_key: {
          default: 'Alt+Shift+N',
        },
      },
    },
  },
});
