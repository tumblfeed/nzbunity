import { useState, useEffect } from 'react';

interface LogEntry {
  level: 'debug' | 'log' | 'error';
  group?: string;
  message: string;
  timestamp: number;
}
interface LogEntryFormatted extends LogEntry {
  formatted: string;
}
type LogEntryParam = Omit<LogEntry, 'timestamp'>;

type LogEntries = LogEntryFormatted[];

export class Logger {
  static LOG_MAX_ENTRIES = 1000;
  static LOG_STORAGE_KEY = 'logEntries';

  // used when browser session storage is not available
  // ie in a content script
  static entries: LogEntry[] = [];

  static async get(): Promise<LogEntries> {
    const entries: LogEntry[] = browser?.storage?.session
      ? (await browser.storage.session.get({ [this.LOG_STORAGE_KEY]: [] }))[
          this.LOG_STORAGE_KEY
        ]
      : this.entries;
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
      .slice(-this.LOG_MAX_ENTRIES);

    if (browser?.storage?.session) {
      await browser.storage.session.set({ [this.LOG_STORAGE_KEY]: entries });
    } else {
      this.entries = entries;
    }

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
    if (browser?.storage?.session) {
      await browser.storage.session.remove(this.LOG_STORAGE_KEY);
    } else {
      this.entries = [];
    }
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

export default Logger;

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
