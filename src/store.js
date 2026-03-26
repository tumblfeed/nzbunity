import { browser } from 'wxt/browser';
import { Logger } from './logger';

const logger = new Logger('store');
export const manifest = () => browser.runtime.getManifest();
const storageAreaName = 'local';

export const storageArea = browser.storage[storageAreaName];

/** @enum {string} */

export const DownloaderType = {
  SABnzbd: 'SABnzbd',
  NZBGet: 'NZBGet',
};

/**
 * @typedef {Object} DownloaderOptions
 * @property {string} Name
 * @property {DownloaderType | null} Type
 * @property {string | null} ApiUrl
 * @property {string | null} ApiKey
 * @property {string | null} Username
 * @property {string | null} Password
 * @property {string | null} WebUrl
 */

/**
 * @typedef {Object} IndexerOptions
 * @property {string | boolean} Display
 * @property {boolean} Enabled
 */

/**
 * @typedef {Object} NZBUnityOptions
 * @property {boolean} Initialized
 * @property {string} Version
 * @property {boolean} Debug
 * @property {Record<string, DownloaderOptions>} Downloaders
 * @property {string | null} ActiveDownloader
 * @property {Record<string, IndexerOptions>} Indexers
 * @property {string} IndexerNewznab
 * @property {boolean} IndexerEnabled
 * @property {boolean} IndexerDisplay
 * @property {number} RefreshRate
 * @property {boolean} EnableNotifications
 * @property {boolean} EnableNewznab
 * @property {boolean} IgnoreCategories
 * @property {boolean} SimplifyCategories
 * @property {string | null} DefaultCategory
 * @property {string | null} OverrideCategory
 * @property {boolean} ReplaceLinks
 */

export const DefaultOptions = {
  Initialized: false,

  // Version: manifest.version,
  Version: '0.0.0',
  Debug: false,
  Downloaders: {},
  ActiveDownloader: null,
  Indexers: {},
  IndexerNewznab: '',
  IndexerEnabled: true,
  IndexerDisplay: true,
  RefreshRate: 15,
  EnableNotifications: false,
  EnableNewznab: true,
  IgnoreCategories: false,
  SimplifyCategories: true,
  DefaultCategory: null,
  OverrideCategory: null,
  ReplaceLinks: false,
};

export const DefaultDownloaderOptions = {
  Name: 'Default',
  Type: null,
  ApiUrl: null,
  ApiKey: null,
  Username: null,
  Password: null,
  WebUrl: null,
};

// This used to come from manifest, making it static reduces the need for scripting permissions in v3
// The keys match the names of entrypoints/*.content.ts
export const DefaultIndexers = {
  abnzb: { Display: 'abNZB', Enabled: true },
  althub: { Display: 'altHUB', Enabled: true },
  animetosho: { Display: 'AnimeTosho', Enabled: true },
  binsearch: { Display: 'BinSearch', Enabled: true },
  dognzb: { Display: 'DogNZB', Enabled: true },
  drunkenslug: { Display: 'DrunkenSlug', Enabled: true },
  gingadaddy: { Display: 'GingaDaddy', Enabled: true },
  nzbfinder: { Display: 'NZBFinder', Enabled: true },
  nzbgeek: { Display: 'NZBGeek', Enabled: true },
  nzbindex: { Display: 'NZBIndex', Enabled: true },
  nzbking: { Display: 'NZBKing', Enabled: true },
  nzblife: { Display: 'NZBLife', Enabled: true },
  omgwtfnzbs: { Display: 'Omgwtfnzbs', Enabled: true },
  tabularasa: { Display: 'TabulaRasa', Enabled: true },
};
for (const value of Object.values(DefaultIndexers)) {
  value.Enabled = DefaultOptions.IndexerEnabled;
}

// Getter and setter functions

async function initOptions() {
  const initialized = (await storageArea.get({ Initialized: false })).Initialized;
  if (!initialized) {
    await setOptions({ ...DefaultOptions, Initialized: true });
  }
}

/** @returns {Promise<NZBUnityOptions>} */
export async function getOptionsRaw() {
  return await storageArea.get(DefaultOptions);
}

/** @returns {Promise<NZBUnityOptions>} */
export async function getOptions() {
  // Ensure options are initialized and up to date
  await initOptions();
  await runMigrations();
  await updateIndexers();

  // Return options
  return await getOptionsRaw();
}

/**
 * @param {Partial<NZBUnityOptions>} options
 * @returns {Promise<NZBUnityOptions>}
 */
export async function setOptions(options) {
  logger.debug(`Setting options: ${Object.keys(options).join(', ')}`, options);

  const prev = await getOptionsRaw();
  await storageArea.set({
    ...options,
    Version: manifest().version, // Always set the last version used
  });

  // We have to pretend to be the storage change event because it's not always triggered
  notifyWatchers(options, prev);
  return await getOptionsRaw();
}

