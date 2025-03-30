import { Logger } from './logger';
const logger = new Logger('store');

const manifest = () => browser.runtime.getManifest();
const storageAreaName = 'local';
export const storageArea = browser.storage[storageAreaName];

export enum DownloaderType {
  SABnzbd = 'SABnzbd',
  NZBGet = 'NZBGet',
}

export interface DownloaderOptions {
  Name: string;
  Type: DownloaderType | null;
  ApiUrl: string | null;
  ApiKey: string | null;
  Username: string | null;
  Password: string | null;
  WebUrl: string | null;
}

export interface IndexerOptions {
  Display: string | boolean;
  Enabled: boolean;
}

export interface NZBUnityOptions {
  Initialized: boolean;
  Version: string;
  Debug: boolean;
  Downloaders: Record<string, DownloaderOptions>; // Downloaders are keyed by name to avoid name collisions
  ActiveDownloader: string | null;
  Indexers: Record<string, IndexerOptions>;
  IndexerNewznab: string;
  IndexerEnabled: boolean; // Default value for new indexers
  IndexerDisplay: boolean; // Default value for new indexers
  RefreshRate: number;
  EnableNotifications: boolean;
  EnableNewznab: boolean; // For enabling/disabling Newznab detection; will be disabled in v2, but keep in case we can add it back
  IgnoreCategories: boolean;
  SimplifyCategories: boolean;
  DefaultCategory: string | null;
  OverrideCategory: string | null;
  ReplaceLinks: boolean;
}

