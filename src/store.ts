const manifest = browser.runtime.getManifest();
const storageAreaName = 'local';
export const storageArea = browser.storage[storageAreaName];

export enum DownloaderType {
  SABnzbd = 'SABnzbd',
  NZBGet = 'NZBGet',
}

// Current version
export interface DownloaderOptions {
  Name: string;
  Type: DownloaderType | null;
  ApiUrl: string | null;
  ApiKey: string | null;
  Username: string | null;
  Password: string | null;
  WebUrl: string | null;
}

export const DefaultDownloaderOptions: DownloaderOptions = {
  Name: 'Default',
  Type: null,
  ApiUrl: null,
  ApiKey: null,
  Username: null,
  Password: null,
  WebUrl: null,
};

export interface IndexerOptions {
  Enabled: boolean;
  Matches: string[];
  Js: string[];
}

export interface NZBUnityOptions {
  Initialized: boolean;
  Version: string;
  Debug: boolean;
  Downloaders: Record<string, DownloaderOptions>; // Downloaders are keyed by name to avoid name collisions
  ActiveDownloader: string | null;
  Indexers: Record<string, IndexerOptions>;
  IndexerNewznab: string;
  IndexerEnabled: boolean;
  IndexerDisplay: boolean;
  RefreshRate: number;
  EnableNotifications: boolean;
  EnableNewznab: boolean;
  IgnoreCategories: boolean;
  SimplifyCategories: boolean;
  DefaultCategory: string | null;
  OverrideCategory: string | null;
  ReplaceLinks: boolean;
}

export const DefaultOptions: NZBUnityOptions = {
  Initialized: false,
  Version: manifest.version,
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

export async function setOptions(options: Partial<NZBUnityOptions>): Promise<NZBUnityOptions> {
  console.log('Setting options', options);
  console.trace();
  await storageArea.set<NZBUnityOptions>({
    ...options,
    Version: manifest.version, // Always set the last version used
  });
  return await getOptionsRaw();
}

// Downloader profiles

export async function getDownloaders(): Promise<Record<string, DownloaderOptions>> {
  const options = await getOptions();
  return options.Downloaders;
}

export async function setDownloaders(downloaders: Record<string, DownloaderOptions> | DownloaderOptions[]): Promise<void> {
  if (Array.isArray(downloaders)) {
    downloaders = downloaders.reduce((acc, downloader) => {
      acc[downloader.Name] = downloader;
      return acc;
    }, {} as Record<string, DownloaderOptions>);
  }
  await setOptions({ Downloaders: downloaders });
}

export async function getDownloader(name: string): Promise<DownloaderOptions | undefined> {
  const options = await getOptions();
  return options.Downloaders[name] ?? undefined;
}

export async function getActiveDownloader(): Promise<DownloaderOptions | undefined> {
  const options = await getOptions();
  return options.Downloaders[options.ActiveDownloader ?? ''] ?? undefined;
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
    downloaders.Default ?? downloaders.default
    // Or the first profile
    ?? Object.keys(downloaders).length > 0
      ? Object.values(downloaders)[0]
      : undefined
  );
}

// Indexers

export async function updateIndexers(): Promise<void> {
  const options = await getOptionsRaw();
  // Only update if there are no indexers or the version has changed
  if (
    Object.keys(options.Indexers).length === 0
    && options.Version !== manifest.version
  ) {
    const indexers = {...options.Indexers};

    // Init indexers from manifest
    for (const script of manifest.content_scripts ?? []) {
      const Matches = [...(script.matches ?? [])];
      const Js = [...(script.js ?? [])];

      const first = [...Js].pop() ?? '';
      const [, name] = first.match(/(\w+)\.[tj]s$/) ?? [];

      if (name !== 'utils') {
        indexers[name] = {
          Enabled: indexers[name]?.Enabled ?? true,
          Matches,
          Js,
        };
      }
    }

    await setOptions({ Indexers: indexers });
  }
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

type Watcher = Parameters<typeof browser.storage.onChanged.addListener>[0];

export function watchOptions(
  watchers:
    // Either named functions for individual options
    Partial<{ [key in keyof NZBUnityOptions]: (newValue?: NZBUnityOptions[key], oldValue?: NZBUnityOptions[key]) => void | Promise<void> }>
    // Or a single function for all options
    | ((changes: { [key: string]: chrome.storage.StorageChange }) => void | Promise<void>),
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
  browser.storage.onChanged.addListener(listener);
  return listener;
}

export function watchActiveDownloader(callback: (downloader: DownloaderOptions | undefined) => void): Watcher {
  return watchOptions({
    async ActiveDownloader(newValue?: string | null): Promise<void> {
      if (newValue) {
        callback(await getDownloader(newValue));
      }
    },
  });
}

export function removeWatcher(watcher: Watcher): void {
  if (watcher) browser.storage.onChanged.removeListener(watcher);
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
  if (oldOptions.Initialized && (!oldOptions.Version || /^1\./.test(String(oldOptions.Version)))) {
    const newOptions = await translateV1(oldOptions as NZBUnityOptionsV1);
    // Clear old options
    await browser.storage.local.clear();
    // Set new options
    await setOptions(newOptions);
  }
}

export async function translateV1(oldOptions: NZBUnityOptionsV1): Promise<NZBUnityOptions> {
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
  const newOptions: NZBUnityOptions = {...DefaultOptions};

  // Copy root options
  for (const [oldKey, newKey] of Object.entries(mapV1ToV2) as [keyof NZBUnityOptionsV1, keyof NZBUnityOptions | undefined][]) {
    if (newKey && oldOptions[oldKey] !== undefined) {
      // Need to use Object.assign so TS doesn't complain about... who knows what
      Object.assign(newOptions, {[newKey]: oldOptions[oldKey]});
    }
  }
  // Adjust defaut types
  if (oldOptions.ActiveProfile === '') newOptions.ActiveDownloader = null;
  if (oldOptions.DefaultCategory === '') newOptions.DefaultCategory = null;
  if (oldOptions.OverrideCategory === '') newOptions.OverrideCategory = null;

  // Copy downloaders
  newOptions.Downloaders = {};

  for (const [name, profile] of Object.entries(oldOptions.Profiles)) {
    const downloader: DownloaderOptions = {...DefaultDownloaderOptions};

    for (const [oldKey, newKey] of Object.entries(mapProfilesToDownloaders) as [keyof typeof mapProfilesToDownloaders, keyof DownloaderOptions | undefined][]) {
      if (newKey && profile[oldKey] !== undefined) {
        Object.assign(downloader, {[newKey]: profile[oldKey]});
      }
    }

    newOptions.Downloaders[name] = downloader;
  }

  // Don't need to copy providers, they have not changed

  return newOptions;
}
