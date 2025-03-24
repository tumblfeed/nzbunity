import { defineBackground } from 'wxt/sandbox';

import { Client } from '@/Client';
import { DownloaderType } from '@/store';
import { setMenuIcon } from '@/utils';

import { Logger } from '@/logger';
const logger = new Logger('Background');

export default defineBackground(() => {
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
