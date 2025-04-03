// Uncomment the following line to use dev options override
import '~/dev';

import { useState, useEffect } from 'react';
import {
  getOptions,
  setOptions,
  watchOptions,
  removeWatcher,
  setActiveDownloader,
  type NZBUnityOptions,
} from '~/store';

import { Logger, type LogEntries } from '~/logger';
// const logger = new Logger('Service');

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

/**
 * Hook to use the logger with reactive entries, formatted entries, and log methods
 */
export function useLogger(
  group?: string,
  refresh: number = 5,
): {
  entries: LogEntries;
  group: LogEntries;
  log: Logger['log'];
  debug: Logger['debug'];
  error: Logger['error'];
  skip: Logger['skip'];
} {
  const logger = new Logger(group);

  const [entries, setEntries] = useState<LogEntries>([]);
  const groupEntries = useMemo(
    () => entries.filter((entry) => entry.group === group),
    [entries, group],
  );

  const updateEntries = async () => {
    const newEntries = await Logger.get(); // Get all entries and use memo to filter
    setEntries(newEntries);
  };

  let timer: NodeJS.Timeout | undefined = undefined;

  useEffect(() => {
    updateEntries();

    if (timer) clearInterval(timer);
    timer = setInterval(updateEntries, refresh * 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return {
    entries,
    group: groupEntries,
    log: (message: string, ...dump: unknown[]) => logger.log(message, ...dump),
    debug: (message: string, ...dump: unknown[]) => logger.debug(message, ...dump),
    error: (message: string, ...dump: unknown[]) => logger.error(message, ...dump),
    skip: (message: string, ...dump: unknown[]) => logger.skip(message, ...dump),
  };
}
