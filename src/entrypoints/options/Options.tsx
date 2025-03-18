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
  // PiGearDuotone as Options,
} from 'react-icons/pi';

import { Client } from '@/Client';
import { useLogger } from '@/logger';
import { useIsFirstRender, useOptions } from '@/service';
import { Megabyte, trunc, debounce } from '@/utils';
import './Options.css';

function Options() {
  const logger = useLogger('Options', 1);
  const isFirstRender = useIsFirstRender();
  const [options, setOptions, setDownloader] = useOptions();

  // Don't need this for now
  // const client = useMemo(() => Client.getInstance(), []);

  return (
    <>
      <h1>NZB Unity Options</h1>

      <div className="container">
        <div id="Version"></div>
        <form id="FormSettings">
          {/* <!-- Connection Settings --> */}
          <h2>Server Profiles</h2>

          <div className="options-pane">
            <div className="row">
              <div className="d-flex col-12 col-sm-10 col-md-6 col-lg-4">
                <label htmlFor="ProfileCurrent">Profile:</label>
                <select
                  id="ProfileCurrent"
                  name="ProfileCurrent"
                  className="custom-select"
                ></select>
              </div>
              <div className="col-12 col-md-3 text-center">
                <div
                  id="profile-controls"
                  className="btn-group"
                  role="group"
                  aria-label="Profile controls"
                >
                  <button
                    id="profileCreate"
                    className="btn btn-sm btn-info"
                    data-toggle="tooltip"
                    title="Creates a new, blank profile"
                  >
                    <i className="fa fa-plus"></i>
                    Create
                  </button>
                  <button
                    id="profileDuplicate"
                    className="btn btn-sm btn-secondary"
                    data-toggle="tooltip"
                    title="Copies the current profile into a new profile"
                  >
                    <i className="fa fa-clone"></i>
                    Duplicate
                  </button>
                  <button
                    id="profileDelete"
                    className="btn btn-sm btn-danger"
                    data-toggle="tooltip"
                    title="Deletes the current profile"
                  >
                    <i className="fa fa-minus"></i>
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <div className="row">
              <div
                id="profile-container"
                className="col-12 col-sm-11 col-md-9 col-lg-7 col-xl-6"
              >
                <div className="form-row">
                  <div className="col-form-label col-12 col-sm-4">
                    <label htmlFor="ProfileName">Profile Name:</label>
                  </div>
                  <div className="col-12 col-sm-8">
                    <input
                      type="text"
                      id="ProfileName"
                      name="ProfileName"
                      className="form-control form-control-sm"
                      data-toggle="tooltip"
                      title="Name to show in the profile dropdown"
                      disabled
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="col-form-label col-12 col-sm-4">
                    <label htmlFor="ProfileType">Type:</label>
                  </div>
                  <div className="col-12 col-sm-8">
                    <select
                      id="ProfileType"
                      name="ProfileType"
                      className="custom-select form-control-sm"
                      disabled
                    >
                      <option value="SABnzbd">SABnzbd</option>
                      <option value="NZBGet">NZBGet</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="col-form-label col-12 col-sm-4">
                    <label htmlFor="ProfileHost">API URL:</label>
                  </div>
                  <div className="col-12 col-sm-8">
                    <input
                      type="text"
                      id="ProfileHost"
                      name="ProfileHost"
                      className="form-control form-control-sm"
                      data-toggle="tooltip"
                      title="Full URL to connect to downloader API.
                  <p>
                    When Test Connection is clicked, NZBUnity will attempt to automatically find the
                    full API URL using smart defaults (if 'exactly as shown' is not checked).
                  </p>
                  <p>
                    For example:
                    <br>
                    Entering '192.168.1.123' will try 'http://192.168.1.123:8080/api', etc.
                    <br>
                    If the URL cannot be automatically found (ie, you are using a non-standard port or proxy),
                    please try the full URL from your downloader UI without path.
                  </p>"
                      disabled
                    />
                  </div>
                </div>

                <div className="form-row" style={{ marginTop: '-0.5rem' }}>
                  <div className="col-form-label col-12 col-sm-4">&nbsp;</div>
                  <div className="col-12 col-sm-8">
                    <label
                      className="form-check-label"
                      style={{ marginLeft: '1.25rem' }}
                      data-toggle="tooltip"
                      title="If checked, disables URL finding for the API, and will only use this exact URL.
                  <p>
                    If NZBUnity found the URL automatically, this option will be automatically checked.
                    This must be the <em>full URL</em> of your API endpoint, including protocol, port, and path.
                    You may want to set 'Open web UI' URL as well.
                  </p>
                  <p>
                    For example:
                    <br>
                    SABnzbd - http://localhost:8080/api
                    <br>
                    NZBGet - http://localhost:6789/jsonrpc
                  </p>"
                    >
                      <input
                        id="ProfileHostAsEntered"
                        name="ProfileHostAsEntered"
                        className="form-check-input"
                        type="checkbox"
                        value=""
                        disabled
                      />
                      Use API URL exactly as shown
                    </label>
                  </div>
                </div>

                <div className="form-row">
                  <div className="col-form-label col-12 col-sm-4">
                    <label htmlFor="ProfileApiKey">API Key:</label>
                  </div>
                  <div className="col-12 col-sm-8">
                    <input
                      type="text"
                      id="ProfileApiKey"
                      name="ProfileApiKey"
                      className="form-control form-control-sm"
                      data-toggle="tooltip"
                      title="SABnzbd API Key"
                      disabled
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="col-form-label col-12 col-sm-4">
                    <label htmlFor="ProfileUsername">Username:</label>
                  </div>
                  <div className="col-12 col-sm-8">
                    <input
                      type="text"
                      id="ProfileUsername"
                      name="ProfileUsername"
                      className="form-control form-control-sm"
                      data-toggle="tooltip"
                      title="NZBGet API Username"
                      disabled
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="col-form-label col-12 col-sm-4">
                    <label htmlFor="ProfilePassword">Password:</label>
                  </div>
                  <div className="col-12 col-sm-8">
                    <input
                      type="text"
                      id="ProfilePassword"
                      name="ProfilePassword"
                      className="form-control form-control-sm"
                      data-toggle="tooltip"
                      title="NZBGet API Password"
                      disabled
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="col-form-label col-12 col-sm-4">
                    <label htmlFor="ProfileServerUrl">"Open web UI" URL:</label>
                  </div>
                  <div className="col-12 col-sm-8">
                    <input
                      type="text"
                      id="ProfileServerUrl"
                      name="ProfileServerUrl"
                      className="form-control form-control-sm"
                      placeholder="Optional, defaults to Host"
                      data-toggle="tooltip"
                      title="Optional, page URL to open when clicking the
                  <br>Open web UI button (<i className='icon fa fa-server'></i>) on the toolbar UI.
                  <br>Defaults to API URL value above."
                      disabled
                    />
                  </div>
                </div>

                <div className="form-row mt-2">
                  <div className="col-12 text-center">
                    <button id="profileTest" className="btn btn-sm btn-info">
                      Test Connection
                      <span className="icon"></span>
                    </button>
                  </div>
                  <div id="profileTest-result" className="col-12 text-center"></div>
                </div>

                <div
                  id="profileTestRequired"
                  className="row mt-2 text-justify"
                  style={{ display: 'none' }}
                >
                  <div className="col-12 px-2 text-center text-info">
                    <strong>Important!</strong>
                    <p>
                      Please click the Test Connection button after entering your
                      settings.
                    </p>
                  </div>
                  <div className="col-12 text-muted small">
                    <p>
                      This will allow NZBUnity to find and verify the full URL to your
                      downloader API (e.g. <em>http://192.168.1.123:8080/api</em>).
                    </p>
                    <p>
                      If a valid URL is found, your settings will be updated
                      automatically.
                    </p>
                    <p>
                      If a valid URL cannot be found, it is recommended that you try using
                      the URL from your downloader's web UI and test again.
                    </p>
                  </div>
                  <div className="col-12 text-muted small">
                    <p>
                      Legacy settings using a partial URL will still work for backwards
                      compatibility, but recent changes to SABnzbd's defaults require that
                      we not try to guess the URL on start.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* <!-- End Connection Settings --> */}

          {/* <!-- Providers Settings --> */}
          <h2>Providers</h2>

          {/* <!-- <h3>1-Click NZB Downloading</h3> --> */}
          <div className="options-pane">
            <p>Enable 1-click downloading for the following sites:</p>

            <div id="provider-enabled-container"></div>

            <div className="form-row">
              <div className="col-12 col-sm-4 col-md-3 col-lg-2">
                <label htmlFor="ProviderNewznab">Newznab Providers:</label>
              </div>
              <div className="col-12 col-sm-7 col-lg-4">
                <input
                  type="text"
                  id="ProviderNewznab"
                  name="ProviderNewznab"
                  className="form-control form-control-sm"
                  placeholder="mynewznab.com,otherprovider.com"
                  data-toggle="tooltip"
                  title="Comma separated hostnames for Newznab sites to enable 1-click downloading"
                />
              </div>
            </div>

            <div className="form-check" style={{ marginTop: '20px' }}>
              <label className="form-check-label">
                <input
                  id="InterceptDownloads"
                  name="InterceptDownloads"
                  className="form-check-input"
                  type="checkbox"
                  value=""
                />
                Automatically Intercept NZB Downloads (will not work on some sites that
                require authentication)
              </label>
            </div>

            <div className="form-row">
              <div className="col-12 col-sm-4 col-md-3 col-lg-2">
                <label htmlFor="InterceptExclude">Intercept Exclude:</label>
              </div>
              <div className="col-12 col-sm-7 col-lg-4">
                <input
                  type="text"
                  id="InterceptExclude"
                  name="InterceptExclude"
                  className="form-control form-control-sm"
                  placeholder="mynzbhost.com,otherhost.com"
                  data-toggle="tooltip"
                  title="Comma separated hostnames for sites you wish to exclude from NZB Download interception (regex ok)"
                />
              </div>
            </div>

            <div className="form-check" style={{ marginTop: '20px' }}>
              <label className="form-check-label">
                <input
                  id="ReplaceLinks"
                  name="ReplaceLinks"
                  className="form-check-input"
                  type="checkbox"
                  value=""
                />
                Replace download links on 1-click sites instead of adding an additional
                download button
              </label>
            </div>
          </div>

          {/* <!--
    <h3>Display Names</h3>

      <div id="provider-display-container" className="options-pane">
      </div>
    --> */}

          {/* <!-- End Providers Settings --> */}

          {/* <!-- Extension Settings --> */}
          <h2>General Settings</h2>

          <div className="options-pane">
            <div className="form-check">
              <label className="form-check-label">
                <input
                  id="IgnoreCategories"
                  name="IgnoreCategories"
                  className="form-check-input"
                  type="checkbox"
                  value=""
                />
                Do not pass categories to the downloader, use group names from NZB only
                (this will disable all other category options)
              </label>
            </div>

            <div className="form-check">
              <label className="form-check-label">
                <input
                  id="SimplifyCategories"
                  name="SimplifyCategories"
                  className="form-check-input"
                  type="checkbox"
                  value=""
                />
                Simplify category names to just the primary category (eg. "Movies &gt; HD"
                will be changed to "movies")
              </label>
            </div>

            <div className="form-row">
              <div className="col-form-label col-12 col-sm-4 col-md-3 col-lg-2">
                <label htmlFor="DefaultCategory">Default category:</label>
              </div>
              <div className="col-12 col-sm-7 col-md-4">
                <input
                  type="text"
                  id="DefaultCategory"
                  name="DefaultCategory"
                  className="form-control form-control-sm"
                  data-toggle="tooltip"
                  title="Optional, if no category can be determined from site or NZB headers, this category will be sent instead"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="col-form-label col-12 col-sm-4 col-md-3 col-lg-2">
                <label htmlFor="RefreshRate">Refresh Rate:</label>
              </div>
              <div className="col-7 col-sm-4 col-md-3 col-lg-2">
                <select
                  id="RefreshRate"
                  name="RefreshRate"
                  className="custom-select form-control-sm"
                >
                  <option value="10">10 seconds</option>
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">60 seconds</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="col-form-label col-12 col-sm-4 col-md-3 col-lg-2">
                <label htmlFor="UITheme">UI Theme:</label>
              </div>
              <div className="col-7 col-sm-4 col-md-3 col-lg-2">
                <select
                  id="UITheme"
                  name="UITheme"
                  className="custom-select form-control-sm"
                >
                  <option value="">Dark (default)</option>
                  <option value="light">Light</option>
                </select>
              </div>
            </div>

            <div className="form-check">
              <label className="form-check-label">
                <input
                  id="EnableNotifications"
                  name="EnableNotifications"
                  className="form-check-input"
                  type="checkbox"
                  value=""
                />
                Enable Notifications
              </label>
            </div>

            <div className="form-check">
              <label className="form-check-label">
                <input
                  id="EnableNewznab"
                  name="EnableNewznab"
                  className="form-check-input"
                  type="checkbox"
                  value=""
                />
                Enable Automatic Newznab Detection (might slow down some sites)
              </label>
            </div>

            <div className="form-check">
              <label className="form-check-label">
                <input
                  id="Debug"
                  name="Debug"
                  className="form-check-input"
                  type="checkbox"
                  value=""
                />
                Show Debug Messages on Popup UI (might help debug category naming)
              </label>
            </div>

            <div className="form-row" style={{ marginTop: '2rem' }}>
              <div className="col-form-label col-12 col-sm-6 col-md-4 col-lg-3">
                Click to reset all settings to default
              </div>
              <div className="col-12 col-md-1">
                <button id="ResetOptions" className="btn btn-sm btn-danger">
                  Reset
                </button>
              </div>
            </div>
          </div>
          {/* <!-- End Extension Settings --> */}
        </form>
      </div>
      {/* <!-- /.container --> */}
    </>
  );
}

export default Options;
