import { describe, it, expect, vi, afterEach } from 'vitest';
import { DefaultDownloaderOptions, DownloaderType } from '~/store';
import { NZBGet } from '../NZBGet';

const downloaderOptions = {
  ...DefaultDownloaderOptions,
  Name: 'Test NZBGet',
  Type: DownloaderType.NZBGet,
  ApiUrl: 'http://localhost:6789/jsonrpc',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NZBGet.getHistory', () => {
  it('maps a SUCCESS status to Completed with no message', async () => {
    const client = new NZBGet(downloaderOptions);
    vi.spyOn(client, 'call').mockResolvedValue({
      success: true,
      result: [
        {
          NZBID: 101,
          Status: 'SUCCESS/ALL',
          NZBNicename: 'Ubuntu.24.04.Desktop.ISO',
          Category: 'software',
          FileSizeMB: 4700,
        },
      ],
    });

    const history = await client.getHistory();

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: '101',
      status: 'Completed',
      name: 'Ubuntu.24.04.Desktop.ISO',
      message: undefined,
    });
  });

  it('maps a known FAILURE reason code to a friendly message', async () => {
    const client = new NZBGet(downloaderOptions);
    vi.spyOn(client, 'call').mockResolvedValue({
      success: true,
      result: [
        {
          NZBID: 102,
          Status: 'FAILURE/PAR',
          NZBNicename: 'Some.Movie.2026',
          Category: 'movies',
          FileSizeMB: 1200,
        },
      ],
    });

    const history = await client.getHistory();

    expect(history[0]).toMatchObject({
      id: '102',
      status: 'Failed',
      message: 'Par verification failed',
    });
  });

  it('falls back to a readable label for unmapped reason codes', async () => {
    const client = new NZBGet(downloaderOptions);
    vi.spyOn(client, 'call').mockResolvedValue({
      success: true,
      result: [
        {
          NZBID: 103,
          Status: 'WARNING/SOMETHING_NEW',
          NZBNicename: 'Odd.Case',
          Category: '',
          FileSizeMB: 10,
        },
      ],
    });

    const history = await client.getHistory();

    expect(history[0].status).toBe('Failed');
    expect(history[0].message).toBe('Warning: SOMETHING_NEW');
  });

  it('returns an empty array when the call fails', async () => {
    const client = new NZBGet(downloaderOptions);
    vi.spyOn(client, 'call').mockResolvedValue({ success: false, error: 'Timed out' });

    const history = await client.getHistory();

    expect(history).toEqual([]);
  });
});
