import { queryToObject } from '.';

test('getQuery', () => {
    console.debug(queryToObject(''));

    expect(queryToObject('')).toBeTruthy();

    const queryString = '?foo=bar&num=1&bln=true&nil=&str=hello';

    expect(queryToObject(queryString)).toMatchObject({
        foo: 'bar',
        num: '1',
        bln: 'true',
        nil: '',
        str: 'hello',
    });

});