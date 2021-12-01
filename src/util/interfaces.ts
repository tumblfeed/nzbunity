export declare interface RequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
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

export declare interface NZBUnityProfileOptions {
  ProfileName: string,
  ProfileType: string,
  ProfileHost: string,
  ProfileApiKey: string,
  ProfileUsername: string,
  ProfilePassword: string,
  ProfileServerUrl: string,
  ProfileHostAsEntered: boolean
}

export declare interface NZBUnityProviderOptions {
  Enabled: boolean,
  Matches: string[],
  Js: string[]
}

export declare interface NZBUnityOptions {
  Initialized: boolean,
  Debug: boolean,
  Profiles: Record<string, NZBUnityProfileOptions>,
  ActiveProfile: string,
  Providers: Record<string, NZBUnityProviderOptions>,
  ProviderNewznab: string,
  ProviderEnabled: boolean,
  ProviderDisplay: boolean,
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

export const DefaultOptions: NZBUnityOptions = {
  Initialized: false,
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
  UITheme: ''
};
