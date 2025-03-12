import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NZBUnityOptions,
  DefaultOptions,
  DefaultDownloaderOptions,
  DownloaderType,
  storageArea,
  getOptions,
  setOptions,
  getDownloaders,
  setDownloaders,
  getDownloader,
  getActiveDownloader,
  setActiveDownloader,
  getDownloaderCount,
  getDefaultDownloader,
  getIndexers,
  getIndexer,
  translateV1,
  migrateV1,
  // watchOptions,
  // watchActiveProvider,
} from '../store';
import { N } from 'vitest/dist/chunks/environment.d8YfPkTm.js';


const manifest = browser.runtime.getManifest();

const testOptions: Partial<NZBUnityOptions> = {
  Version: manifest.version,
  ActiveDownloader: 'Local',
  Debug: true,
  DefaultCategory: null,
  EnableNewznab: true,
  EnableNotifications: false,
  IgnoreCategories: false,
  Initialized: true,
  OverrideCategory: null,
  Downloaders: {
    Local: {
      Type: DownloaderType.SABnzbd,
      ApiUrl: import.meta.env.VITE_SABNZBD_APIURL,
      ApiKey: import.meta.env.VITE_SABNZBD_APIKEY,
      Name: 'Local',
      Password: '',
      WebUrl: '',
      Username: '',
    },
  },
  Indexers: {},
  IndexerDisplay: true,
  IndexerEnabled: true,
  IndexerNewznab: 'nzb.cat',
  RefreshRate: 15,
  ReplaceLinks: false,
  SimplifyCategories: true,
};


beforeEach(async () => {
  await storageArea.clear();
  await storageArea.set(testOptions);
});

// Get / Set
describe('get & set', () => {
  it('should return default options when none set', async () => {
    await storageArea.clear();
    const options = await getOptions();
    options.Indexers = {}; // Providers is set from manifest and can vary
    expect(options).toEqual({ ...DefaultOptions, Version: manifest.version });
  });

  it('should return the set options', async () => {
    // Options are set in beforeEach, manifest version should be set
    const options = await getOptions();
    options.Indexers = {}; // Providers is set from manifest and can vary
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
    const profiles = await getDownloaders();
    expect(profiles).toEqual({});
  });

  it('should return the set profiles', async () => {
    const profiles = await getDownloaders();
    expect(profiles.Local.Name).toBe('Local');
  });

  it('should persist profiles changes', async () => {
    await setDownloaders({
      ...testOptions.Downloaders,
      test: {
        ...DefaultDownloaderOptions,
        Name: 'test',
      },
    });
    const profiles = await getDownloaders();
    expect(profiles.test.Name).toBe('test');
  });

  it('should get a profile', async () => {
    const profile = await getDownloader('Local');
    expect(profile).toEqual(testOptions.Downloaders?.Local);
  });

  it('should get the active profile', async () => {
    const activeProfile = await getActiveDownloader();
    expect(activeProfile.Name).toBe('Local');
  });

  it('should persist active profile change', async () => {
    await setDownloaders({
      ...testOptions.Downloaders,
      test: {
        ...DefaultDownloaderOptions,
        Name: 'test',
      },
    });
    await setActiveDownloader('test');
    const activeProfile = await getActiveDownloader();
    expect(activeProfile.Name).toBe('test');
  });

  it('should count profiles', async () => {
    const count = await getDownloaderCount();
    expect(count).toBe(1);
  });

  it('should get the default profile & count', async () => {
    const defaultProfile = await getDefaultDownloader();
    expect(defaultProfile?.Name).toBe('Local');
    const defaultProfileCount = await getDownloaderCount();
    expect(defaultProfileCount).toBe(1);

    await setDownloaders({});
    const defaultProfile2 = await getDefaultDownloader();
    expect(defaultProfile2).toBeFalsy();
    const defaultProfile2Count = await getDownloaderCount();
    expect(defaultProfile2Count).toBe(0);

    await setDownloaders({
      test: {
        ...DefaultDownloaderOptions,
        Name: 'test',
      },
      Default: {
        ...DefaultDownloaderOptions,
        Name: 'Default',
      },
    });
    const defaultProfile3 = await getDefaultDownloader();
    expect(defaultProfile3?.Name).toBe('Default');
    const defaultProfile3Count = await getDownloaderCount();
    expect(defaultProfile3Count).toBe(2);
  });
});

// Providers
describe('indexers', () => {
  it('indexers should set from manifest', async () => {
    await storageArea.clear();
    const indexers = await getIndexers();
    // should skip first entry (util)
    expect(Object.values(indexers).map(p => p.Matches)).toEqual(manifest.content_scripts?.map(p => p.matches));
  });

  it('should get a indexer', async () => {
    const indexer = await getIndexer('example');
    // indexer matches should be in manifest
    expect(manifest.content_scripts?.find(s => s.matches?.includes(indexer.Matches[0]))).toBeTruthy();
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
  const optionsV1: Parameters<typeof translateV1>[0] = {
    ActiveProfile: 'Local',
    Debug: true,
    DefaultCategory: 'nonsense',
    EnableNewznab: true,
    EnableNotifications: false,
    IgnoreCategories: false,
    Initialized: true,
    InterceptDownloads: true,
    InterceptExclude: '',
    OverrideCategory: '',
    Profiles: {
      Local: {
        ProfileName: 'Local',
        ProfileType: 'SABnzbd',
        ProfileHost: 'http://localhost:8080/sabnzbd',
        ProfileApiKey: 'deadbeefcafe',
        ProfileUsername: '',
        ProfilePassword: '',
        ProfileServerUrl: '',
        ProfileHostAsEntered: false,
      },
    },
    Providers: {
      "example":{
        Enabled: true,
        Matches: ["*://*.example.com/*"],
        Js: ["sites/example.ts"],
      },
      "lol":{
        Enabled: false,
        Matches: ["*://*.lol.lmao/*"],
        Js: ["sites/lol.ts"],
      },
    },
    ProviderDisplay: true,
    ProviderEnabled: true,
    ProviderNewznab: 'nzb.cat',
    RefreshRate: 15,
    ReplaceLinks: false,
    SimplifyCategories: true,
    UITheme: '',
  };

  it('should translate v1 options', async () => {
    const translated = await translateV1(optionsV1);

    // Base keys should be the same
    expect(Object.keys(translated)).toEqual(Object.keys(DefaultOptions));
    // ActiveProfile should be translated to ActiveDownloader and keys should be correct
    expect(Object.keys(translated.Downloaders[translated.ActiveDownloader!])).toEqual(Object.keys(DefaultDownloaderOptions));
    // Values should match
    expect(translated.ActiveDownloader).toBe(optionsV1.ActiveProfile);
    expect(translated.DefaultCategory).toBe(optionsV1.DefaultCategory);
    expect(translated.OverrideCategory).toBe(null);
    expect(translated.Downloaders.Local.ApiUrl).toBe(optionsV1.Profiles.Local.ProfileHost);
    expect(translated.Downloaders.Local.ApiKey).toBe(optionsV1.Profiles.Local.ProfileApiKey);
    expect(translated.IndexerNewznab).toBe(optionsV1.ProviderNewznab);
  });

  it('should migrate v1 options', async () => {
    // Ensure options are clear
    await storageArea.clear();
    expect(await storageArea.get(null)).toEqual({});
    // Set v1 options and migrate
    await storageArea.set(optionsV1);
    await migrateV1();
    // Check migrated options are correct
    const options = await getOptions();
    expect(options).toEqual(await translateV1(optionsV1));
  });
});
//export async function migrateV1(): Promise<void> {
