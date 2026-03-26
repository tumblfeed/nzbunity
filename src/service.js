// Uncomment the following line to use dev options override
// import '~/dev';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  getOptions,
  setOptions,
  watchOptions,
  removeWatcher,
  setActiveDownloader,
} from '~/store';
import { Logger } from '~/logger';
// const logger = new Logger('Service');

/**
 * Hook to get a reactive set of options from the store.
 * @returns {[NZBUnityOptions | undefined, typeof setOptions, typeof setActiveDownloader]}
 */
export function useOptions() {
  const [options, setOptionsState] = useState(undefined);
  const initOptions = async () => {
    const opts = await getOptions();
    setOptionsState(opts);
  };

  // Watch options to set state
  // Calls to the store's setOptions will trigger then chain to this state
  const handleOptionsChange = (changes) => {
    setOptionsState((prev) => {
      if (!prev) return prev;
      const newOptions = { ...prev };
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
 * @param {string} group
 * @param {number} [refresh] Refresh interval in seconds
 */
export function useLogger(group, refresh = 5) {
  const logger = new Logger(group);
  const [entries, setEntries] = useState([]);
  const groupEntries = useMemo(
    () => entries.filter((entry) => entry.group === group),
    [entries, group],
  );

  const updateEntries = async () => {
    const newEntries = await Logger.get(); // Get all entries and use memo to filter
    setEntries(newEntries);
  };
  let timer = undefined;
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
    log: (message, ...dump) => logger.log(message, ...dump),
    debug: (message, ...dump) => logger.debug(message, ...dump),
    error: (message, ...dump) => logger.error(message, ...dump),
    skip: (message, ...dump) => logger.skip(message, ...dump),
  };
}
