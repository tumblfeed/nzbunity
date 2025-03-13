import { useEffect, useMemo } from 'react';
import { useOptions, useDownloader } from '@/service';
import './Popup.css';

console.log('Popup loaded');

function Popup() {
  const [options, setOptions] = useOptions();
  const [
    downloader, setDownloader,
    categories,
  ] = useDownloader();

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
            value={downloader?.name}
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

          <span id="statusVal">Idle</span>
        </span>

        <span>
          <span id="speedVal">0 B/s</span>
          <span id="maxSpeedVal">(0)</span>
        </span>

        <span>
          <span id="sizeleftVal">0 B</span>
          <span id="timeleftVal">(∞)</span>
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
            <input id="MaxSpeed" type="number" step="0.1" min="0" />
            MB/s
          </span>
        </div>
      </div>

      <div id="queue">
      </div>

      <div id="debug" className="show pre">
        options: {JSON.stringify(options, null, 2)}
        downloader: {JSON.stringify(downloader, null, 2)}
      </div>

      <nav id="menu">
        <a id="btn-refresh" className="btn btn-info disabled" title="Refresh">
          <i className="icon fa fa-refresh"></i>
        </a>
        <a id="btn-server" className="btn btn-info disabled" title="Open downloader web UI">
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
