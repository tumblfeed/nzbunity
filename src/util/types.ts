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
};

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

export declare interface ParsedUrl {
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search?: FlatDictionary;
  hash: string;
}

export declare interface RequestOptions {
  url: string;
  method?: string;
  headers?: StringDictionary;
  params?: NestedDictionary;
  body?: string | FormData;
  username?: string;
  password?: string;
  json?: boolean;
  multipart?: boolean;
  files?: {
    [key:string]: {
      filename: string;
      type: string;
      content: any;
    }
  };
  mode?: string,
  cache?: string,
  credentials?: string,
  redirect?: string,
  referrerPolicy?: string,
  debug?: boolean;
}

export declare interface CreateAddLinkOptions {
  url: string;
  category?: string;
}

export declare interface NZBStorage {
  get: (keys: string | string[] | Object) => Promise<NZBUnityOptions>;
  set: (items: NestedDictionary) => Promise<void>;
  remove: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}
