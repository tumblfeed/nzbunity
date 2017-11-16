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
  hostParsed:ParsedUrl;
  apiUrl:string;

  infinityString:string = '∞';
  // infinityString:string = '&#8734;';

  constructor(options:StringDictionary = {}) {
    this.displayName = options.displayName || this.name;
    this.host = options.host || 'localhost';
    this.hostParsed = Util.parseUrl(this.host);
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

  constructor(options:StringDictionary = {}) {
    super(options);
    this.apikey = options.apikey || '';

    // If path is empty, default to /sabnzbd
    let apiPath:string = /^\/*$/i.test(this.hostParsed.pathname) ? 'sabnzbd/api' : 'api';

    let pathname = `${this.hostParsed.pathname}/${apiPath}`.replace(/\/+/g, '/');
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

  getQueue():Promise<NZBQueueResult> {
    let queue:NZBQueueResult;

    return this.call('queue')
      .then((r) => {
        if (!r.success) return null;

        let speedBytes:number = null;
        let speedMatch:string[] = r.result['speed'].match(/(\d+)\s+(\w+)/i);
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

        let maxSpeedBytes:number = parseInt(r.result['speedlimit_abs']);

        queue = {
          status: Util.ucFirst(r.result['status']),
          speed: Util.humanSize(speedBytes) + '/s',
          speedBytes: speedBytes,
          maxSpeed: maxSpeedBytes ? Util.humanSize(maxSpeedBytes) : '',
          maxSpeedBytes: maxSpeedBytes,
          sizeRemaining: r.result['sizeleft'],
          timeRemaining: speedBytes > 0 ? r.result['timeleft'] : this.infinityString,
          categories: null,
          queue: []
        };

        r.result['slots'].forEach((s:StringDictionary) => {
          let size:number = Math.floor(parseFloat(s['mb']) * Util.Megabyte); // MB convert to Bytes
          let sizeRemaining:number = Math.floor(parseFloat(s['mbleft']) * Util.Megabyte); // MB convert to Bytes

          let item:NZBQueueItem = {
            id: s['nzo_id'],
            status: Util.ucFirst(s['status']),
            name: s['filename'],
            category: s['cat'],
            size: Util.humanSize(size),
            sizeBytes: size,
            sizeRemaining: Util.humanSize(sizeRemaining),
            sizeRemainingBytes: sizeRemaining,
            timeRemaining: speedBytes > 0 ? s['timeleft'] : this.infinityString,
            percentage: Math.floor(((size - sizeRemaining) / size) * 100)
          };

          queue.queue.push(item);
        });

        return this.getCategories()
          .then((categories) => {
            queue.categories = categories;
            return queue;
          });
      });
  }

  getCategories():Promise<string[]> {
    return this.call('get_cats')
      .then((r) => {
        let categories:string[];

        if (r.success) {
          categories = (<string[]> r.result).filter((i) => {
            return i !== '*';
          });
        }

        return categories;
      });
  }

  addUrl(url:string, options:NZBAddOptions = {}):Promise<NZBAddUrlResult> {
    let params:StringDictionary = { name: url };

    for (let k in options) {
      let val = String(options[k]);

      if (k === 'name') {
        params.nzbname = val;
      } else if (k === 'category') {
        params.cat = val;
      } else {
        params[k] = val;
      }
    }

    return this.call('addurl', params)
      .then((r) => {
        let nzbResult:NZBAddUrlResult = <NZBAddUrlResult> r;
        if (nzbResult.success) {
          let ids:string[] = nzbResult.result['nzo_ids'];
          nzbResult.result = ids.length ? ids[0] : null;
        }
        return nzbResult;
      });
  }

  addFile(filename:string, content:string, options:NZBAddOptions = {}):Promise<NZBAddUrlResult> {
    let operation = 'addfile';
    let params:StringDictionary = {
      apikey: this.apikey,
      mode: operation,
      output: 'json',
      nzbname: filename
    };

    for (let k in options) {
      let val = String(options[k]);

      if (k === 'category') {
        params.cat = val;
      } else {
        params[k] = val;
      }
    }

    delete params.content;
    delete params.filename;

    let request:RequestOptions = {
      method: 'POST',
      multipart: true,
      url: this.apiUrl + '?' + Util.uriEncodeQuery(params),
      files: {
        name: {
          filename: filename,
          type: 'application/nzb',
          content: content
        }
      }
    };

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
      .then((r) => {
        let nzbResult:NZBAddUrlResult = <NZBAddUrlResult> r;
        if (nzbResult.success) {
          let ids:string[] = nzbResult.result['nzo_ids'];
          nzbResult.result = ids.length ? ids[0] : null;
        }
        return nzbResult;
      })
      .catch((err) => {
        return { success: false, operation: operation, error: err };
      });
  }

  setMaxSpeed(bytes:number):Promise<NZBResult> {
    let speed = bytes ? `${bytes / Util.Kilobyte}K` : '100';
    return this.call('config', { name: 'speedlimit', value: speed })
      .then((r) => {
        if (r.success) {
          r.result = true;
        }
        return r;
      });
  }

  resumeQueue():Promise<NZBResult> {
    return this.call('resume')
      .then((r) => {
        if (r.success) {
          r.result = true;
        }
        return r;
      });
  }

  pauseQueue():Promise<NZBResult> {
    return this.call('pause')
      .then((r) => {
        if (r.success) {
          r.result = true;
        }
        return r;
      });
  }

  test():Promise<NZBResult> {
    return this.call('fullstatus', { skip_dashboard: 1 })
      .then((r) => {
        if (r.success) {
          r.result = true;
        }
        return r;
      });
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

  call(operation:string, params:Array<any> = []):Promise<NZBResult> {
    let request:RequestOptions = {
      method: 'POST',
      url: this.apiUrl,
      username: this.username,
      password: this.password,
      json: true,
      params: {
        method: operation,
        params: params
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

  getQueue():Promise<NZBQueueResult> {
    let queue:NZBQueueResult;

    return this.call('status')
      .then((r) => {
        if (!r.success) return null;

        let status:string = r.result['ServerStandBy']
          ? 'idle'
          : r.result['DownloadPaused']
            ? 'paused'
            : 'downloading';

        let speedBytes:number = r.result['DownloadRate']; // in Bytes / Second
        let maxSpeedBytes:number = parseInt(r.result['DownloadLimit']);
        let sizeRemaining:number = Math.floor(r.result['RemainingSizeMB'] * Util.Megabyte); // MB convert to Bytes
        let timeRemaining:number = Math.floor(sizeRemaining / speedBytes); // Seconds

        queue = {
          status: Util.ucFirst(status),
          speed: Util.humanSize(speedBytes) + '/s',
          speedBytes: speedBytes,
          maxSpeed: maxSpeedBytes ? Util.humanSize(maxSpeedBytes) : '',
          maxSpeedBytes: maxSpeedBytes,
          sizeRemaining: Util.humanSize(sizeRemaining),
          timeRemaining: speedBytes > 0 ? Util.humanSeconds(timeRemaining) : this.infinityString,
          categories: null,
          queue: []
        };

        return this.call('listgroups')
      })
      .then((r) => {
        if (!(r && r.success)) return null;

        (<Dictionary[]> r.result).forEach((s) => {
          let size:number = Math.floor((<number> s['FileSizeMB']) * Util.Megabyte); // MB convert to Bytes
          let sizeRemaining:number = Math.floor((<number> s['RemainingSizeMB']) * Util.Megabyte); // MB convert to Bytes
          let timeRemaining:number = Math.floor(sizeRemaining / queue.speedBytes); // Seconds

          let item:NZBQueueItem = {
            id: <string> s['NZBID'],
            status: Util.ucFirst(<string> s['Status']),
            name: <string> s['NZBNicename'],
            category: <string> s['Category'],
            size: Util.humanSize(size),
            sizeBytes: size,
            sizeRemaining: Util.humanSize(sizeRemaining),
            sizeRemainingBytes: sizeRemaining,
            timeRemaining: queue.speedBytes > 0 ? Util.humanSeconds(timeRemaining) : this.infinityString,
            percentage: Math.floor(((size - sizeRemaining) / size) * 100)
          };

          queue.queue.push(item);
        });

        return this.getCategories()
          .then((categories) => {
            queue.categories = categories;
            return queue;
          });
      });
  }

  getCategories():Promise<string[]> {
    // Ok, this is weird. NZBGet API does not have a method to get categories, but the categories
    // are listed in the config, so let's get them there.
    return this.call('config')
      .then((r) => {
        let config:StringDictionary[] = <StringDictionary[]> r.result;
        let categories:string[];

        if (r.success) {
          categories = config.filter((i) => {
              return /Category\d+\.Name/i.test(i.Name);
            })
            .map((i) => {
              return i.Value;
            });
        }

        return categories;
      });
  }

  addUrl(url:string, options:NZBAddOptions = {}):Promise<NZBAddUrlResult> {
    let params:Array<any> = [
      '', // NZBFilename,
      url, // NZBContent,
      options.category || '', // Category,
      options.priority || NZBPriority.normal, // Priority,
      false, // AddToTop,
      false, // AddPaused,
      '', // DupeKey,
      0, // DupeScore,
      'SCORE', // DupeMode,
      [] // PPParameters
    ];

    return this.call('append', params)
      .then((r) => {
        if (r.success) {
          r.result = String(r.result);
        }
        return <NZBAddUrlResult> r;
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
      [] // PPParameters
    ];

    return this.call('append', params)
      .then((r) => {
        if (r.success) {
          r.result = String(r.result);
        }
        return <NZBAddUrlResult> r;
      });
  }

  setMaxSpeed(bytes:number):Promise<NZBResult> {
    let speed = bytes ? bytes / Util.Kilobyte : 0;
    return this.call('rate', [speed])
      .then((r) => {
        if (r.success) {
          r.result = true;
        }
        return r;
      });
  }

  resumeQueue():Promise<NZBResult> {
    return this.call('resumedownload')
      .then((r) => {
        if (r.success) {
          r.result = true;
        }
        return r;
      });
  }

  pauseQueue():Promise<NZBResult> {
    return this.call('pausedownload')
      .then((r) => {
        if (r.success) {
          r.result = true;
        }
        return r;
      });
  }

  test():Promise<NZBResult> {
    return this.call('status')
      .then((r) => {
        if (r.success) {
          r.result = true;
        }
        return r;
      });
  }
}
