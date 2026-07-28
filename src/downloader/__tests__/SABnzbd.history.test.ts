import { describe, it, expect, vi, afterEach } from 'vitest';
import { DefaultDownloaderOptions, DownloaderType } from '~/store';
import { SABnzbd } from '../SABnzbd';

const downloaderOptions = {
  ...DefaultDownloaderOptions,
  Name: 'Test SAB',
  Type: DownloaderType.SABnzbd,
  ApiUrl: 'http://localhost:7357/api',
  ApiKey: 'testkey',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SABnzbd.getHistory', () => {
  it('maps a completed slot with no message', async () => {
    const client = new SABnzbd(downloaderOptions);
    vi.spyOn(client, 'call').mockResolvedValue({
      success: true,
      result: {
        slots: [
          {
            nzo_id: 'SABnzbd_nzo_1',
            status: 'Completed',
            name: 'Ubuntu.24.04.Desktop.ISO',
            category: 'software',
            bytes: '4700000000',
            fail_message: '',
          },
        ],
      },
    });

    const history = await client.getHistory();

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: 'SABnzbd_nzo_1',
      status: 'Completed',
      name: 'Ubuntu.24.04.Desktop.ISO',
      message: undefined,
    });
  });

  it('maps a failed slot and surfaces the fail_message as the reason', async () => {
    const client = new SABnzbd(downloaderOptions);
    vi.spyOn(client, 'call').mockResolvedValue({
      success: true,
      result: {
        slots: [
          {
            nzo_id: 'SABnzbd_nzo_2',
            status: 'Failed',
            name: 'Some.Movie.2026',
            category: 'movies',
            bytes: '0',
            fail_message: 'Unpacking failed, write error or disk is full?',
          },
        ],
      },
    });

    const history = await client.getHistory();

    expect(history[0]).toMatchObject({
      id: 'SABnzbd_nzo_2',
      status: 'Failed',
      message: 'Unpacking failed, write error or disk is full?',
    });
  });

  it('returns an empty array when the call fails', async () => {
    const client = new SABnzbd(downloaderOptions);
    vi.spyOn(client, 'call').mockResolvedValue({ success: false, error: 'Timed out' });

    const history = await client.getHistory();

    expect(history).toEqual([]);
  });
});
