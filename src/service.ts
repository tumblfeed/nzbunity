import { Downloader, SABnzbd, NZBGet } from "./downloader";
import {
  getOptions,
  watchOptions,
  DownloaderType,
  getActiveDownloader,
  getDefaultDownloader,
  watchActiveDownloader,
  type DownloaderOptions,
} from "./store";

export const downloaders = {
  [DownloaderType.SABnzbd]: SABnzbd,
  [DownloaderType.NZBGet]: NZBGet,
};

export async function useDownloader(downloaderOptions?: DownloaderOptions): Promise<{ downloader: Downloader | undefined }> {
  if (!downloaderOptions) {
    downloaderOptions = await getActiveDownloader();
  }

  let downloader;
  if (downloaders[downloaderOptions?.Type!]) {
    downloader = new downloaders[downloaderOptions!.Type!](downloaderOptions);
  }

  return {
    downloader,
  }
}