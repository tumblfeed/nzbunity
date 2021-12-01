import {
  queryToObject,
  getQueryParam,
  objectToQuery,
  parseUrl,
  request,
  Byte,
  Kilobyte,
  Megabyte,
  Gigabyte,
  humanSize,
  humanSeconds,
  ucFirst,
  trunc,
  simplifyCategory,
} from '.';

describe('util/queryToObject', () => {
  it('Returns empty object for empty query', () => {
    const obj = queryToObject('');
    expect(typeof obj).toBe('object');
    expect(Object.keys(obj)).toHaveLength(0);
  });

  it('Returns string record for query string', () => {
    const obj = queryToObject('?foo=bar&num=1&bln=true&nil=&str=hello')
    expect(obj).toBeInstanceOf(URLSearchParams);
    expect(obj.toString()).toBe('foo=bar&num=1&bln=true&nil=&str=hello');
    expect(obj.get('foo')).toBe('bar');
    expect(obj.get('num')).toBe('1');
    expect(obj.get('bln')).toBe('true');
    expect(obj.get('nil')).toBe('');
    expect(obj.get('str')).toBe('hello');
  });
});

describe('util/getQueryParam', () => {
  it('Returns requested value from query string', () => {
    const val = getQueryParam('foo', 'lol', '?foo=1337');
    expect(val).toBe('1337');
  });

  it('Returns default when key not in query string', () => {
    const val = getQueryParam('bar', 'lol', '?foo=1337');
    expect(val).toBe('lol');
  });
});

describe('util/objectToQuery', () => {
  it('Returns expected query string', () => {
    const query = objectToQuery({
      foo: 'lul & wut',
      num: 1,
      bln: true,
      nil: null,
    });
    expect(query).toBe('foo=lul%20%26%20wut&num=1&bln=true&nil=null');
  });
});

describe('util/parseUrl', () => {
  it('Parses full url', () => {
    const parsed = parseUrl('https://google.com/lol');
    expect(parsed).toHaveProperty('protocol', 'https:');
    expect(parsed).toHaveProperty('host', 'google.com');
    expect(parsed).toHaveProperty('pathname', '/lol');
  });

  it('Parses a local url', () => {
    const parsed = parseUrl('127.0.0.1:9090');
    expect(parsed).toHaveProperty('hostname', '127.0.0.1');
    expect(parsed).toHaveProperty('port', '9090');
  });

  it('Parses relative url', () => {
    const parsed = parseUrl('/lol');
    expect(parsed).toHaveProperty('host', 'localhost');
    expect(parsed).toHaveProperty('pathname', '/lol');
  });

  it('Parses query', () => {
    const parsed = parseUrl('https://test.com/lol?foo=bar&lol=1337');
    expect(parsed.searchParams.get('foo')).toBe('bar');
    expect(parsed.searchParams.get('lol')).toBe('1337');
  });

});

describe('util/request', () => {
  it('Can make a simple GET request', async () => {
    expect.assertions(1);
    const response = await request({
      url: 'https://jsonplaceholder.typicode.com/todos/1',
    });

    expect(response).toMatchObject({ id: 1 });
  });

  it('Errors on no URL', async () => {
    expect.assertions(1);

    try {
      await request({ url: '' });
    } catch (e) {
      expect(e.toString()).toBe('Error: No URL provided');
    }
  });
});

describe('util/humanSize', () => {
  it('Returns human readable strings that match size', () => {
    expect(humanSize(2 * Byte)).toBe('2 B');
    expect(humanSize(2 * Kilobyte)).toBe('2 kB');
    expect(humanSize(2 * Megabyte)).toBe('2 MB');
    expect(humanSize(2 * Gigabyte)).toBe('2 GB');
  });
});

describe('util/humanSeconds', () => {
  it('Returns human readable time durations that match seconds', () => {
    expect(humanSeconds(12345)).toBe('3:25:45');
    expect(humanSeconds(3600 * 1.5)).toBe('1:30:00');
  });
});

describe('util/ucFirst', () => {
  it('Returns uppercased first letter', () => {
    expect(ucFirst('lol')).toBe('Lol');
    expect(ucFirst('Lol')).toBe('Lol');
  });
});

describe('util/trunc', () => {
  it('Truncates long strings', () => {
    expect(trunc('Really long string', 10)).toBe('Really lon&hellip;');
  });

  it('Does not truncate shorter strings', () => {
    expect(trunc('Really long string', 100)).toBe('Really long string');
  });
});

describe('util/simplifyCategory', () => {
  it('Simplifies multi-word categories', () => {
    expect(simplifyCategory('Movies')).toBe('movies');
    expect(simplifyCategory('Movies > New > Lol')).toBe('movies');
    expect(simplifyCategory('Movies Lol')).toBe('movies');
    expect(simplifyCategory('Movies^Lol')).toBe('movies');
    expect(simplifyCategory('Movies_Lol')).toBe('movies_lol'); // underscore allowed by \w
    expect(simplifyCategory('Movies123 Lol')).toBe('movies123'); // numbers allowed by \d
  });
});
