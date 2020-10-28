import {
  queryToObject,
  queryToObjectTyped,
  getQueryParam,
  getQueryParamTyped,
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
  test('Empty query returns empty object', () => {
    const obj = queryToObject('');
    expect(typeof obj).toBe('object');
    expect(Object.keys(obj)).toHaveLength(0);
  });

  test('Query string returns string dictionary', () => {
    const obj = queryToObject('?foo=bar&num=1&bln=true&nil=&str=hello')
    expect(obj).toMatchObject({
      foo: 'bar',
      num: '1',
      bln: 'true',
      nil: '',
      str: 'hello',
    });
  });
});

describe('util/queryToObjectTyped', () => {
  test('Empty query returns empty object', () => {
    const obj = queryToObjectTyped('');
    expect(typeof obj).toBe('object');
    expect(Object.keys(obj)).toHaveLength(0);
  });

  test('Query string returns typed dictionary', () => {
    const obj = queryToObjectTyped('?foo=bar&num=1&bln=true&nil=&str=hello')
    expect(obj).toMatchObject({
      foo: 'bar',
      num: 1,
      bln: true,
      nil: null,
      str: 'hello',
    });
  });
});

describe('util/getQueryParam', () => {
  test('Returns expected value', () => {
    const val = getQueryParam('foo', 'lol', '?foo=1337');
    expect(val).toBe('1337');
  });

  test('Returns default', () => {
    const val = getQueryParam('bar', 'lol', '?foo=1337');
    expect(val).toBe('lol');
  });
});

describe('util/getQueryParamTyped', () => {
  test('Returns expected value', () => {
    const val = getQueryParamTyped('foo', 'lol', '?foo=1337');
    expect(val).toBe(1337);
  });

  test('Returns default', () => {
    const val = getQueryParamTyped('bar', 101, '?foo=1337');
    expect(val).toBe(101);
  });
});

describe('util/objectToQuery', () => {
  test('Returns expected value', () => {
    const query = objectToQuery({
      foo: 'lul & wut',
      num: 1,
      bln: true,
      nil: null,
    });
    expect(query).toBe('foo=lul%20%26%20wut&num=1&bln=true&nil');
  });
});

describe('util/parseUrl', () => {
  test('Parses full url', () => {
    const parsed = parseUrl('https://google.com/lol');
    expect(parsed).toHaveProperty('protocol', 'https:');
    expect(parsed).toHaveProperty('host', 'google.com');
    expect(parsed).toHaveProperty('pathname', '/lol');
  });

  test('Parses a local url', () => {
    const parsed = parseUrl('127.0.0.1:9090');
    expect(parsed).toHaveProperty('hostname', '127.0.0.1');
    expect(parsed).toHaveProperty('port', '9090');
  });

  test('Parses relative url', () => {
    const parsed = parseUrl('/lol');
    expect(parsed).toHaveProperty('host', 'localhost');
    expect(parsed).toHaveProperty('pathname', '/lol');
  });

  test('Parses query', () => {
    const parsed = parseUrl('https://test.com/lol?foo=bar&lol=1337');
    expect(parsed.search).toMatchObject({
      foo: 'bar',
      lol: 1337,
    });
  });

});

describe('util/request', () => {
  test('Simple GET request', async () => {
    expect.assertions(1);
    const response = await request({
      url: 'https://jsonplaceholder.typicode.com/todos/1',
    });

    expect(response).toMatchObject({ id: 1 });
  });

  test('Error no URL', async () => {
    expect.assertions(1);

    try {
      await request({ url: '' });
    } catch (e) {
      expect(e.toString()).toBe('Error: No URL provided');
    }
  });
});

describe('util/humanSize', () => {
  test('Returns expected value', () => {
    expect(humanSize(2 * Byte)).toBe('2 B');
    expect(humanSize(2 * Kilobyte)).toBe('2 kB');
    expect(humanSize(2 * Megabyte)).toBe('2 MB');
    expect(humanSize(2 * Gigabyte)).toBe('2 GB');
  });
});

describe('util/humanSeconds', () => {
  test('Returns expected value', () => {
    expect(humanSeconds(12345)).toBe('3:25:45');
    expect(humanSeconds(3600 * 1.5)).toBe('1:30:00');
  });
});

describe('util/ucFirst', () => {
  test('Returns expected value', () => {
    expect(ucFirst('lol')).toBe('Lol');
  });
});

describe('util/trunc', () => {
  test('Returns expected value', () => {
    expect(trunc('Really long string', 10)).toBe('Really lon&hellip;');
  });
});

describe('util/simplifyCategory', () => {
  test('Returns expected value', () => {
    expect(simplifyCategory('Movies > New > Lol')).toBe('movies');
  });
});
