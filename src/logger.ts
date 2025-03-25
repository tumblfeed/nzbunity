import { useState, useEffect } from 'react';
import { isContentScript, sendMessage } from '@/utils';

export interface LogEntry {
  level: 'debug' | 'log' | 'error';
  group?: string;
  message: string;
  timestamp: number;
}
export interface LogEntryFormatted extends LogEntry {
  formatted: string;
}
export type LogEntryParam = Omit<LogEntry, 'timestamp'>;
export type LogEntries = LogEntryFormatted[];

const LOG_MAX_ENTRIES = 1000;
const LOG_STORAGE_KEY = 'logEntries';

/**
 * Used from the background script to store log entries.
 * Entries can be retrieved, added, and cleared using the webext messaging API.
 */
export class LogStorage {
  static async get(): Promise<LogEntries> {
    const entries: LogEntry[] = (
      await browser.storage.session.get({ [LOG_STORAGE_KEY]: [] })
    )[LOG_STORAGE_KEY];
    // return the formatted entries
    return entries.map((entry) => ({
      ...entry,
      formatted: this.format(entry),
    }));
  }

  static async add(entry: LogEntryParam, ...dump: unknown[]): Promise<LogEntries> {
    // If WXT_LOG_LEVEL is not debug, skip debug logs
    if (
      entry.level === 'debug' &&
      import.meta.env.WXT_LOG_LEVEL?.toLowerCase() !== 'debug'
    ) {
      return await this.get();
    }

    // Get the current entries, remove formatting, add the new entry
    let entries = (await this.get())
      .map((entry) => {
        const { formatted, ...rest } = entry;
        return rest;
      })
      .concat({ ...entry, timestamp: Date.now() });

    // Because there could be multiple message sources, sort, prune, and save
    entries = entries
      .toSorted((a, b) => a.timestamp - b.timestamp)
      .slice(-LOG_MAX_ENTRIES);

    await browser.storage.session.set({ [LOG_STORAGE_KEY]: entries });

    // For convenience, echo to console as well and add any dump data
    this.dump(`[${entry.group ?? '::'}] ${entry.message}`, dump);

    // Return the new entries
    return await this.get();
  }

  static dump(message: string, dump: unknown[]): void {
    if (dump.length) console.group(message);
    else console.debug(message);
    for (const data of dump) {
      if (data === console.trace || data === 'trace') console.trace();
      else console.debug(data);
    }
    if (dump.length) console.groupEnd();
  }

  static async clear(): Promise<LogEntries> {
    await browser.storage.session.remove(LOG_STORAGE_KEY);
    return [];
  }

  static format(entry: LogEntry): string {
    const [time24] = entry?.timestamp
      ? new Date(entry.timestamp).toTimeString().split(' ')
      : ['00:00:00'];
    return `[${time24}] ${entry.group ?? 'root'}::${entry.level.toUpperCase()} - ${
      entry.message
    }`;
  }
}

export class Logger {
  static async get(): Promise<LogEntries> {
    // If we're in a content script, use sendMessage
    if (isContentScript()) {
      console.debug('content script, using sendMessage');
      return await sendMessage({ getLog: true });
    } else {
      return await LogStorage.get();
    }
  }

  static async add(entry: LogEntryParam, ...dump: unknown[]): Promise<LogEntries> {
    // If we're in a content script, use sendMessage
    if (isContentScript()) {
      return await sendMessage({ log: { entry, dump } });
    } else {
      return await LogStorage.add(entry, ...dump);
    }
  }

  group?: string;

  constructor(group?: string) {
    this.group = group;
  }

  async get(): Promise<LogEntries> {
    // Filter the entries by group
    return (await Logger.get()).filter((entry) => entry.group === this.group);
  }

  async add(entry: LogEntryParam, ...dump: unknown[]): Promise<LogEntries> {
    return Logger.add({ ...entry, group: this.group }, ...dump);
  }

  log(message: string, ...dump: unknown[]): void {
    this.add({ level: 'log', message }, ...dump);
  }

  debug(message: string, ...dump: unknown[]): void {
    this.add({ level: 'debug', message }, ...dump);
  }

  error(message: string, ...dump: unknown[]): void {
    this.add({ level: 'error', message }, ...dump);
  }

  skip(...whatever: unknown[]): void {
    // Do nothing
  }
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
