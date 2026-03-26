import { browser } from 'wxt/browser';
import { isContentScript } from '~/utils';

/**
 * @typedef {Object} LogEntry
 * @property {'debug' | 'log' | 'error'} level
 * @property {string} [group]
 * @property {string} message
 * @property {number} timestamp
 */

/** @typedef {LogEntry & { formatted: string }} LogEntryFormatted */

/** @typedef {Omit<LogEntry, 'timestamp'>} LogEntryParam */

/** @typedef {LogEntryFormatted[]} LogEntries */

const LOG_MAX_ENTRIES = 1000;
const LOG_STORAGE_KEY = 'logEntries';

/**
 * Used from the background script to store log entries.
 * Entries can be retrieved, added, and cleared using the webext messaging API.
 */
export class LogStorage {
  /** @returns {Promise<LogEntries>} */
  static async get() {
    const entries = (await browser.storage.session.get({ [LOG_STORAGE_KEY]: [] }))[
      LOG_STORAGE_KEY
    ];

    // return the formatted entries
    return entries.map((entry) => ({
      ...entry,
      formatted: this.format(entry),
    }));
  }

  /**
   * @param {LogEntryParam} entry
   * @param {...*} dump
   * @returns {Promise<LogEntries>}
   */
  static async add(entry, ...dump) {
    // If WXT_DEBUG is not set, skip debug logs
    if (entry.level === 'debug' && !import.meta.env.WXT_DEBUG) {
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

  /**
   * @param {string} message
   * @param {*[]} dump
   */
  static dump(message, dump) {
    if (dump.length) console.group(message);
    else console.debug(message);
    for (const data of dump) {
      if (data === console.trace || data === 'trace') console.trace();
      else console.debug(data);
    }
    if (dump.length) console.groupEnd();
  }

  /** @returns {Promise<LogEntry[]>} */
  static async clear() {
    await browser.storage.session.remove(LOG_STORAGE_KEY);
    return [];
  }

  /**
   * @param {LogEntry} entry
   * @returns {string}
   */
  static format(entry) {
    const [time24] = entry?.timestamp
      ? new Date(entry.timestamp).toTimeString().split(' ')
      : ['00:00:00'];
    return `[${time24}] ${entry.group ?? 'root'}::${entry.level.toUpperCase()} - ${entry.message}`;
  }
}

export class Logger {
  /** @returns {Promise<LogEntries>} */
  static async get() {
    // If we're in a content script, use sendMessage
    if (isContentScript()) {
      console.debug('content script, using sendMessage');
      return await browser.runtime.sendMessage({ getLog: true });
    } else {
      return await LogStorage.get();
    }
  }

  /**
   * @param {LogEntryParam} entry
   * @param {...*} dump
   * @returns {Promise<LogEntries>}
   */
  static async add(entry, ...dump) {
    // If we're in a content script, use sendMessage
    if (isContentScript()) {
      return await browser.runtime.sendMessage({ log: { entry, dump } });
    } else {
      return await LogStorage.add(entry, ...dump);
    }
  }
  group;

  /** @param {string} group */
  constructor(group) {
    this.group = group;
  }

  /** @returns {Promise<LogEntries>} */
  async get() {
    // Filter the entries by group

    return (await Logger.get()).filter((entry) => entry.group === this.group);
  }

  /**
   * @param {LogEntryParam} entry
   * @param {...*} dump
   */
  async add(entry, ...dump) {
    return Logger.add({ ...entry, group: this.group }, ...dump);
  }

  /**
   * @param {string} message
   * @param {...*} dump
   */
  log(message, ...dump) {
    this.add({ level: 'log', message }, ...dump);
  }

  /**
   * @param {string} message
   * @param {...*} dump
   */
  debug(message, ...dump) {
    this.add({ level: 'debug', message }, ...dump);
  }

  /**
   * @param {string} message
   * @param {...*} dump
   */
  error(message, ...dump) {
    this.add({ level: 'error', message }, ...dump);
  }

  skip(...whatever) {
    // Do nothing
  }
}
