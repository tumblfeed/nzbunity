import browser from 'webextension-polyfill';

const manifest = browser.runtime.getManifest();
const storageAreaName = 'local';
export const storageArea = browser.storage[storageAreaName];

// Current version
export interface ProfileOptions {
  Name: string;
  Type: string;
  Host: string;
  ApiKey: string;
  Username: string;
  Password: string;
  ServerUrl: string;
  HostAsEntered: boolean;
}

export const DefaultProfileOptions: ProfileOptions = {
  Name: 'Default',
  Type: null,
  Host: null,
  ApiKey: null,
  Username: null,
  Password: null,
  ServerUrl: null,
  HostAsEntered: false,
};

export interface ProviderOptions {
  Enabled: boolean;
  Matches: string[];
  Js: string[];
}

export interface NZBUnityOptions {
  Initialized: boolean;
  Version: string;
  Debug: boolean;
  Profiles: Record<string, ProfileOptions>;
  ActiveProfile: string;
  Providers: Record<string, ProviderOptions>;
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

export const DefaultOptions: NZBUnityOptions = {
  Initialized: false,
  Version: manifest.version,
  Debug: false,
  Profiles: {},
  ActiveProfile: null,
  Providers: {},
  ProviderNewznab: '',
  ProviderEnabled: true,
  ProviderDisplay: true,
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
  await updateProviders(options); // init providers
  return options;
}

export async function setOptions(options: NZBUnityOptions): Promise<NZBUnityOptions> {
  options.Version = manifest.version; // Set last version used
  await storageArea.set(options);
  return options;
}

// Profiles
export async function getProfiles(): Promise<Record<string, ProfileOptions>> {
  const options = await getOptions();
  return options.Profiles;
}

export async function setProfiles(profiles: Record<string, ProfileOptions>): Promise<void> {
  const options = await getOptions();
  options.Profiles = profiles;
  await setOptions(options);
}

export async function getProfile(profileName: string): Promise<ProfileOptions> {
  const options = await getOptions();
  return options.Profiles[profileName] ?? ({} as ProfileOptions);
}

export async function getActiveProfile(): Promise<ProfileOptions> {
  const options = await getOptions();
  return options.Profiles[options.ActiveProfile] ?? ({} as ProfileOptions);
}

export async function setActiveProfile(profileName: string): Promise<void> {
  const options = await getOptions();
  options.ActiveProfile = profileName;
  await setOptions(options);
}

export async function getProfileCount(): Promise<number> {
  const profiles = await getProfiles();
  return Object.keys(profiles).length;
}

export async function getDefaultProfile(): Promise<ProfileOptions> {
  const profiles = await getProfiles();
  if (profiles['Default']) {
    return profiles['Default'];
  } else if (profiles['default']) {
    return profiles['default'];
  } else if (Object.keys(profiles).length > 0) {
    return Object.values(profiles)[0];
  } else {
    return null;
  }
}

// Providers
export async function updateProviders(options: NZBUnityOptions): Promise<void> {
  // Init providers from manifest
  const providers = {} as Record<string, ProviderOptions>;

  for (const script of manifest.content_scripts) {
    const js: string = Array.isArray(script.js) && [...script.js].pop();
    const [, name] = js ? js.match(/(\w+)\.js$/) : [];

    if (name && name !== 'util') {
      providers[name] = {
        Enabled: options.Providers[name]?.Enabled ?? true,
        Matches: [...script.matches],
        Js: [...script.js],
      };
    }
  }

  options.Providers = providers;
  await setOptions(options);
}

export async function getProviders(): Promise<Record<string, ProviderOptions>> {
  const options = await getOptions();
  return options.Providers;
}

export async function getProvider(providerName: string): Promise<ProviderOptions> {
  const providers = await getProviders();
  return providers[providerName] ?? ({} as ProviderOptions);
}

// Watchers
export function watchOptions(
  watchers: { [key: string]: (newValue: unknown) => void } | ((newValue: unknown) => void),
): void {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === storageAreaName) {
      if (typeof watchers === 'function') {
        watchers(changes);
      } else {
        for (const [key, value] of Object.entries(changes)) {
          if (watchers[key]) {
            watchers[key](value?.newValue);
          }
        }
      }
    }
  });
}

export function watchActiveProvider(callback: (provider: ProviderOptions) => void): void {
  watchOptions({
    ActiveProfile: (newValue: string) => {
      if (newValue) {
        getProvider(newValue).then(callback);
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

  // V1 options will Initialized but notversion set usually, but check if set to "1" just in case
  if (oldOptions.Initialized && (!oldOptions.Version || /^1\./.test(String(oldOptions.Version)))) {
    // Copy base options
    const newOptions: NZBUnityOptions = {
      ...DefaultOptions,
      Version: manifest.version,
    };

    for (const [key, value] of Object.entries(oldOptions)) {
      if (key in newOptions) {
        newOptions[key] = value;
      }
    }

    // Copy profile options (including old base options)
    for (const [profileName, profile] of Object.entries(oldOptions.Profiles)) {
      const newProfile = {
        ...DefaultProfileOptions,
      };

      for (const [key, value] of Object.entries(profile)) {
        if (key in newProfile) {
          newProfile[key] = value;
        }
      }

      for (const [key, value] of Object.entries(oldOptions)) {
        if (key in newProfile) {
          newProfile[key] = value;
        }
      }

      newOptions.Profiles[profileName] = newProfile;
    }

    // Copy provider options
    for (const [providerName, provider] of Object.entries(oldOptions.Providers)) {
      newOptions.Providers[providerName] = {
        ...(provider as ProviderOptions),
      };
    }

    // Save
    await setOptions(newOptions);
  }
}