export const DefaultOptions: NZBUnityOptions = {
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

export const DefaultDownloaderOptions: DownloaderOptions = {
  Name: 'Default',
  Type: null,
  ApiUrl: null,
  ApiKey: null,
  Username: null,
  Password: null,
  WebUrl: null,
};

// This used to come from manifest, making it static reduces the need scripting permissions in v3
// The keys match the names of entrypoints/*.content.ts
export const DefaultIndexers: Record<string, IndexerOptions> = {
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
  nzbserver: { Display: 'NZBServer', Enabled: true },
  nzbsu: { Display: 'NZBSu', Enabled: true },
  omgwtfnzbs: { Display: 'Omgwtfnzbs', Enabled: true },
  tabularasa: { Display: 'TabulaRasa', Enabled: true },
};
for (const value of Object.values(DefaultIndexers)) {
  value.Enabled = DefaultOptions.IndexerEnabled;
}

// Getter and setter functions

async function initOptions(): Promise<void> {
  const initialized = (await storageArea.get({ Initialized: false })).Initialized;
  if (!initialized) {
    await setOptions({ ...DefaultOptions, Initialized: true });
  }
}

export async function getOptionsRaw(): Promise<NZBUnityOptions> {
  return await storageArea.get(DefaultOptions);
}

export async function getOptions(): Promise<NZBUnityOptions> {
  // Ensure options are initialized and up to date
  await initOptions();
  await runMigrations();
  await updateIndexers();
  // Return options
  return await getOptionsRaw();
}

export async function setOptions(
  options: Partial<NZBUnityOptions>,
): Promise<NZBUnityOptions> {
  logger.debug(
    `Setting options: ${Object.keys(options).join(', ')}`,
    options,
    // console.trace,
  );

  const prev = await getOptionsRaw();

  await storageArea.set<NZBUnityOptions>({
    ...options,
    Version: manifest().version, // Always set the last version used
  });

  // We have to pretend to be the storage change event because it's not always triggered
  notifyWatchers(options, prev);

  return await getOptionsRaw();
}

// Downloader profiles

export async function getDownloaders(): Promise<Record<string, DownloaderOptions>> {
  const options = await getOptions();
  return options.Downloaders;
}

export async function setDownloaders(
  downloaders: Record<string, DownloaderOptions> | DownloaderOptions[],
): Promise<void> {
  if (Array.isArray(downloaders)) {
    downloaders = downloaders.reduce((acc, downloader) => {
      acc[downloader.Name] = downloader;
      return acc;
    }, {} as Record<string, DownloaderOptions>);
  }
  await setOptions({ Downloaders: downloaders });
  // Ensure the active downloader is set
  await getActiveDownloader();
}

export async function getDownloader(
  name: string,
): Promise<DownloaderOptions | undefined> {
  const options = await getOptions();
  return options.Downloaders[name] ?? undefined;
}

export async function getActiveDownloader(): Promise<DownloaderOptions | undefined> {
  const options = await getOptions();
  if (options.Downloaders?.[options?.ActiveDownloader!]) {
    return options.Downloaders[options.ActiveDownloader!];
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

export async function setActiveDownloader(name: string): Promise<void> {
  await setOptions({ ActiveDownloader: name });
}

export async function getDownloaderCount(): Promise<number> {
  const downloaders = await getDownloaders();
  return Object.keys(downloaders).length;
}

export async function getDefaultDownloader(): Promise<DownloaderOptions | undefined> {
  const downloaders = await getDownloaders();
  return (
    // Return any profile named default
    downloaders.Default ??
      downloaders.default ??
      // Or the first profile
      Object.keys(downloaders).length > 0
      ? Object.values(downloaders)[0]
      : undefined
  );
}

// Indexers

export async function updateIndexers(): Promise<void> {
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

export async function resetIndexers(): Promise<void> {
  await setOptions({ Indexers: {} });
  await updateIndexers();
}

export async function getIndexers(): Promise<Record<string, IndexerOptions>> {
  const options = await getOptions();
  return options.Indexers;
}

export async function getIndexer(providerName: string): Promise<IndexerOptions> {
  const providers = await getIndexers();
  return providers[providerName] ?? ({} as IndexerOptions);
}

// Watchers

export type Watcher = Parameters<typeof browser.storage.onChanged.addListener>[0];
const watchOptionsListeners: Watcher[] = [];

function notifyWatchers(changed: Partial<NZBUnityOptions>, prev: NZBUnityOptions): void {
  // Apparently sometimges the storage change event is not triggered because why not
  const changes = Object.entries(changed).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: { newValue: value, oldValue: prev[key as keyof NZBUnityOptions] },
    }),
    {} as { [key: string]: chrome.storage.StorageChange },
  );
  // Let's pretend to be the storage change event, yayfml
  for (const listener of watchOptionsListeners) {
    listener(changes, storageAreaName);
  }
}

export function watchOptions(
  watchers: // Either named functions for individual options
  | Partial<{
        [key in keyof NZBUnityOptions]: (
          newValue?: NZBUnityOptions[key],
          oldValue?: NZBUnityOptions[key],
        ) => void | Promise<void>;
      }>
    // Or a single function for all options
    | ((changes: {
        [key: string]: chrome.storage.StorageChange;
      }) => void | Promise<void>),
  areaName = storageAreaName, // Allow watching different storage areas
): Watcher {
  const listener: Watcher = (changes, changesAreaName) => {
    if (changesAreaName === areaName) {
      if (typeof watchers === 'function') {
        watchers(changes);
      } else {
        for (const [key, change] of Object.entries(changes)) {
          watchers[key as keyof NZBUnityOptions]?.(change.newValue, change.oldValue);
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

export function removeWatcher(watcher: Watcher): void {
  if (watcher) {
    browser.storage.onChanged.removeListener(watcher);
    watchOptionsListeners.splice(watchOptionsListeners.indexOf(watcher), 1);
  }
}

export function watchActiveDownloader(
  callback: (downloader: DownloaderOptions | undefined) => void,
): Watcher {
  return watchOptions({
    async ActiveDownloader(newValue?: string | null): Promise<void> {
      if (newValue) {
        callback(await getDownloader(newValue));
      }
    },
  });
}

// Migrations (exported for testing)

async function runMigrations(): Promise<void> {
  // ! Important: Do not call getOptions here; Use getOptionsRaw or storageArea.get directly
  await migrateV1();
}

/**
 * V1 options
 */
interface NZBUnityOptionsV1 {
  Version?: string;
  Initialized: boolean;
  Debug: boolean;
  Profiles: {
    [key: string]: {
      ProfileName: string;
      ProfileType: string;
      ProfileHost: string;
      ProfileApiKey: string;
      ProfileUsername: string;
      ProfilePassword: string;
      ProfileServerUrl: string;
      ProfileHostAsEntered: boolean;
    };
  };
  ActiveProfile: string;
  Providers: {
    [key: string]: {
      Enabled: boolean;
      Matches: string[];
      Js: string[];
    };
  };
  ProviderNewznab: string;
  ProviderEnabled: boolean;
  ProviderDisplay: boolean;
  RefreshRate: number;
  InterceptDownloads: boolean;
  InterceptExclude: string;
  EnableNotifications: boolean;
  EnableNewznab: boolean;
  IgnoreCategories: boolean;
  SimplifyCategories: boolean;
  DefaultCategory: string;
  OverrideCategory: string;
  ReplaceLinks: boolean;
  UITheme: string;
}

export async function migrateV1(): Promise<void> {
  const oldOptions = await browser.storage.local.get<NZBUnityOptionsV1>(null); // V1 always stored in local
  // V1 options will have Initialized but not Version set, but check if Version is "1" just in case
  if (
    oldOptions.Initialized &&
    (!oldOptions.Version || /^1\./.test(String(oldOptions.Version)))
  ) {
    const newOptions = await translateV1(oldOptions as NZBUnityOptionsV1);
    // Clear old options
    await browser.storage.local.clear();
    // Set new options
    await setOptions(newOptions);
  }
}

export async function translateV1(
  oldOptions: NZBUnityOptionsV1,
): Promise<NZBUnityOptions> {
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
  const newOptions: NZBUnityOptions = { ...DefaultOptions };

  // Copy root options
  for (const [oldKey, newKey] of Object.entries(mapV1ToV2) as [
    keyof NZBUnityOptionsV1,
    keyof NZBUnityOptions | undefined,
  ][]) {
    if (newKey && oldOptions[oldKey] !== undefined) {
      // Need to use Object.assign so TS doesn't complain about... who knows what
      Object.assign(newOptions, { [newKey]: oldOptions[oldKey] });
    }
  }
  // Adjust defaut types
  if (oldOptions.ActiveProfile === '') newOptions.ActiveDownloader = null;
  if (oldOptions.DefaultCategory === '') newOptions.DefaultCategory = null;
  if (oldOptions.OverrideCategory === '') newOptions.OverrideCategory = null;

  // Copy downloaders
  newOptions.Downloaders = {};

  for (const [name, profile] of Object.entries(oldOptions.Profiles)) {
    const downloader: DownloaderOptions = { ...DefaultDownloaderOptions };

    for (const [oldKey, newKey] of Object.entries(mapProfilesToDownloaders) as [
      keyof typeof mapProfilesToDownloaders,
      keyof DownloaderOptions | undefined,
    ][]) {
      if (newKey && profile[oldKey] !== undefined) {
        Object.assign(downloader, { [newKey]: profile[oldKey] });
      }
    }

    newOptions.Downloaders[name] = downloader;
  }

  // Don't need to copy providers, they have not changed

  return newOptions;
}
