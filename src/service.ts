import { useState, useEffect } from "react";
import { type Downloader } from "./downloader";
import { SABnzbd } from "./downloader/SABnzbd";
import { NZBGet } from "./downloader/NZBGet";
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
} from "./store";

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
    console.log("Service loaded, setting up default options...");
    const opts = await getOptions();

    if (Object.keys(opts.Downloaders).length === 0) {
      console.log("No downloaders found, setting up default options...");
      await setDownloaders([
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
      ]);
    }
  }
})();

/**
 * Hook to get the options from the store
 */
export function useOptions(): [ NZBUnityOptions | undefined, typeof setOptions ] {
  const [options, setOptionsState] = useState<NZBUnityOptions | undefined>(undefined);

  const initOptions = async () => {
    const opts = await getOptions();
    setOptionsState(opts);
  };

  // Watch options to set state
  // Calls to the store's setOptions will trigger then chain to this state
  const handleOptionsChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    setOptionsState(prev => {
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

  return [
    options,
    setOptions,
  ];
}

/**
 * Hook to get the active downloader
 */
export function useDownloader(): [ Downloader | undefined, typeof setActiveDownloader, string[] ] {
  // Downloader: state, init, and watcher

  const [downloader, setDownloader] = useState<Downloader | undefined>(undefined);

  const initDownloader = async () => {
    setDownloader(newDownloader(await getActiveDownloader()));
  };

  useEffect(() => {
    initDownloader();

    const watcher = watchActiveDownloader(opts => {
      setDownloader(newDownloader(opts));
    });

    return () => {
      removeWatcher(watcher);
    };
  }, []);

  // Categories

  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    downloader?.getCategories().then(setCategories);
  }, [downloader]);







  return [
    downloader,
    setActiveDownloader,
    categories,
  ];
}