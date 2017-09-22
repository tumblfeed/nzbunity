abstract class NZBHost {
  host:string;
  hostParsed:ParsedUrl;
  apiUrl:string;

  constructor(options:StringDictionary = {}) {
    this.host = options.host || 'localhost';
    this.hostParsed = Util.parseUrl(this.host);
  }

  abstract call(command:string, params:Dictionary):Promise<any>;
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

  call(command:string, params:Dictionary = {}):Promise<any> {
    let request:RequestOptions = {
      method: 'GET',
      url: this.apiUrl,
      params: {
        apikey: this.apikey,
        output: 'json',
        mode: command
      }
    };

    for (let k in params) {
      request.params[k] = String(params[k]);
    }

    return Util.request(request);
  }
}

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

  call(command:string, params:Dictionary = {}):Promise<any> {
    let request:RequestOptions = {
      method: 'POST',
      url: this.apiUrl,
      username: this.username,
      password: this.password,
      json: true,
      params: {
        method: command
      }
    };

    for (let k in params) {
      request.params[k] = String(params[k]);
    }

    return Util.request(request);
  }
}