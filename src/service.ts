// TODO: Remove this file when the options page is ready
import '@/dev';
// END TODO

import { useState, useEffect } from 'react';
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
 * Hook to get a reactive set of options from the store.
 */
export function useOptions(): [
  NZBUnityOptions | undefined,
  typeof setOptions,
  typeof setActiveDownloader,
] {
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

  return [options, setOptions, setActiveDownloader];
}

/**
 * Hook with boolean to check if the component is the first render.
 * Useful to skip useEffect effects on the first render.
 */
export function useIsFirstRender() {
  const isFirstRender = useRef(true);

  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  return isFirstRender.current;
}