// Downloader profiles

/** @returns {Promise<Record<string, DownloaderOptions>>} */
export async function getDownloaders() {
  const options = await getOptions();
  return options.Downloaders;
}

/** @param {Record<string, DownloaderOptions> | DownloaderOptions[]} downloaders */
export async function setDownloaders(downloaders) {
  if (Array.isArray(downloaders)) {
    downloaders = downloaders.reduce((acc, downloader) => {
      acc[downloader.Name] = downloader;
      return acc;
    }, {});
  }
  await setOptions({ Downloaders: downloaders });

  // Ensure the active downloader is set
  await getActiveDownloader();
}

/**
 * @param {string} name
 * @returns {Promise<DownloaderOptions | undefined>}
 */
export async function getDownloader(name) {
  const options = await getOptions();
  return options.Downloaders[name] ?? undefined;
}

/** @returns {Promise<DownloaderOptions | undefined>} */
export async function getActiveDownloader() {
  const options = await getOptions();
  if (options.Downloaders?.[options?.ActiveDownloader]) {
    return options.Downloaders[options.ActiveDownloader];
  }

  // If the active downloader is not found, set the default
  const defaultDownloader = await getDefaultDownloader();
  if (defaultDownloader) {
    await setActiveDownloader(defaultDownloader.Name);
    return defaultDownloader;
  }

  // No default downloader (probably none available)
  return undefined;
}

/** @param {string} name */
export async function setActiveDownloader(name) {
  await setOptions({ ActiveDownloader: name });
}

/** @returns {Promise<number>} */
export async function getDownloaderCount() {
  const downloaders = await getDownloaders();
  return Object.keys(downloaders).length;
}

/** @returns {Promise<DownloaderOptions | undefined>} */
export async function getDefaultDownloader() {
  const downloaders = await getDownloaders();

  return (
    // Return any profile named default
    downloaders.Default ??
    downloaders.default ??
    // Or the first profile
    Object.values(downloaders)?.[0] ??
    // Or fail
    undefined
  );
}

// Indexers

export async function updateIndexers() {
  const options = await getOptionsRaw();

  // Only update if there are no indexers or the version has changed
  if (
    Object.keys(options.Indexers).length === 0 ||
    options.Version !== manifest().version
  ) {
    const indexers = { ...DefaultIndexers };
    for (const [key, value] of Object.entries(options.Indexers)) {
      value.Enabled = options.Indexers[key]?.Enabled ?? value.Enabled;
    }
    await setOptions({
      Indexers: indexers,
    });
  }
}

export async function resetIndexers() {
  await setOptions({ Indexers: {} });
  await updateIndexers();
}

/** @returns {Promise<Record<string, IndexerOptions>>} */
export async function getIndexers() {
  const options = await getOptions();
  return options.Indexers;
}

/**
 * @param {string} providerName
 * @returns {Promise<IndexerOptions>}
 */
export async function getIndexer(providerName) {
  const providers = await getIndexers();
  return providers[providerName] ?? {};
}

// Watchers

/** @typedef {Parameters<typeof browser.storage.onChanged.addListener>[0]} Watcher */

const watchOptionsListeners = [];
function notifyWatchers(changed, prev) {
  // Apparently sometimges the storage change event is not triggered because why not
  const changes = Object.entries(changed).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: { newValue: value, oldValue: prev[key] },
    }),
    {},
  );

  // Let's pretend to be the storage change event, yayfml
  for (const listener of watchOptionsListeners) {
    listener(changes, storageAreaName);
  }
}

/**
 * @param {Function | Record<string, Function>} watchers
 * @param {string} [areaName]
 * @returns {Watcher}
 */
export function watchOptions(watchers, areaName = storageAreaName) {
  const listener = (changes, changesAreaName) => {
    if (changesAreaName === areaName) {
      if (typeof watchers === 'function') {
        watchers(changes);
      } else {
        for (const [key, change] of Object.entries(changes)) {
          watchers[key]?.(
            change.newValue, // The types here truly are any. TS complains if about undefined, but undefined is valid
            change.oldValue,
          );
        }
      }
    }
  };

  // For some reason, this does not always work, so we keep track of the listeners
  // setOptions will also call the listeners with any changes, so there might be duplicates, w/e
  browser.storage.onChanged.addListener(listener);
  watchOptionsListeners.push(listener);
  return listener;
}

/** @param {Watcher} watcher */
export function removeWatcher(watcher) {
  if (watcher) {
    browser.storage.onChanged.removeListener(watcher);
    watchOptionsListeners.splice(watchOptionsListeners.indexOf(watcher), 1);
  }
}

/**
 * @param {(opts: DownloaderOptions) => void} callback
 * @returns {Watcher}
 */
