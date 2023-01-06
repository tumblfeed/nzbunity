declare interface NZBAddOptions {
  url?: string;
  name?: string;
  category?: string;
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
  force,
}

enum NZBPostProcessing {
  default = -1,
  none,
  repair,
  repair_unpack,
  repair_unpack_delete,
}

declare interface DirectNZB {
  rcode?: string;
  rtext?: string;
  name?: string;
  category?: string;
  moreinfo?: string;
  nfo?: string;
  propername?: string;
  episodename?: string;
  year?: string;
  details?: string;
  failure?: string;
}

declare interface NZBResult {
  success: boolean;
  operation?: string;
  result?: boolean | number | string | NestedDictionary | Array<boolean|string|number|NestedDictionary>;
  error?: string;
}

declare interface NZBQueueResult {
  status: string;
  speed: string;
  speedBytes: number;
  maxSpeed: string;
  maxSpeedBytes: number;
  sizeRemaining: string;
  timeRemaining: string;
  categories: string[];
  queue: NZBQueueItem[];
}

declare interface NZBQueueItem {
  id: string;
  status: string;
  name: string;
  category: string;
  size: string;
  sizeBytes: number;
  sizeRemaining: string;
  sizeRemainingBytes: number;
  timeRemaining: string;
  percentage: number;
}

declare interface NZBAddUrlResult {
  success: boolean;
  result?: string;
  error?: string;
}

abstract class NZBHost {
  name:string;
  displayName:string;
  host:string;
  hostParsed:URL;
  hostAsEntered:boolean = false;
  apiUrl:string;

  constructor(options:Dictionary = {}) {
    this.displayName = (options.displayName || this.name) as string;
    this.host = (options.host || 'localhost') as string;
    this.hostParsed = Util.parseUrl(this.host);
    this.hostAsEntered = Boolean(options.hostAsEntered);
  }

  abstract call(operation:string, params:Dictionary|Array<any>):Promise<NZBResult>;
  abstract getQueue():Promise<NZBQueueResult>;
  abstract getCategories():Promise<string[]>;
  abstract addUrl(url:string, options:NZBAddOptions):Promise<NZBAddUrlResult>;
  abstract addFile(filename:string, content:string, options:NZBAddOptions):Promise<NZBAddUrlResult>;
  abstract setMaxSpeed(bytes:number):Promise<NZBResult>;
  abstract resumeQueue():Promise<NZBResult>;
  abstract pauseQueue():Promise<NZBResult>;
  abstract test():Promise<NZBResult>;
  // addNZB(url):Promise<any>;
}

class SABnzbdHost extends NZBHost {
  name:string = 'SABnzbd';
  apikey:string;

