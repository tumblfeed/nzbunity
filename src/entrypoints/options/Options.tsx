import {
  PiArrowFatLineRightDuotone as Current,
  PiFilePlusDuotone as Add,
} from 'react-icons/pi';
import { Tooltip } from 'react-tooltip';

import { useLogger, useOptions } from '~/service';
import {
  type NZBUnityOptions,
  DefaultOptions,
  type DownloaderOptions,
  DefaultDownloaderOptions,
  getDownloaders,
  setDownloaders,
  setActiveDownloader,
  getActiveDownloader,
  type IndexerOptions,
} from '~/store';
import { Megabyte, trunc, debounce } from '~/utils';
import DownloaderForm from './DownloaderForm';
import './Options.css';

function Options() {
  const logger = useLogger('Options');
  const [options, setOptions] = useOptions();

  const downloaderNames = () => Object.keys(options?.Downloaders || {});

  const [currentDownloader, setCurrentDownloader] = useState<DownloaderOptions | null>(
    null,
  );

  const addDownloader = () => {
    logger.debug('addDownloader');
    setCurrentDownloader({
      ...DefaultDownloaderOptions,
      Name: downloaderNames().length ? '' : 'Default',
    });
  };

  const saveDownloader = async (downloader: DownloaderOptions) => {
    logger.debug('saveDownloader', downloader);
    if (!options) return;

    const downloaders = await getDownloaders();
    downloaders[downloader.Name] = downloader;
    await setDownloaders(downloaders);
    setCurrentDownloader(downloader);

    // If this is the only downloader, set it as active
    if (Object.keys(downloaders).length === 1) {
      await setActiveDownloader(downloader.Name);
    }
  };

  const removeDownloader = async (downloader?: DownloaderOptions) => {
    logger.debug('removeDownloader');
    const name = downloader?.Name ?? currentDownloader?.Name;
    if (!options || !name) return;

    let active = await getActiveDownloader();

    const downloaders = await getDownloaders();
    delete downloaders[name];
    await setDownloaders(downloaders);
    setCurrentDownloader(null);

    // If this was the active downloader,
    // set the first downloader as active or clear
    if (active?.Name === name) {
      active = Object.values(downloaders)[0] || null;
      await setActiveDownloader(active?.Name);
    }
  };

  const saveIndexer = async (name: string, indexer: IndexerOptions) => {
    logger.debug('saveIndexer', indexer);
    if (!options) return;

    const indexers = options.Indexers;
    indexers[name] = indexer;
    setOptions({ Indexers: indexers });
  };

  const resetOptions = async () => {
    logger.debug('resetOptions');
    if (
      confirm(
        'Are you sure you want to reset all settings to default? This cannot be undone.',
      )
    ) {
      await setOptions(DefaultOptions);
    }
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
              {downloaderNames().map((name) => (
                <li
                  className={currentDownloader?.Name === name ? 'active' : ''}
                  key={name}
                  onClick={() => setCurrentDownloader(options!.Downloaders[name])}
                >
                  {name}
                  {currentDownloader?.Name === name && <Current />}
                </li>
              ))}
            </ul>
            <div>
              <button onClick={addDownloader}>
                <Add /> Add
              </button>
            </div>
          </div>

          {currentDownloader ? (
            <DownloaderForm
              currentDownloader={currentDownloader}
              invalidNames={downloaderNames().filter(
                (name) => name !== currentDownloader?.Name,
              )}
              onSaved={saveDownloader}
              onRemoved={removeDownloader}
            />
          ) : (
            <div>
              {downloaderNames().length > 0 ? (
                <p>
                  Select a downloader to edit or click Add to create a new downloader.
                </p>
              ) : (
                <p>
                  No downloaders have been added yet; click Add to create a new
                  downloader.
                </p>
              )}
              <div className="actions right">
                <button onClick={addDownloader}>
                  <Add /> Add Downloader
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="indexers">
        <h2>Indexers</h2>

        <div id="indexer-container">
          <p>Enable 1-click downloading for the following sites:</p>

          <ul>
            {Object.entries(options?.Indexers || {})
              .filter(([, indexer]) => indexer.Display !== false)
              .map(([name, indexer]) => (
                <li key={name}>
                  <label>
                    <input
                      type="checkbox"
                      name={`Indexer-${name}`}
                      checked={indexer.Enabled ?? options?.IndexerEnabled ?? false}
                      onChange={(e) =>
                        saveIndexer(name, { ...indexer, Enabled: e.target.checked })
                      }
                    />
                    {typeof indexer.Display === 'string' ? indexer.Display : name}
                  </label>
                </li>
              ))}
          </ul>
        </div>

        <div
          data-tooltip-id="tooltip"
          data-tooltip-html="
            Comma separated hostnames for Newznab sites to enable 1-click downloading
          "
        >
          <label htmlFor="IndexerNewznab">Newznab Indexers:</label>
          <input
            type="text"
            name="IndexerNewznab"
            placeholder="mynewznab.com,otherprovider.com"
            value={options?.IndexerNewznab ?? DefaultOptions.IndexerNewznab}
            onChange={(e) => setOptions({ IndexerNewznab: e.target.value })}
          />
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              name="ReplaceLinks"
              checked={options?.ReplaceLinks ?? DefaultOptions.ReplaceLinks}
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
              checked={options?.IgnoreCategories ?? DefaultOptions.IgnoreCategories}
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
              checked={options?.SimplifyCategories ?? DefaultOptions.SimplifyCategories}
              onChange={(e) => setOptions({ SimplifyCategories: e.target.checked })}
            />
            Simplify category names to just the primary category (eg. "Movies &gt; HD"
            will be changed to "movies")
          </label>
        </div>

        <div
          data-tooltip-id="tooltip"
          data-tooltip-html="
            Optional, if no category can be determined from site or NZB headers, this
            category will be sent instead.
          "
        >
          <label htmlFor="DefaultCategory">Default category:</label>
          <input
            type="text"
            name="DefaultCategory"
            value={options?.DefaultCategory ?? ''}
            onChange={(e) => setOptions({ DefaultCategory: e.target.value || null })}
            // Default is null
          />
        </div>

        <div>
          <label htmlFor="RefreshRate">Refresh Rate:</label>
          <select
            name="RefreshRate"
            value={options?.RefreshRate ?? DefaultOptions.RefreshRate}
            onChange={(e) => setOptions({ RefreshRate: Number(e.target.value) })}
          >
            <option value="10">10 seconds</option>
            <option value="15">15 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">60 seconds</option>
          </select>
        </div>

        {/* Currently does nothing, so let's not show it
        <div>
          <label>
            <input
              type="checkbox"
              name="EnableNotifications"
              checked={options?.EnableNotifications ?? DefaultOptions.EnableNotifications}
              onChange={(e) => setOptions({ EnableNotifications: e.target.checked })}
            />
            Enable Notifications
          </label>
        </div>
        */}

        <div>
          <label>
            <input
              type="checkbox"
              name="Debug"
              checked={options?.Debug ?? DefaultOptions.Debug}
              onChange={(e) => setOptions({ Debug: e.target.checked })}
            />
            Show Debug Messages on Popup UI (might help debug category naming)
          </label>
        </div>

        <div>
          <p>Click to reset all settings to default</p>
          <button onClick={resetOptions}>Reset</button>
        </div>
      </section>

      <Tooltip id="tooltip" place="bottom" />
    </>
  );
}

export default Options;