export function watchActiveDownloader(callback) {
  return watchOptions({
    async ActiveDownloader(newValue) {
      if (newValue) {
        callback(await getDownloader(newValue));
      }
    },
  });
}

// Migrations (exported for testing)
async function runMigrations() {
  // ! Important: Do not call getOptions here; Use getOptionsRaw or storageArea.get directly
  await migrateV1();
}

/**
 * V1 options
 * @typedef {Object} NZBUnityOptionsV1
 * @property {string} [Version]
 * @property {boolean} Initialized
 * @property {boolean} Debug
 * @property {Object} Profiles
 * @property {string} ActiveProfile
 * @property {Object} Providers
 * @property {string} ProviderNewznab
 * @property {boolean} ProviderEnabled
 * @property {boolean} ProviderDisplay
 * @property {number} RefreshRate
 * @property {boolean} InterceptDownloads
 * @property {string} InterceptExclude
 * @property {boolean} EnableNotifications
 * @property {boolean} EnableNewznab
 * @property {boolean} IgnoreCategories
 * @property {boolean} SimplifyCategories
 * @property {string} DefaultCategory
 * @property {string} OverrideCategory
 * @property {boolean} ReplaceLinks
 * @property {string} UITheme
 */
export async function migrateV1() {
  const oldOptions = await browser.storage.local.get(null); // V1 always stored in local

  // V1 options will have Initialized but not Version set, but check if Version is "1" just in case
  if (
    oldOptions.Initialized &&
    (!oldOptions.Version || /^1\./.test(String(oldOptions.Version)))
  ) {
    const newOptions = await translateV1(oldOptions);

    // Clear old options
    await browser.storage.local.clear();

    // Set new options
    await setOptions(newOptions);

    // Ensure the active downloader is set
    await getActiveDownloader();
  }
}

/**
 * @param {NZBUnityOptionsV1} oldOptions
 * @returns {Promise<NZBUnityOptions>}
 */
export async function translateV1(oldOptions) {
  const mapV1ToV2 = {
    Version: 'Version',
    Initialized: 'Initialized',
    Debug: 'Debug',

    // Profiles: 'Downloaders', // Skip, these need to be mapped
    ActiveProfile: 'ActiveDownloader',
    Providers: 'Indexers',
    ProviderNewznab: 'IndexerNewznab',
    ProviderEnabled: 'IndexerEnabled',
    ProviderDisplay: 'IndexerDisplay',
    RefreshRate: 'RefreshRate',
    InterceptDownloads: undefined, // Feature removed
    InterceptExclude: undefined, // Feature removed
    EnableNotifications: 'EnableNotifications',
    EnableNewznab: 'EnableNewznab',
    IgnoreCategories: 'IgnoreCategories',
    SimplifyCategories: 'SimplifyCategories',
    DefaultCategory: 'DefaultCategory',
    OverrideCategory: 'OverrideCategory',
    ReplaceLinks: 'ReplaceLinks',
    UITheme: undefined, // Theme set by browser
  };

  const mapProfilesToDownloaders = {
    ProfileName: 'Name',
    ProfileType: 'Type',
    ProfileHost: 'ApiUrl',
    ProfileApiKey: 'ApiKey',
    ProfileUsername: 'Username',
    ProfilePassword: 'Password',
    ProfileServerUrl: 'WebUrl',
    ProfileHostAsEntered: undefined, // Now always true
  };

  // Not needed, keys are the same
  // const mapProvidersToIndexers = {};
  // Clone old options to avoid modifying the original
  oldOptions = structuredClone(oldOptions);

  // Create base options
  const newOptions = { ...DefaultOptions };

  // Copy root options
  for (const [oldKey, newKey] of Object.entries(mapV1ToV2)) {
    if (newKey && oldOptions[oldKey] !== undefined) {
      // Need to use Object.assign so TS doesn't complain about... who knows what
      Object.assign(newOptions, { [newKey]: oldOptions[oldKey] });
    }
  }

  // Adjust default types
  if (oldOptions.ActiveProfile === '') newOptions.ActiveDownloader = null;
  if (oldOptions.DefaultCategory === '') newOptions.DefaultCategory = null;
  if (oldOptions.OverrideCategory === '') newOptions.OverrideCategory = null;

  // Copy downloaders
  newOptions.Downloaders = {};
  for (const [name, profile] of Object.entries(oldOptions.Profiles)) {
    const downloader = { ...DefaultDownloaderOptions };
    for (const [oldKey, newKey] of Object.entries(mapProfilesToDownloaders)) {
      if (newKey && profile[oldKey] !== undefined) {
        Object.assign(downloader, { [newKey]: profile[oldKey] });
      }
    }
    newOptions.Downloaders[name] = downloader;
  }

  // Don't need to copy providers, they have not changed
  // Set version to current version
  newOptions.Version = manifest().version;
  return newOptions;
}
