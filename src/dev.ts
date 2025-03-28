/**
 * Development helper script to set up default options for the extension.
 * Include this script in the from an entrypoint script (or store.ts) and
 * set WXT_DEV_OPTIONS to true in .env.local
 */
import { SABnzbd } from '~/downloader/SABnzbd';
import { NZBGet } from '~/downloader/NZBGet';
import { getOptions, DownloaderType, setDownloaders, setOptions } from '~/store';

import { Logger } from '~/logger';
const logger = new Logger('dev');

export const downloaders = {
  [DownloaderType.SABnzbd]: SABnzbd,
  [DownloaderType.NZBGet]: NZBGet,
};

async function initDevelopmentOptions() {
  if (import.meta.env.DEV && import.meta.env.WXT_DEV_OPTIONS) {
    // await Logger.clear();
    logger.debug('Service loaded, setting up default options...');
    const opts = await getOptions();

    if (import.meta.env.WXT_RESET_OPTS || Object.keys(opts.Downloaders).length === 0) {
      const dlopts = [
        {
          Name: 'Default',
          Type: DownloaderType.SABnzbd,
          ApiUrl: import.meta.env.WXT_SABNZBD_APIURL,
          ApiKey: import.meta.env.WXT_SABNZBD_APIKEY,
          Username: null,
          Password: null,
          WebUrl: null,
        },
        {
          Name: 'NZBGet',
          Type: DownloaderType.NZBGet,
          ApiUrl: import.meta.env.WXT_NZBGET_APIURL,
          ApiKey: null,
          Username: import.meta.env.WXT_NZBGET_USER,
          Password: import.meta.env.WXT_NZBGET_PASS,
          WebUrl: null,
        },
      ];

      await Promise.all(
        dlopts.map(
          async (dlopt) =>
            (dlopt.ApiUrl =
              (await downloaders[dlopt.Type].findApiUrl(dlopt)) ?? dlopt.ApiUrl),
        ),
      );

      logger.skip('No downloaders found, setting up default options...', dlopts);

      await setDownloaders(dlopts);
    }
  }
}
initDevelopmentOptions();
