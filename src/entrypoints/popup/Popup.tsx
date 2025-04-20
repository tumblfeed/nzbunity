import { useEffect, useMemo } from 'react';
import {
  PiClockClockwiseDuotone as Refreshing,
  PiDownloadDuotone as Downloading,
  PiPauseDuotone as Paused,
  PiQueueDuotone as Queued,
  PiPlayCircleDuotone as Play,
  PiPauseCircleDuotone as Pause,
  PiXCircleDuotone as Cancel,
  PiArrowClockwiseBold as Refresh,
  PiArrowSquareOutDuotone as OpenUI,
  PiGearDuotone as Options,
} from 'react-icons/pi';

import { Client } from '~/Client';
import { useLogger, useIsFirstRender, useOptions } from '~/service';
import { Megabyte, trunc, debounce } from '~/utils';
import './Popup.css';

function Popup() {
  const logger = useLogger('Popup', 1);
  const isFirstRender = useIsFirstRender();
  const [options, setOptions, setDownloader] = useOptions();

  const client = useMemo(() => Client.getInstance(), []);

  const downloaderNames = () => Object.keys(options?.Downloaders || {});

  // Max Speed - Sync with the server and debounce
  const updateMaxSpeed = debounce(async (val: string) => {
    let mb = parseFloat(val || '0');
    if (mb < 1.0) mb = 0;
    logger.debug(`updateMaxSpeed ${maxSpeed} ${mb * Megabyte}`);
    await client?.setMaxSpeed(mb * Megabyte);
  }, 500);
  // local state for the input
  const [maxSpeed, setMaxSpeed] = useState<string>('');
  useEffect(() => {
    if (!isFirstRender) updateMaxSpeed(maxSpeed);
  }, [maxSpeed]);

  // Open options page
  const openOptions = () => {
    browser.runtime.openOptionsPage();
  };

  useEffect(() => {
    logger.debug('popup client', client);
  }, [client]);

  return (
    <>
      <div id="head">
        <div id="Refreshing">{client?.refreshing && <Refreshing className="icon" />}</div>
        <div id="Version">{options?.Version}</div>
        <div id="errors"></div>

        <div id="profile">
          {downloaderNames().length > 1 ? (
            <>
              <span>Active Downloader:</span>
              <select
                id="ActiveDownloader"
                className="custom-select"
                value={client?.name}
                onChange={(e) => setDownloader(e.target.value)}
              >
                {Object.keys(options?.Downloaders || {}).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </>
          ) : client?.name ? (
            <span>{client?.name}</span>
          ) : (
            <span>NZB Unity</span>
          )}
        </div>
      </div>

      {client?.downloader ? (
        <>
          <div id="summary">
            <span id="QueuePause">
              {client.isDownloading() && (
                <Pause className="icon" onClick={() => client?.pauseQueue()} />
              )}
              {client.isPaused() && (
                <Play className="icon" onClick={() => client?.resumeQueue()} />
              )}
              <span>{client?.status || 'Unknown'}</span>
            </span>

            <span>
              <span title="Download Speed">{client?.speed || '0 B/s'}</span>
              <span title="Max Speed">({client?.maxSpeed || '0'})</span>
            </span>

            <span>
              <span title="Size Remaining">{client?.sizeRemaining || '0 B'}</span>
              <span title="Time Temaining">({client?.timeRemaining || '∞'})</span>
            </span>
          </div>

          <div id="controls">
            <div id="override">
              <span>Override Category</span>
              <select
                id="OverrideCategory"
                className="custom-select"
                value={options?.OverrideCategory ?? ''}
                onChange={(e) => setOptions({ OverrideCategory: e.target.value })}
                disabled={!client}
              >
                <option key="" value=""></option>
                {client?.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div id="max-speed">
              <span>Max Speed</span>
              <span>
                <input
                  id="MaxSpeed"
                  type="number"
                  step="0.1"
                  min="0"
                  value={maxSpeed}
                  onChange={(e) => setMaxSpeed(e.target.value)}
                />
                MB/s
              </span>
            </div>
          </div>

          <div id="queue">
            {client?.queue?.length ? (
              client.queue.map((item) => (
                <div key={item.id} className="nzb">
                  <span className="status">
                    {client.isDownloading(item) && <Downloading title="Downloading" />}
                    {client.isPaused(item) && <Paused title="Paused" />}
                    {client.isQueued(item) && <Queued title="Queued" />}
                  </span>
                  {isNaN(item.percentage) || (
                    <span className="progress">{item.percentage}%</span>
                  )}
                  <span
                    className="name"
                    title={`${item.name} [${item.category}]`}
                    // title={`${item.name} [${item.category}] [${item.id}]`}
                  >
                    {/* {item.name} */}
                    <span className="clip">{item.name}</span>
                  </span>
                  <span className="category">{item.category || ''}</span>
                  <span className="size">{item.size || ''}</span>
                  <span className="nzb-actions">
                    {client.isDownloading(item) && (
                      <Pause
                        title="Pause Download"
                        onClick={() => client?.pauseId(item.id)}
                      />
                    )}
                    {client.isPaused(item) && (
                      <Play
                        title="Resume Download"
                        onClick={() => client?.resumeId(item.id)}
                      />
                    )}
                    <Cancel
                      title="Cancel & Remove NZB"
                      onClick={() =>
                        confirm('Are you sure?') && client?.removeId(item.id)
                      }
                    />
                  </span>
                  <span className="bar" style={{ width: `${item.percentage}%` }}></span>
                </div>
              ))
            ) : (
              <div id="queueEmpty" className="empty">
                Queue empty, add some NZBs!
              </div>
            )}
          </div>
        </>
      ) : downloaderNames().length > 0 ? (
        <div id="summary" className="empty">
          <Refresh fontSize={'2rem'} />
        </div>
      ) : (
        <div id="summary" className="empty">
          <p>
            No downloaders configured, please add one in <Options onClick={openOptions} />{' '}
            Options.
          </p>
        </div>
      )}

      {options?.Debug && (
        <div id="debug" className="show">
          {logger.entries.map((entry, i) => (
            <div key={i} className={`${entry.level} green`} title={entry.formatted}>
              {entry.formatted}
            </div>
          ))}
        </div>
      )}

      <nav id="menu">
        <button
          title="Refresh"
          disabled={!client?.downloader}
          onClick={() => client?.refresh()}
        >
          <Refresh />
        </button>
        <button title="Open downloader web UI" onClick={() => client?.openWebUI()}>
          <OpenUI />
        </button>
        <button title="Open options" onClick={openOptions}>
          <Options />
        </button>
      </nav>
    </>
  );
}

export default Popup;
