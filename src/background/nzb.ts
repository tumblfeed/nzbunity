declare interface NZBResult {
  success: boolean;
  operation?: string;
  result?: NestedDictionary;
  error?: string;
}

abstract class NZBHost {
  host:string;
  hostParsed:ParsedUrl;
  apiUrl:string;

  constructor(options:StringDictionary = {}) {
    this.host = options.host || 'localhost';
    this.hostParsed = Util.parseUrl(this.host);
  }

  abstract call(operation:string, params:Dictionary):Promise<NZBResult>;
  abstract getQueue():Promise<NZBResult>;
  abstract getCategories():Promise<NZBResult>;
  abstract test():Promise<NZBResult>;
  // addNZB(url):Promise<any>;

}

class SABnzbdHost extends NZBHost {
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
    return this.call('get_cats');
  }

  test():Promise<NZBResult> {
    return this.call('fullstatus', { skip_dashboard: 1 });
  }
}

/*
class NZBGetHost extends NZBHost {
  username:string;
  password:string;

  constructor(options:StringDictionary = {}) {
    super(options);
    this.username = options.username || '';
    this.password = options.password || '';

    let pathname = `${this.hostParsed.pathname}/jsonrpc`.replace(/\/+/g, '/');
    this.apiUrl = `${this.hostParsed.protocol}//${this.hostParsed.hostname}:${this.hostParsed.port}${pathname}`;
  }

  call(operation:string, params:Dictionary = {}):Promise<any> {
    let request:RequestOptions = {
      method: 'POST',
      url: this.apiUrl,
      username: this.username,
      password: this.password,
      json: true,
      params: {
        method: operation
      }
    };

    for (let k in params) {
      request.params[k] = String(params[k]);
    }

    return Util.request(request);
  }

  test():Promise<NZBResult> {
    let op = 'status';
    return this.call(op)
      .then((r) => {
        return { success: true, operation: op, result: r };
      })
      .catch((err) => {
        return { success: false, operation: op, error: err };
      });
  }
}
*/