import { getQuery } from '.';

test('getQuery', () => {
    const search = '?foo=bar&num=1&bln=true&nil=&str=hello';
    const query = getQuery(search);

    expect(query).toMatchObject({
        foo: 'bar',
        num: '1',
        bln: 'true',
        nil: '',
        str: 'hello',
    });
});