const manifest = browser.runtime.getManifest();
const storageAreaName = 'local';
export const storageArea = browser.storage[storageAreaName];

// Current version
export interface DownloaderOptions {
  Name: string;
  Type: string | null;
  Host: string | null;
  ApiKey: string | null;
  Username: string | null;
  Password: string | null;
  ServerUrl: string | null;
  HostAsEntered: boolean;
}

export const DefaultDownloaderOptions: DownloaderOptions = {
  Name: 'Default',
  Type: null,
  Host: null,
  ApiKey: null,
  Username: null,
  Password: null,
  ServerUrl: null,
  HostAsEntered: false,
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
  Downloaders: Record<string, DownloaderOptions>;
  ActiveDownloader: string | null;
  Indexers: Record<string, IndexerOptions>;
  IndexerNewznab: string;
  IndexerEnabled: boolean;
  IndexerDisplay: boolean;
  RefreshRate: number;
  InterceptDownloads: boolean;
  InterceptExclude: string;
  EnableNotifications: boolean;
  EnableNewznab: boolean;
  IgnoreCategories: boolean;
  SimplifyCategories: boolean;
  DefaultCategory: string | null;
  OverrideCategory: string | null;
  ReplaceLinks: boolean;
  UITheme: string;
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
  InterceptDownloads: true,
  InterceptExclude: '',
  EnableNotifications: false,
  EnableNewznab: true,
  IgnoreCategories: false,
  SimplifyCategories: true,
  DefaultCategory: null,
  OverrideCategory: null,
  ReplaceLinks: false,
  UITheme: '',
};

export async function getOptions(): Promise<NZBUnityOptions> {
  await runMigrations();

  const options = (await storageArea.get(DefaultOptions)) as NZBUnityOptions;
  await updateIndexers(options); // init providers
  return options;
}

export async function setOptions(options: NZBUnityOptions): Promise<NZBUnityOptions> {
  options.Version = manifest.version; // Set last version used
  await storageArea.set(options);
  return options;
}

// Profiles
export async function getDownloaders(): Promise<Record<string, DownloaderOptions>> {
  const options = await getOptions();
  return options.Downloaders;
}

export async function setDownloaders(downloaders: Record<string, DownloaderOptions>): Promise<void> {
  const options = await getOptions();
  options.Downloaders = downloaders;
  await setOptions(options);
}

export async function getDownloader(name: string): Promise<DownloaderOptions> {
  const options = await getOptions();
  return options.Downloaders[name] ?? ({} as DownloaderOptions);
}

export async function getActiveDownloader(): Promise<DownloaderOptions> {
  const options = await getOptions();
  return options.Downloaders[options.ActiveDownloader ?? ''] ?? ({} as DownloaderOptions);
}

export async function setActiveDownloader(name: string): Promise<void> {
  const options = await getOptions();
  options.ActiveDownloader = name;
  await setOptions(options);
}

export async function getDownloaderCount(): Promise<number> {
  const profiles = await getDownloaders();
  return Object.keys(profiles).length;
}

export async function getDefaultDownloader(): Promise<DownloaderOptions | undefined> {
  const profiles = await getDownloaders();
  if (profiles['Default']) {
    return profiles['Default'];
  } else if (profiles['default']) {
    return profiles['default'];
  } else if (Object.keys(profiles).length > 0) {
    return Object.values(profiles)[0];
  } else {
    return undefined;
  }
}

// Indexers
export async function updateIndexers(options: NZBUnityOptions): Promise<void> {
  // Init indexers from manifest
  const indexers = {} as Record<string, IndexerOptions>;

  for (const script of manifest.content_scripts ?? []) {
    const Matches = [...(script.matches ?? [])];
    const Js = [...(script.js ?? [])];

    const first = [...Js].pop() ?? '';
    const [, name] = first.match(/(\w+)\.[tj]s$/) ?? [];

    if (name !== 'utils') {
      indexers[name] = {
        Enabled: options.Indexers[name]?.Enabled ?? true,
        Matches,
        Js,
      };
    }
  }

  options.Indexers = indexers;
  await setOptions(options);
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
export function watchOptions(
  watchers:
    // Either named functions for individual options
    Partial<{ [key in keyof NZBUnityOptions]: (newValue?: NZBUnityOptions[key], oldValue?: NZBUnityOptions[key]) => void | Promise<void> }>
    // Or a single function for all options
    | ((changes: { [key: string]: chrome.storage.StorageChange }) => void | Promise<void>),
): void {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === storageAreaName) {
      if (typeof watchers === 'function') {
        watchers(changes);
      } else {
        for (const [key, change] of Object.entries(changes)) {
          watchers[key as keyof NZBUnityOptions]?.(change.newValue, change.oldValue);
        }
      }
    }
  });
}

export function watchActiveDownloader(callback: (profile: DownloaderOptions) => void): void {
  watchOptions({
    async ActiveDownloader(newValue?: string | null): Promise<void> {
      if (newValue) {
        callback(await getDownloader(newValue));
      }
    },
  });
}

// Migrations (exported for testing)
async function runMigrations(): Promise<void> {
  await migrateV1();
}

export async function migrateV1(): Promise<void> {
  /*
  interface NZBUnityOptionsV1 {
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
  */
  const oldOptions = await browser.storage.local.get(null); // V1 always stored in local

  // V1 options will have Initialized but not Version set, but check if Version is "1" just in case
  if (oldOptions.Initialized && (!oldOptions.Version || /^1\./.test(String(oldOptions.Version)))) {
    // Copy base options
    const newOptions: NZBUnityOptions = {...DefaultOptions};

    for (const [key, value] of Object.entries(oldOptions)) {
      if (key in newOptions) {
        // Need to use Object.assign because TS will throw a fit about string keys,
        // even though we just checked that the key exists
        Object.assign(newOptions, {[key]: value});
      }
    }

    // Copy profile options (including old base options)
    for (const [profileName, profile] of Object.entries(oldOptions.Profiles)) {
      const downloader: DownloaderOptions = {...DefaultDownloaderOptions};

      for (const [key, value] of Object.entries(profile as Record<string, unknown>)) {
        if (key in downloader) {
          Object.assign(downloader, {[key]: value});
        }
      }

      for (const [key, value] of Object.entries(oldOptions)) {
        if (key in downloader) {
          Object.assign(downloader, {[key]: value});
        }
      }

      newOptions.Downloaders[profileName] = downloader;
    }

    // Copy provider options
    for (const [providerName, provider] of Object.entries(oldOptions.Providers)) {
      newOptions.Indexers[providerName] = {
        ...(provider as IndexerOptions),
      };
    }

    // Save
    await setOptions(newOptions);
  }
}
