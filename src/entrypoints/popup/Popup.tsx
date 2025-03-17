import { useEffect, useMemo } from 'react';
import {
  PiPlayCircleDuotone as PlayCircle,
  PiPauseCircleDuotone as PauseCircle,
} from 'react-icons/pi';

import { type NZBQueue, type Downloader } from '@/downloader';
import { useLogger } from '@/logger';
import { useOptions, useClient } from '@/service';
import { Megabyte, trunc, debounce } from '@/utils';
import './Popup.css';

function Popup() {
  const logger = useLogger('Popup', 1);
  const [options, setOptions] = useOptions();
  const [client, setDownloader] = useClient();

  // Max Speed - Sync with the server and debounce
  const [maxSpeed, _setMaxSpeed] = useState<string>('');
  const updateMaxSpeed = debounce(async () => {
    let mb = parseFloat(maxSpeed || '0');
    if (mb < 1.0) mb = 0;
    logger.debug(`setMaxSpeed ${maxSpeed} ${mb * Megabyte}`);
    await client?.setMaxSpeed(mb * Megabyte);
  }, 500);
  const setMaxSpeed = (val: string) => {
    _setMaxSpeed(val);
    updateMaxSpeed();
  };

  useEffect(() => {
    logger.debug('popup queue', client);
  }, [client]);

  return (
    <>
      <div id="head">
        <div id="Version">{options?.Version}</div>
        <div id="errors"></div>

        <div id="profile">
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
        </div>
      </div>

      <div id="summary">
        <span id="QueuePause">
          {client?.status?.toLowerCase() === 'downloading' && (
            <PauseCircle className="icon" onClick={() => client?.pauseQueue()} />
          )}
          {client?.status?.toLowerCase() === 'paused' && (
            <PlayCircle className="icon" onClick={() => client?.resumeQueue()} />
          )}
          <PlayCircle className="icon" onClick={() => console.log('Play clicked')} />
          <span id="QueueStatus">{client?.status || 'Unknown'}</span>
        </span>

        <span>
          <span id="QueueSpeed">{client?.speed || '0 B/s'}</span>
          <span id="QueueMaxSpeed">({client?.maxSpeed || '0'})</span>
        </span>

        <span>
          <span id="QueueSizeRemaining">{client?.sizeRemaining || '0 B'}</span>
          <span id="QueueTimeRemaining">({client?.timeRemaining || '∞'})</span>
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
              <span className="name" title={item.name}>
                {trunc(item.name, 30)}
              </span>
              <span className="category">{item.category || ''}</span>
              <span className="size">{item.size || ''}</span>
              <span className="bar" style={{ width: `${item.percentage}%` }}></span>
            </div>
          ))
        ) : (
          <div id="queueEmpty" className="empty">
            Queue empty, add some NZBs!
          </div>
        )}
      </div>

      <div id="debug" className="show">
        {(options?.Debug || true) &&
          logger.entries.toReversed().map((entry, i) => (
            <div key={i} className={`${entry.level} green`} title={entry.formatted}>
              {entry.formatted}
            </div>
          ))}
      </div>

      <nav id="menu">
        <a id="btn-refresh" className="btn btn-info disabled" title="Refresh">
          <i className="icon fa fa-refresh"></i>
        </a>
        <a
          id="btn-server"
          className="btn btn-info disabled"
          title="Open downloader web UI"
        >
          <i className="icon fa fa-server"></i>
        </a>
        <a id="btn-options" className="btn btn-info" title="Open options">
          <i className="icon fa fa-gear"></i>
        </a>
      </nav>
    </>
  );
}

export default Popup;