  constructor(options:Dictionary = {}) {
    super(options);
    this.apikey = (options.apikey || '') as string;

    if (this.hostAsEntered) {
      this.apiUrl = this.host;
    } else {
      // If path is empty and root is not allowed, default to /sabnzbd
      let apiPath:string = '';
      if (/^\/*$/i.test(this.hostParsed.pathname)) apiPath += 'sabnzbd';
      if (!/api$/i.test(this.hostParsed.pathname)) apiPath += '/api';

      const pathname = `${this.hostParsed.pathname}/${apiPath}`.replace(/\/+/g, '/');
      this.apiUrl = `${this.hostParsed.protocol}//${this.hostParsed.hostname}:${this.hostParsed.port}${pathname}`;
    }
  }

  call(operation:string, params:Dictionary = {}):Promise<NZBResult> {
    let request:RequestOptions = {
      method: 'GET',
      url: this.apiUrl,
      params: {
        output: 'json',
        apikey: this.apikey,
        mode: operation
      }
    };

    if (this.hostParsed.username) {
      request.username = this.hostParsed.username;
      request.password = this.hostParsed.password ?? undefined;
    }

    for (let k in params) {
      request.params[k] = String(params[k]);
    }

    return Util.request(request)
      .then((result) => {
        // check for error conditions
        if (typeof result === 'string') {
          return { success: false, operation, error: 'Invalid result from host' };
        }

        if (result.status === false && result.error) {
          return { success: false, operation, error: result.error };
        }

        // Collapse single key result
        if (Object.values(result).length === 1) {
          result = Object.values(result)[0];
        }

        return { success: true, operation, result };
      })
      .catch(error => ({ success: false, operation, error }));
  }

  getCategories():Promise<string[]> {
    return this.call('get_cats')
      .then(res => res.success
        ? (res.result as string[]).filter(i => i !== '*')
        : null
      );
  }

  getQueue():Promise<NZBQueueResult> {
    let queue:NZBQueueResult;

    return this.call('queue')
      .then((res) => {
        if (!res.success) return null;

        let speedBytes:number = null;
        let speedMatch:string[] = res.result['speed'].match(/(\d+)\s+(\w+)/i);
        if (speedMatch) {
          speedBytes = parseInt(speedMatch[1]);

          switch (speedMatch[2].toUpperCase()) {
            case 'G':
              speedBytes *= Util.Gigabyte;
              break;
            case 'M':
              speedBytes *= Util.Megabyte;
              break;
            case 'K':
              speedBytes *= Util.Kilobyte;
              break;
          }
        }

        let maxSpeedBytes:number = parseInt(res.result['speedlimit_abs']);

        queue = {
          status: Util.ucFirst(res.result['status']),
          speed: Util.humanSize(speedBytes) + '/s',
          speedBytes,
          maxSpeed: maxSpeedBytes ? Util.humanSize(maxSpeedBytes) : '',
          maxSpeedBytes,
          sizeRemaining: res.result['sizeleft'],
          timeRemaining: speedBytes > 0 ? res.result['timeleft'] : '∞',
          categories: null,
          queue: []
        };

        queue.queue = res.result['slots']
          .map((slot:StringDictionary) => {
            let sizeBytes:number = Math.floor(parseFloat(slot['mb']) * Util.Megabyte); // MB convert to Bytes
            let sizeRemainingBytes:number = Math.floor(parseFloat(slot['mbleft']) * Util.Megabyte); // MB convert to Bytes

            return {
              id: slot['nzo_id'],
              status: Util.ucFirst(slot['status']),
              name: slot['filename'],
              category: slot['cat'],
              size: Util.humanSize(sizeBytes),
              sizeBytes,
              sizeRemaining: Util.humanSize(sizeRemainingBytes),
              sizeRemainingBytes,
              timeRemaining: speedBytes > 0 ? slot['timeleft'] : '∞',
              percentage: Math.floor(((sizeBytes - sizeRemainingBytes) / sizeBytes) * 100)
            } as NZBQueueItem;
          });

        return this.getCategories();
      })
      .then((categories) => {
        queue.categories = categories;
        return queue;
      });
  }

  addUrl(url:string, options:NZBAddOptions = {}):Promise<NZBAddUrlResult> {
    const params:StringDictionary = { name: url };

    for (const k in options) {
      const val = String(options[k]);
      switch (k) {
        case 'name':
          params.nzbname = val;
          break;
        case 'category':
          params.cat = val;
          break;
        default:
          params[k] = val;
      }
    }

    return this.call('addurl', params)
      .then((res) => {
        if (res.success) {
          const ids:string[] = res.result['nzo_ids'];
          res.result = ids.length ? ids[0] : null;
        }
        return res as NZBAddUrlResult;
      });
  }

  addFile(filename:string, content:string, options:NZBAddOptions = {}):Promise<NZBAddUrlResult> {
    const operation = 'addfile';
    const params:StringDictionary = {
      apikey: this.apikey,
      mode: operation,
      output: 'json',
      nzbname: filename
    };

    for (const k in options) {
      const val = String(options[k]);
      switch (k) {
        case 'category':
          params.cat = val;
          break;
        default:
          params[k] = val;
      }
    }

    delete params.content;
    delete params.filename;

    const request:RequestOptions = {
      method: 'POST',
      multipart: true,
      url: `${this.apiUrl}?${Util.uriEncodeQuery(params)}`,
      files: {
        name: {
          filename: filename,
          type: 'application/nzb',
          content,
        },
      },
    };

    return Util.request(request)
      .then((result) => {
        // check for error condition
        if (result.status === false && result.error) {
          return { success: false, operation, error: result.error };
        }

        // Collapse single key result
        if (Object.values(result).length === 1) {
          result = Object.values(result)[0];
        }

        return { success: true, operation, result };
      })
      .then((res) => {
        if (res.success) {
          const ids:string[] = res.result['nzo_ids'];
          res.result = ids.length ? ids[0] : null;
        }
        return res as NZBAddUrlResult;
      })
      .catch(error => ({ success: false, operation, error }));
  }

  setMaxSpeed(bytes:number):Promise<NZBResult> {
    const value = bytes ? `${bytes / Util.Kilobyte}K` : '100';
    return this.call('config', { name: 'speedlimit', value })
      .then((res) => {
        if (res.success) {
          res.result = true;
        }
        return res;
      });
  }

  resumeQueue():Promise<NZBResult> {
    return this.call('resume')
      .then((res) => {
        if (res.success) {
          res.result = true;
        }
        return res;
      });
  }

  pauseQueue():Promise<NZBResult> {
    return this.call('pause')
      .then((res) => {
        if (res.success) {
          res.result = true;
        }
        return res;
      });
  }

  test():Promise<NZBResult> {
    return this.call('fullstatus', { skip_dashboard: 1 })
      .then((res) => {
        if (res.success) {
          res.result = true;
        }
        return res;
      });
  }
}

class NZBGetHost extends NZBHost {
  name:string = 'NZBGet';
  username:string;
  password:string;

  constructor(options:Dictionary = {}) {
    super(options);
    this.username = (options.username || '') as string;
    this.password = (options.password || '') as string;

    if (this.hostAsEntered) {
      this.apiUrl = this.host;
    } else {
      const pathname = `${this.hostParsed.pathname}/jsonrpc`.replace(/\/+/g, '/');
      this.apiUrl = `${this.hostParsed.protocol}//${this.hostParsed.hostname}:${this.hostParsed.port}${pathname}`;
    }
  }

  call(operation:string, params:Array<any> = []):Promise<NZBResult> {
    const request:RequestOptions = {
      method: 'POST',
      url: this.apiUrl,
      username: this.username,
      password: this.password,
      json: true,
      params: {
        method: operation,
        params: params,
      },
    };

    for (const k in params) {
      request.params[k] = String(params[k]);
    }

    return Util.request(request)
      .then((result) => {
        // check for error conditions
        if (typeof result === 'string') {
          return { success: false, operation, error: 'Invalid result from host' };
        }

        if (result.error) {
          return { success: false, operation, error: `${result.error.name}: ${result.error.message}` };
        }

        return { success: true, operation, result: result.result };
      })
      .catch(error => ({ success: false, operation, error }));
  }

  getCategories():Promise<string[]> {
    // NZBGet API does not have a method to get categories, but the
    // categories are listed in the config, so let's get them there.
    return this.call('config')
      .then(res => res.success
        ? (res.result as StringDictionary[])
          .filter(i => /Category\d+\.Name/i.test(i.Name))
          .map(i => i.Value)
        : null
      );
  }

  getQueue():Promise<NZBQueueResult> {
    let queue:NZBQueueResult;

    return this.call('status')
      .then((res) => {
        if (!res.success) return null;

        let serverStandBy:boolean = res.result['ServerStandBy']
        let downloadPaused:boolean = res.result['DownloadPaused']
        let status:string = (serverStandBy && downloadPaused) ? 'paused' : (serverStandBy) ? 'idle' : 'downloading'

        let speedBytes:number = res.result['DownloadRate']; // in Bytes / Second
        let maxSpeedBytes:number = parseInt(res.result['DownloadLimit']);
        let sizeRemaining:number = Math.floor(res.result['RemainingSizeMB'] * Util.Megabyte); // MB convert to Bytes
        let timeRemaining:number = Math.floor(sizeRemaining / speedBytes); // Seconds

        queue = {
          status: Util.ucFirst(status),
          speed: Util.humanSize(speedBytes) + '/s',
          speedBytes,
          maxSpeed: maxSpeedBytes ? Util.humanSize(maxSpeedBytes) : '',
          maxSpeedBytes,
          sizeRemaining: Util.humanSize(sizeRemaining),
          timeRemaining: speedBytes > 0 ? Util.humanSeconds(timeRemaining) : '∞',
          categories: null,
          queue: []
        };

        return this.call('listgroups')
      })
      .then((res) => {
        if (!(res && res.success)) return null;

        queue.queue = (res.result as Dictionary[])
          .map((slot) => {
            const sizeBytes:number = Math.floor((<number> slot['FileSizeMB']) * Util.Megabyte); // MB convert to Bytes
            const sizeRemainingBytes:number = Math.floor((<number> slot['RemainingSizeMB']) * Util.Megabyte); // MB convert to Bytes
            const timeRemaining:number = Math.floor(sizeRemainingBytes / queue.speedBytes); // Seconds

            return {
              id: slot['NZBID'] as string,
              status: Util.ucFirst(slot['Status'] as string),
              name: slot['NZBNicename'] as string,
              category: slot['Category'] as string,
              size: Util.humanSize(sizeBytes),
              sizeBytes,
              sizeRemaining: Util.humanSize(sizeRemainingBytes),
              sizeRemainingBytes,
              timeRemaining: queue.speedBytes > 0 ? Util.humanSeconds(timeRemaining) : '∞',
              percentage: Math.floor(((sizeBytes - sizeRemainingBytes) / sizeBytes) * 100)
            } as NZBQueueItem;
          });

        return this.getCategories()
      })
      .then((categories) => {
        queue.categories = categories;
        return queue;
      });
  }

  addUrl(url:string, options:NZBAddOptions = {}):Promise<NZBAddUrlResult> {
    const params:Array<any> = [
      '', // NZBFilename,
      url, // NZBContent,
      options.category || '', // Category,
      options.priority || NZBPriority.normal, // Priority,
      false, // AddToTop,
      false, // AddPaused,
      '', // DupeKey,
      0, // DupeScore,
      'SCORE', // DupeMode,
      [], // PPParameters
    ];

    return this.call('append', params)
      .then((res) => {
        if (res.success) {
          res.result = String(res.result);
        }
        return res as NZBAddUrlResult;
      });
  }

  addFile(filename:string, content:string, options:NZBAddOptions = {}):Promise<NZBAddUrlResult> {
    let params:Array<any> = [
      filename, // NZBFilename,
      btoa(content), // NZBContent,
      options.category || '', // Category,
      options.priority || NZBPriority.normal, // Priority,
      false, // AddToTop,
      false, // AddPaused,
      '', // DupeKey,
      0, // DupeScore,
      'SCORE', // DupeMode,
      [], // PPParameters
    ];

    return this.call('append', params)
      .then((res) => {
        if (res.success) {
          res.result = String(res.result);
        }
        return res as NZBAddUrlResult;
      });
  }

  setMaxSpeed(bytes:number):Promise<NZBResult> {
    const speed = bytes ? bytes / Util.Kilobyte : 0;
    return this.call('rate', [speed])
      .then((res) => {
        if (res.success) {
          res.result = true;
        }
        return res;
      });
  }

  resumeQueue():Promise<NZBResult> {
    return this.call('resumedownload')
      .then((res) => {
        if (res.success) {
          res.result = true;
        }
        return res;
      });
  }

  pauseQueue():Promise<NZBResult> {
    return this.call('pausedownload')
      .then((res) => {
        if (res.success) {
          res.result = true;
        }
        return res;
      });
  }

  test():Promise<NZBResult> {
    return this.call('status')
      .then((res) => {
        if (res.success) {
          res.result = true;
        }
        return res;
      });
  }
}
