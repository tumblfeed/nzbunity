import { defineBackground } from 'wxt/sandbox';

import { Client } from '~/Client';
import { Logger, LogStorage } from '~/logger';
import { getOptions, DefaultOptions, DownloaderType } from '~/store';
import { setMenuIcon } from '~/utils';

export default defineBackground(() => {
  const logger = new Logger('Background');
  logger.debug(`Background running ${browser.runtime.id}`);

  // Handle commands
  browser.commands.onCommand.addListener((command: string, tab: chrome.tabs.Tab) => {
    switch (command) {
      case 'toggle-queue':
        const client = Client.getInstance();
        client.getDownloader().then(() => {
          if (client.isDownloading()) {
            client.pauseQueue();
          } else {
            client.resumeQueue();
          }
        });
        break;

      case 'open-web-ui':
        Client.getInstance().openWebUI();
        break;

      case 'activate-newznab':
        getOptions().then((options) => {
          if (tab.id && (options.EnableNewznab ?? DefaultOptions.EnableNewznab)) {
            browser.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content-scripts/newznab.js'],
            });
          }
        });
        break;
    }
  });

  // Listen for messages from  content scripts
  browser.runtime.onMessage.addListener(
    (message: MessageEvent, sender: any, sendResponse: (response: any) => void) => {
      // console.log('onMessage', message, sender);
      for (const [key, data] of Object.entries(message)) {
        try {
          switch (key) {
            case 'log':
              LogStorage.add(data.entry, ...(data.dump ?? [])).then(sendResponse);
              break;

            case 'getLog':
              LogStorage.get().then(sendResponse);
              break;

            case 'clearLog':
              LogStorage.clear().then(sendResponse);
              break;

            case 'addUrl':
              if (!data.url)
                return sendResponse({ success: false, error: 'No URL provided' });

              Client.getInstance()
                .ready()
                .then((client) => client.addUrl(data.url, data.options ?? {}))
                .then(sendResponse);
              break;

            case 'addFile':
              if (!data.filename || !data.content)
                return sendResponse({
                  success: false,
                  error: 'No filename or content provided',
                });

              Client.getInstance()
                .ready()
                .then((client) =>
                  client.addFile(data.filename, data.content, data.options ?? {}),
                )
                .then(sendResponse);
              break;

            default:
              throw Error(`Unknown message: ${key}`, data);
          }
        } catch (err) {
          console.warn(err);
          LogStorage.add(
            {
              group: 'Background',
              level: 'error',
              message: `Unknown message: ${key}`,
            },
            data,
          );
        }
      }

      return true;
    },
  );

  // Watch for changes to status and set the menu icon
  Client.getInstance().addRefreshListener((client: Client) => {
    if (client.isDownloading()) {
      // Set the icon based on the downloader type
      setMenuIcon(
        client.type === DownloaderType.SABnzbd ? 'orange' : 'green',
        `${client.status} (${client.name})`,
        client.queue.length > 0 ? client.queue.length.toString() : undefined,
      );
    } else {
      setMenuIcon('inactive', client.status);
    }
  });
});
