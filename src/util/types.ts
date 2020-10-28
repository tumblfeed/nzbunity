export declare interface Dictionary {
  [key:string]: boolean | number | string | null | Array<boolean | number | string>;
}

export declare interface StringDictionary {
  [key:string]: string | null;
}

export declare interface FlatDictionary {
  [key:string]: boolean | number | string | null;
}

export declare interface NestedDictionary {
  [key:string]: boolean | number | string | null | Array<boolean | number | string> | NestedDictionary;
}

export declare interface NZBUnityProfileOptions extends Dictionary {
  ProfileName: string,
  ProfileType: string,
  ProfileHost: string,
  ProfileApiKey: string,
  ProfileUsername: string,
  ProfilePassword: string,
  ProfileServerUrl: string,
  ProfileHostAsEntered: boolean
}

export declare interface NZBUnityProviderOptions extends Dictionary {
  Enabled: boolean,
  Matches: string[],
  Js: string[]
}

export declare interface NZBUnityProfileDictionary {
  [key:string]: NZBUnityProfileOptions
}

export declare interface NZBUnityProviderDictionary {
  [key:string]: NZBUnityProviderOptions
}

export declare interface NZBUnityOptions extends NestedDictionary {
  Initialized: boolean,
  Debug: boolean,
  Profiles: NZBUnityProfileDictionary,
  ActiveProfile: string,
  Providers: NZBUnityProviderDictionary,
  ProviderNewznab: string,
  ProviderEnabled: boolean,
  RefreshRate: number,
  InterceptDownloads: boolean,
  InterceptExclude: string,
  EnableNotifications: boolean,
  EnableNewznab: boolean,
  IgnoreCategories: boolean,
  SimplifyCategories: boolean,
  DefaultCategory: string,
  OverrideCategory: string,
  ReplaceLinks: boolean,
  UITheme: string
}

export const DefaultOptions:NZBUnityOptions = {
  Initialized: false,
  Debug: false,
  Profiles: {},
  ActiveProfile: null,
  ProviderEnabled: true,
  ProviderDisplay: true,
  Providers: {},
  ProviderNewznab: '',
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
  UITheme: ''
};
