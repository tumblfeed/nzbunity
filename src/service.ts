import { useState, useEffect } from 'react';
import { NZBQueue, type Downloader } from './downloader';
import { SABnzbd } from './downloader/SABnzbd';
import { NZBGet } from './downloader/NZBGet';
import {
  getOptions,
  setOptions,
  watchOptions,
  removeWatcher,
  DownloaderType,
  getActiveDownloader,
  setActiveDownloader,
  setDownloaders,
  watchActiveDownloader,
  type DownloaderOptions,
  type NZBUnityOptions,
} from './store';

import { Logger } from './logger';
const logger = new Logger('service');

export const downloaders = {
  [DownloaderType.SABnzbd]: SABnzbd,
  [DownloaderType.NZBGet]: NZBGet,
};

export const newDownloader = (opts?: DownloaderOptions) => {
  return opts?.Type && downloaders[opts.Type]
    ? new downloaders[opts.Type](opts)
    : undefined;
};

await (async () => {
  if (import.meta.env.DEV) {
    await Logger.clear();
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
})();

/**
 * Hook to get the options from the store
 */
export function useOptions(): [NZBUnityOptions | undefined, typeof setOptions] {
  const [options, setOptionsState] = useState<NZBUnityOptions | undefined>(undefined);

  const initOptions = async () => {
    const opts = await getOptions();
    setOptionsState(opts);
  };

  // Watch options to set state
  // Calls to the store's setOptions will trigger then chain to this state
  const handleOptionsChange = (changes: {
    [key: string]: chrome.storage.StorageChange;
  }) => {
    setOptionsState((prev) => {
      if (!prev) return prev;

      const newOptions: NZBUnityOptions = { ...prev };
      for (const [key, change] of Object.entries(changes)) {
        Object.assign(newOptions, { [key]: change.newValue });
      }
      return newOptions;
    });
  };

  useEffect(() => {
    initOptions();
    const watcher = watchOptions(handleOptionsChange);

    return () => {
      removeWatcher(watcher);
    };
  }, []);

  return [options, setOptions];
}

/**
 * Hook to get the active downloader
 */
export function useDownloader(): [
  {
    client: Downloader | undefined;
    queue: NZBQueue | undefined;
    getQueue: () => Promise<void>;
  },
  typeof setActiveDownloader,
] {
  const [options] = useOptions();

  // Downloader: state, init, and watcher

  const [client, setClient] = useState<Downloader | undefined>(undefined);

  const initDownloader = async () => {
    setClient(newDownloader(await getActiveDownloader()));
  };

  useEffect(() => {
    initDownloader();

    const watcher = watchActiveDownloader((opts) => {
      setClient(newDownloader(opts));
    });

    return () => {
      removeWatcher(watcher);
    };
  }, []);

  // Queue

  const [queue, setQueue] = useState<NZBQueue | undefined>(undefined);

  const getQueue = async () => {
    const res = await client?.getQueue();
    logger.skip('getQueue', client, res);
    setQueue(res);
  };

  let timer: NodeJS.Timeout | undefined = undefined;
  useEffect(() => {
    getQueue();

    // Update queue every on a timer (default 10s)
    if (timer) clearInterval(timer);
    timer = setInterval(getQueue, (options?.RefreshRate || 10) * 1000);

    return () => {
      clearInterval(timer);
    };
  }, [client, options]);

  return [
    {
      client,
      queue,
      getQueue,
    },
    setActiveDownloader,
  ];
}
