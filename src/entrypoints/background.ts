import { defineBackground } from 'wxt/sandbox';

import { Client } from '@/Client';
import { Logger, LogStorage } from '@/logger';
import { DownloaderType } from '@/store';
import { setMenuIcon } from '@/utils';

export default defineBackground(() => {
  // Listen for messages from the content script
  browser.runtime.onMessage.addListener(
    (message: MessageEvent, sender: any, sendResponse: (response: any) => void) => {
      console.log('onMessage', message, sender);

      for (const [key, data] of Object.entries(message)) {
        try {
          switch (key) {
            case 'log':
              LogStorage.add(data.entry, ...(data.dump ?? [])).then((lol) => {
                console.log('log', lol);
                sendResponse(lol);
              });
              break;

            case 'getLog':
              LogStorage.get().then(sendResponse);
              break;

            case 'clearLog':
              LogStorage.clear().then(sendResponse);
              break;

            default:
              throw new Error(`Unknown message: ${key}`, data);
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

  const logger = new Logger('Background');
  logger.debug(`Background running ${browser.runtime.id}`);

  // Watch for changes to status and set the menu icon
  Client.getInstance().addRefreshListener((client: Client) => {
    if (client.isDownloading()) {
      // Set the icon based on the downloader type
      setMenuIcon(
        client.type === DownloaderType.SABnzbd ? 'orange' : 'green',
        client.status,
      );
    } else {
      setMenuIcon('inactive', client.status);
    }
  });
});
