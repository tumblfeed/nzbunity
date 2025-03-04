import browser from 'webextension-polyfill';
import {
  NZBUnityOptions,
  DefaultOptions,
  DefaultProfileOptions,
  storageArea,
  getOptions,
  setOptions,
  getProfiles,
  setProfiles,
  getProfile,
  getActiveProfile,
  setActiveProfile,
  getProfileCount,
  getDefaultProfile,
  getProviders,
  getProvider,
  // watchOptions,
  // watchActiveProvider,
} from '../store';

const testOptions: NZBUnityOptions = {
  Version: undefined,
  ActiveProfile: 'Local',
  Debug: true,
  DefaultCategory: null,
  EnableNewznab: true,
  EnableNotifications: false,
  IgnoreCategories: false,
  Initialized: true,
  InterceptDownloads: true,
  InterceptExclude: '',
  OverrideCategory: null,
  Profiles: {
    Local: {
      ApiKey: process.env.SABNZBD_APIKEY,
      Host: process.env.SABNZBD_HOST,
      HostAsEntered: false,
      Name: 'Local',
      Password: '',
      ServerUrl: '',
      Type: 'SABnzbd',
      Username: '',
    },
  },
  Providers: {},
  ProviderDisplay: true,
  ProviderEnabled: true,
  ProviderNewznab: 'nzb.cat',
  RefreshRate: 15,
  ReplaceLinks: false,
  SimplifyCategories: true,
  UITheme: '',
};

const manifest = browser.runtime.getManifest();

beforeEach(async () => {
  await storageArea.clear();
  await storageArea.set(testOptions);
});

// Get / Set
describe('get & set', () => {
  it('should return default options when none set', async () => {
    await storageArea.clear();
    const options = await getOptions();
    options.Providers = {}; // Providers is set from manifest and can vary
    expect(options).toEqual({ ...DefaultOptions, Version: manifest.version });
  });

  it('should return the set options', async () => {
    // Options are set in beforeEach, manifest version should be set
    const options = await getOptions();
    options.Providers = {}; // Providers is set from manifest and can vary
    expect(options).toEqual({ ...testOptions, Version: manifest.version });
  });

  it('shoult persist options changes', async () => {
    const options = await getOptions();
    options.DefaultCategory = 'test';
    await setOptions(options);

    const newOptions = await getOptions();
    expect(newOptions).toEqual(options);
  });
});

// Profiles
describe('profiles', () => {
  it('default profiles should be empty', async () => {
    await storageArea.clear();
    const profiles = await getProfiles();
    expect(profiles).toEqual({});
  });

  it('should return the set profiles', async () => {
    const profiles = await getProfiles();
    expect(profiles.Local.Name).toBe('Local');
  });

  it('should persist profiles changes', async () => {
    await setProfiles({
      ...testOptions.Profiles,
      test: {
        ...DefaultProfileOptions,
        Name: 'test',
      },
    });
    const profiles = await getProfiles();
    expect(profiles.test.Name).toBe('test');
  });

  it('should get a profile', async () => {
    const profile = await getProfile('Local');
    expect(profile).toEqual(testOptions.Profiles.Local);
  });

  it('should get the active profile', async () => {
    const activeProfile = await getActiveProfile();
    expect(activeProfile.Name).toBe('Local');
  });

  it('should persist active profile change', async () => {
    await setProfiles({
      ...testOptions.Profiles,
      test: {
        ...DefaultProfileOptions,
        Name: 'test',
      },
    });
    await setActiveProfile('test');
    const activeProfile = await getActiveProfile();
    expect(activeProfile.Name).toBe('test');
  });

  it('should count profiles', async () => {
    const count = await getProfileCount();
    expect(count).toBe(1);
  });

  it('should get the default profile & count', async () => {
    const defaultProfile = await getDefaultProfile();
    expect(defaultProfile.Name).toBe('Local');
    const defaultProfileCount = await getProfileCount();
    expect(defaultProfileCount).toBe(1);

    await setProfiles({});
    const defaultProfile2 = await getDefaultProfile();
    expect(defaultProfile2).toBe(null);
    const defaultProfile2Count = await getProfileCount();
    expect(defaultProfile2Count).toBe(0);

    await setProfiles({
      test: {
        ...DefaultProfileOptions,
        Name: 'test',
      },
      Default: {
        ...DefaultProfileOptions,
        Name: 'Default',
      },
    });
    const defaultProfile3 = await getDefaultProfile();
    expect(defaultProfile3.Name).toBe('Default');
    const defaultProfile3Count = await getProfileCount();
    expect(defaultProfile3Count).toBe(2);
  });
});

// Providers
describe('providers', () => {
  it('providers should set from manifest', async () => {
    await storageArea.clear();
    const providers = await getProviders();
    // should skip first entry (util)
    expect(Object.values(providers).map(p => p.Matches)).toEqual(manifest.content_scripts.slice(1).map(p => p.matches));
  });

  it('should get a provider', async () => {
    const provider = await getProvider('althub');
    expect(provider.Matches).toEqual(manifest.content_scripts[1].matches);
  });
});

// Watchers
// Note: jest-webextension-mock does not appear to support storageArea.onChanged
// describe.only('watchers', () => {
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   const watcher = jest.spyOn(consola, 'debug');

//   it('should watch all options', async () => {
//     watchOptions(consola.debug);

//     const options = await getOptions();
//     options.DefaultCategory = 'test';
//     await setOptions(options);

//     expect(watcher).toHaveBeenCalledTimes(1);
//     expect(watcher).toHaveBeenCalledWith(options);
//   });
// });

// Migrations
describe('migrations', () => {
  const v1Options = {
    ActiveProfile: 'Local',
    Debug: true,
    DefaultCategory: null,
    EnableNewznab: true,
    EnableNotifications: false,
    IgnoreCategories: false,
    Initialized: true,
    InterceptDownloads: true,
    InterceptExclude: '',
    OverrideCategory: null,
    Profiles: {
      Local: {
        ApiKey: process.env.SABNZBD_APIKEY,
        Host: process.env.SABNZBD_HOST,
        HostAsEntered: false,
        Name: 'Local',
        Password: '',
        ServerUrl: '',
        Type: 'SABnzbd',
        Username: '',
      },
    },
    Providers: {},
    ProviderDisplay: true,
    ProviderEnabled: true,
    ProviderNewznab: 'nzb.cat',
    RefreshRate: 15,
    ReplaceLinks: false,
    SimplifyCategories: true,
    UITheme: '',
  };

  it.todo('should migrate v1 options');
});
//export async function migrateV1(): Promise<void> {
