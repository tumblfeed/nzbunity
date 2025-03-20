import { use, useEffect, useMemo } from 'react';
import { PiStarDuotone as Current, PiFilePlusDuotone as Add } from 'react-icons/pi';

import { Client } from '@/Client';
import { useLogger } from '@/logger';
import { useIsFirstRender, useOptions } from '@/service';
import {
  type DownloaderOptions,
  DefaultDownloaderOptions,
  DownloaderType,
  getDownloaders,
  setDownloaders,
} from '@/store';
import { Megabyte, trunc, debounce } from '@/utils';
import DownloaderForm from './DownloaderForm';
import './Options.css';

function Options() {
  const logger = useLogger('Options');
  const isFirstRender = useIsFirstRender();
  const [options, setOptions, setDownloader] = useOptions();

  const [currentDownloader, setCurrentDownloader] = useState<DownloaderOptions | null>(
    null,
  );

  const addDownloader = async (downloader: DownloaderOptions) => {
    logger.debug('addDownloader', downloader);
    if (!options) return;

    const downloaders = await getDownloaders();
    downloaders[downloader.Name] = downloader;
    await setDownloaders(downloaders);
  };

  const removeDownloader = async (downloader?: DownloaderOptions) => {
    logger.debug('removeDownloader');
    const name = downloader?.Name ?? currentDownloader?.Name;
    if (!options || !name) return;

    const downloaders = await getDownloaders();
    delete downloaders[name];
    await setDownloaders(downloaders);
  };

  return (
    <>
      <h1>NZB Unity Options</h1>
      <div id="Version">{options?.Version}</div>

      <section id="downloaders">
        <h2>Download Clients</h2>

        <div id="downloader-container">
          <div id="downloader-list">
            <ul>
              {Object.keys(options?.Downloaders || {}).map((name) => (
                <li
                  key={name}
                  onClick={() => setCurrentDownloader(options!.Downloaders[name])}
                >
                  {name}
                  {currentDownloader?.Name === name && <Current />}
                </li>
              ))}
            </ul>
            <button id="AddDownloader">
              <Add /> Add Downloader
            </button>
          </div>

          <DownloaderForm
            currentDownloader={currentDownloader}
            invalidNames={Object.keys(options?.Downloaders || {}).filter(
              (name) => name !== currentDownloader?.Name,
            )}
            onUpdated={addDownloader}
            onRemoved={removeDownloader}
          />
        </div>
      </section>

      <section id="indexers">
        <h2>Indexers</h2>

        <div id="indexer-container">
          <p>Enable 1-click downloading for the following sites:</p>

          <ul>
            {Object.keys(options?.Indexers || {}).map((name) => (
              <li>{name}</li>
            ))}
          </ul>
        </div>

        <div className="tooltip">
          <label htmlFor="IndexerNewznab">Newznab Indexers:</label>
          <input
            type="text"
            name="IndexerNewznab"
            placeholder="mynewznab.com,otherprovider.com"
            value={options?.IndexerNewznab}
            onChange={(e) => setOptions({ IndexerNewznab: e.target.value })}
          />
          <span className="tooltiptext">
            Comma separated hostnames for Newznab sites to enable 1-click downloading
          </span>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              name="ReplaceLinks"
              checked={options?.ReplaceLinks}
              onChange={(e) => setOptions({ ReplaceLinks: e.target.checked })}
            />
            Replace download links on 1-click sites instead of adding an additional
            download button
          </label>
        </div>
      </section>

      <section id="settings">
        <h2>General Settings</h2>

        <div>
          <label>
            <input
              type="checkbox"
              name="IgnoreCategories"
              checked={options?.IgnoreCategories}
              onChange={(e) => setOptions({ IgnoreCategories: e.target.checked })}
            />
            Do not pass categories to the downloader, use group names from NZB only (this
            will disable all other category options)
          </label>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              name="SimplifyCategories"
              checked={options?.SimplifyCategories}
              onChange={(e) => setOptions({ SimplifyCategories: e.target.checked })}
            />
            Simplify category names to just the primary category (eg. "Movies &gt; HD"
            will be changed to "movies")
          </label>
        </div>

        <div className="tooltip">
          <label htmlFor="DefaultCategory">Default category:</label>
          <input
            type="text"
            name="DefaultCategory"
            value={options?.DefaultCategory || ''}
            onChange={(e) => setOptions({ DefaultCategory: e.target.value })}
          />
          <span className="tooltiptext">
            Optional, if no category can be determined from site or NZB headers, this
            category will be sent instead
          </span>
        </div>

        <div>
          <label htmlFor="RefreshRate">Refresh Rate:</label>
          <select
            name="RefreshRate"
            value={options?.RefreshRate}
            onChange={(e) => setOptions({ RefreshRate: Number(e.target.value) })}
          >
            <option value="10">10 seconds</option>
            <option value="15">15 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">60 seconds</option>
          </select>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              name="EnableNotifications"
              checked={options?.EnableNotifications}
              onChange={(e) => setOptions({ EnableNotifications: e.target.checked })}
            />
            Enable Notifications
          </label>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              name="Debug"
              checked={options?.Debug}
              onChange={(e) => setOptions({ Debug: e.target.checked })}
            />
            Show Debug Messages on Popup UI (might help debug category naming)
          </label>
        </div>

        <div>
          <p>Click to reset all settings to default</p>
          <button id="ResetOptions">Reset</button>
        </div>
      </section>
    </>
  );
}

export default Options;
