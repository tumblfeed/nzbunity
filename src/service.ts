import '@/dev';

import { useState, useEffect } from 'react';
import { Client } from '@/Client';
import {
  getOptions,
  setOptions,
  watchOptions,
  removeWatcher,
  setActiveDownloader,
  type NZBUnityOptions,
} from '@/store';

import { Logger } from '@/logger';
const logger = new Logger('Service');

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
export function useClient(): [Client | undefined, typeof setActiveDownloader] {
  // const [options] = useOptions();

  const [client, setClient] = useState<Client | undefined>(undefined);

  const initClient = async () => {
    const q = new Client();
    await q.ready;
    setClient(q);
  };

  useEffect(() => {
    logger.log('initQueue useEffect');
    initClient();

    return () => {
      logger.log('initQueue cleanup');
      client?.removeWatcher();
    };
  }, []);

  return [client, setActiveDownloader];
}
