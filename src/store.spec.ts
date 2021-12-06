import browser from 'webextension-polyfill';

import consola from 'consola';

import {
  NZBUnityOptions,
  DefaultOptions,
  storageArea,
  getOptions,
  setOptions,
  getProfiles,
  setProfiles,
  getProfile,
  getActiveProfile,
  setActiveProfile,
  getProviders,
  setProviders,
  getProvider,
  watchOptions,
  watchActiveProvider,
} from './store';

const testOptions: NZBUnityOptions = {
  Version: undefined,
  ActiveProfile: 'SABNzbd Local',
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
      ProfileApiKey: process.env.SABNZBD_APIKEY,
      ProfileHost: process.env.SABNZBD_HOST,
      ProfileHostAsEntered: false,
      ProfileName: 'Local',
      ProfilePassword: '',
      ProfileServerUrl: '',
      ProfileType: 'SABnzbd',
      ProfileUsername: '',
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

const manifestVersion = browser.runtime.getManifest().version;

beforeEach(async () => {
  await storageArea.clear();
  await storageArea.set(testOptions);
});

describe('store/getOptions && store/setOptions', () => {
  it('should return default options when none set', async () => {
    await storageArea.clear();
    const options = await getOptions();
    expect(options).toEqual({ ...DefaultOptions, Version: manifestVersion });
  });

  it('should return the set options', async () => {
    // Options are set in beforeEach, manifest version should be set
    const options = await getOptions();
    expect(options).toEqual({ ...testOptions, Version: manifestVersion });
  });

  it('shoult persist options changes', async () => {
    let options = await getOptions();
    options.DefaultCategory = 'test';
    await setOptions(options);

    options = await getOptions();
    expect(options).toEqual({ ...options, Version: manifestVersion });
  });

  it.todo('should detect and migrate v1 options');
});

// Profiles
// export async function getProfiles(): Promise<Record<string, ProfileOptions>> {
// export async function setProfiles(profiles: Record<string, ProfileOptions>): Promise<void> {
// export async function getProfile(profileName: string): Promise<ProfileOptions> {
// export async function getActiveProfile(): Promise<ProfileOptions> {
// export async function setActiveProfile(profileName: string): Promise<void> {

// Providers
// export async function getProviders(): Promise<Record<string, ProviderOptions>> {
// export async function setProviders(providers: Record<string, ProviderOptions>): Promise<void> {
// export async function getProvider(providerName: string): Promise<ProviderOptions> {

// Watchers
// export function watchOptions(watchers: { [key: string]: (newValue: unknown) => void }): void {
// export function watchActiveProvider(callback: (provider: ProviderOptions) => void): void {

// Migrations
//export async function migrateV1(): Promise<void> {
