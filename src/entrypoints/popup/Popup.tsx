import { useEffect, useMemo } from 'react';
import { useLogger } from '@/logger';
import { useOptions, useDownloader } from '@/service';
import { Megabyte, trunc } from '@/utils';
import './Popup.css';

import { type NZBQueue } from '@/downloader';

function Popup() {
  const [options, setOptions] = useOptions();
  const [{ client, categories, queue }, setDownloader] = useDownloader();
  const logger = useLogger('popup');

  useEffect(() => {
    console.debug('popup client', client);
  }, [client]);

  const [maxSpeed, setMaxSpeedState] = useState<string>('');
  const setMaxSpeed = (val: string) => {
    logger.debug('setMaxSpeed', val);
    let mb = parseFloat(val);
    if (isNaN(mb) || mb <= 0) {
      setMaxSpeedState('');
      return;
    }
    client?.setMaxSpeed(mb * Megabyte);
  };

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
          <span className="icon fa-stack">
            <i className="fa fa-circle fa-stack-2x"></i>
            <i className="icon-glyph fa fa-play fa-stack-1x fa-inverse"></i>
          </span>

          <span id="QueueStatus">{queue?.status || 'Unknown'}</span>
        </span>

        <span>
          <span id="QueueSpeed">{queue?.speed || '0 B/s'}</span>
          <span id="QueueMaxSpeed">({queue?.maxSpeed || '0'})</span>
        </span>

        <span>
          <span id="QueueSizeRemaining">{queue?.sizeRemaining || '0 B'}</span>
          <span id="QueueTimeRemaining">({queue?.timeRemaining || '∞'})</span>
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
          >
            <option value=""></option>
            {categories.map((category) => (
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
        {queue?.queue?.length ? (
          queue.queue.map((item) => (
            <div className="nzb">
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
          logger.entries.map((entry, i) => (
            <div key={i} className={`${entry.level} green`}>
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
