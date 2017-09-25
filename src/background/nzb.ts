declare interface NZBResult {
  success: boolean;
  operation?: string;
  result?: NestedDictionary | Array<boolean|string|number|NestedDictionary>;
  error?: string;
}

declare interface NZBAddOptions {
  name?: string;
  nzbname?: string;
  cat?: string;
  script?: string;
  priority?: NZBPriority;
  pp?: NZBPostProcessing;
}

enum NZBPriority {
  default = -100,
  paused = -2,
  low,
  normal,
  high,
  force
}

enum NZBPostProcessing {
  default = -1,
  none,
  repair,
  repair_unpack,
  repair_unpack_delete
}

declare interface DirectNZB {
  RCode?: string;
  RText?: string;
  Name?: string;
  Category?: string;
  MoreInfo?: string;
  NFO?: string;
  Propername?: string;
  Episodename?: string;
  Year?: string;
  Details?: string;
  Failure?: string;
}

abstract class NZBHost {
  name:string;
  displayName:string;

  host:string;
  hostParsed:ParsedUrl;
  apiUrl:string;

  constructor(options:StringDictionary = {}) {
    this.displayName = options.displayName || this.name;
    this.host = options.host || 'localhost';
    this.hostParsed = Util.parseUrl(this.host);
  }

  abstract call(operation:string, params:Dictionary):Promise<NZBResult>;
  abstract getQueue():Promise<NZBResult>;
  abstract getCategories():Promise<NZBResult>;
  abstract addUrl(url:string, options:NZBAddOptions):Promise<NZBResult>;
  abstract test():Promise<NZBResult>;
  // addNZB(url):Promise<any>;

}

class SABnzbdHost extends NZBHost {
  name:string = 'SABnzbd';
  apikey:string;

  constructor(options:StringDictionary = {}) {
    super(options);
    this.apikey = options.apikey || '';

    let pathname = `${this.hostParsed.pathname}/sabnzbd/api`.replace(/\/+/g, '/');
    this.apiUrl = `${this.hostParsed.protocol}//${this.hostParsed.hostname}:${this.hostParsed.port}${pathname}`;
  }

  call(operation:string, params:Dictionary = {}):Promise<NZBResult> {
    let request:RequestOptions = {
      method: 'GET',
      url: this.apiUrl,
      params: {
        apikey: this.apikey,
        output: 'json',
        mode: operation
      }
    };

    for (let k in params) {
      request.params[k] = String(params[k]);
    }

    return Util.request(request)
      .then((r) => {
        // check for error condition
        if (r.status === false && r.error) {
          return { success: false, operation: operation, error: r.error };
        }

        // Collapse single key result
        if (Object.keys(r).length === 1) {
          r = r[Object.keys(r)[0]];
        }

        return { success: true, operation: operation, result: r };
      })
      .catch((err) => {
        return { success: false, operation: operation, error: err };
      });
  }

  getQueue():Promise<NZBResult> {
    return this.call('queue');
  }

  getCategories():Promise<NZBResult> {
    return this.call('get_cats')
      .then((r) => {
        r.result = (<string[]> r.result).filter((i) => {
          return i !== '*';
        });
        return r;
      });
  }

  addUrl(url:string, options:NZBAddOptions = {}):Promise<NZBResult> {
    let params:StringDictionary = { name: url };

    for (let k in options) {
      params[k] = String(options[k]);
    }

    return this.call('addurl', params);
  }

  test():Promise<NZBResult> {
    return this.call('fullstatus', { skip_dashboard: 1 });
  }
}

class NZBGetHost extends NZBHost {
  name:string = 'NZBGet';
  username:string;
  password:string;

  constructor(options:StringDictionary = {}) {
    super(options);
    this.username = options.username || '';
    this.password = options.password || '';

    let pathname = `${this.hostParsed.pathname}/jsonrpc`.replace(/\/+/g, '/');
    this.apiUrl = `${this.hostParsed.protocol}//${this.hostParsed.hostname}:${this.hostParsed.port}${pathname}`;
  }

  call(operation:string, params:Dictionary = {}):Promise<NZBResult> {
    let request:RequestOptions = {
      method: 'POST',
      url: this.apiUrl,
      username: this.username,
      password: this.password,
      json: true,
      params: <NestedDictionary> {
        method: operation,
        params: params.params || Object.values(params)
      }
    };

    for (let k in params) {
      request.params[k] = String(params[k]);
    }

    return Util.request(request)
      .then((r) => {
        // check for error condition
        if (r.error) {
          return { success: false, operation: operation, error: `${r.error.name}: ${r.error.message}` };
        }

        return { success: true, operation: operation, result: r.result };
      })
      .catch((err) => {
        return { success: false, operation: operation, error: err };
      });
  }

  getQueue():Promise<NZBResult> {
    // TODO
    return this.call('status');
  }

  getCategories():Promise<NZBResult> {
    // Ok, this is weird. NZBGet API does not have a method to get categories, but the categories
    // are listed in the config, so let's get them there.
    return this.call('config')
      .then((r) => {
        let config:StringDictionary[] = <StringDictionary[]> r.result;
        let categories:string[] = config
          .filter((i) => {
            return /Category\d+\.Name/i.test(i.Name);
          })
          .map((i) => {
            return i.Value;
          });

        return { success: true, operation: 'getCategories', result: categories };
      });
  }

  addUrl(url:string, options:NZBAddOptions = {}):Promise<NZBResult> {
    // TODO
    return this.call('status');
  }

  test():Promise<NZBResult> {
    return this.call('status');
  }
}
