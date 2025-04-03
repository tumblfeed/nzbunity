import { useEffect } from 'react';
import {
  PiCheckFatDuotone as Success,
  PiProhibitInsetDuotone as Failure,
  PiFloppyDiskBackDuotone as Save,
  PiTrashDuotone as Remove,
  PiArrowSquareOutDuotone as OpenUI,
} from 'react-icons/pi';
import { findApiUrl } from '~/Client';
import {
  type DownloaderOptions,
  DefaultDownloaderOptions,
  DownloaderType,
} from '~/store';
import './Options.css';

function DownloaderForm({
  currentDownloader,
  invalidNames = [],
  onSaved = undefined,
  onRemoved = undefined,
}: {
  currentDownloader: DownloaderOptions | null;
  invalidNames: string[];
  onSaved?: (fields: DownloaderOptions) => void;
  onRemoved?: () => void;
}) {
  // Dirty on any change, should check on first save
  const [dirty, setDirty] = useState(false);
  const [shouldCheck, setShouldCheck] = useState(false);
  const [shouldSave, setShouldSave] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  // Fields

  const [fields, _setFields] = useState<DownloaderOptions>({
    ...DefaultDownloaderOptions,
    Name: '',
  });
  const setFields = (newFields: Partial<DownloaderOptions>) => {
    setDirty(true);
    _setFields({ ...fields, ...newFields });
  };

  useEffect(() => {
    if (currentDownloader) {
      setFields(currentDownloader);
    }
  }, [currentDownloader]);

  // Validation

  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const isValid = Object.keys(invalid).length === 0;

  const check = (): boolean => {
    const invalid = {} as Record<string, string>;

    if (!fields.Name) invalid.Name = 'Name is required';
    if (invalidNames.includes(fields.Name)) invalid.Name = 'Name is already in use';
    if (fields.Name.length > 30) invalid.Name = 'Name is too long';

    if (!fields.Type) invalid.Type = 'Type is required';

    if (!fields.ApiUrl) invalid.ApiUrl = 'API URL is required';

    if (fields.Type === DownloaderType.SABnzbd) {
      if (!fields.ApiKey) invalid.ApiKey = 'API Key is required';
    }
    // Disabled, allow for empty username/password
    // if (fields.Type === DownloaderType.NZBGet) {
    //   if (!fields.Username) invalid.Username = 'Username is required';
    //   if (!fields.Password) invalid.Password = 'Password is required';
    // }

    setInvalid(invalid);
    return Object.keys(invalid).length === 0;
  };

  useEffect(() => {
    if (shouldCheck) check();
  }, [fields]);

  // Actions

  const trim = (field: keyof DownloaderOptions) => {
    if (fields[field] && fields[field].trim() !== fields[field]) {
      setFields({ [field]: fields[field].trim() });
    }
  };

  const reset = () => {
    setDirty(false);
    setShouldCheck(false);
    setShouldSave(false);
    setTestResult(null);
    setInvalid({});
  };

  const test = async (): Promise<boolean | null> => {
    if (!check()) {
      // Invalid, show errors, start live validation
      setShouldCheck(true);
      return null;
    }

    // Test
    const url = await findApiUrl(fields);
    if (url) {
      setTestResult(true);
      setFields({ ApiUrl: url });
      return true;
    }
    setTestResult(false);
    return false;
  };

  const save = async () => {
    // If save is not yet in progress, start with a test
    if (!shouldSave) {
      const url = await test();
      if (url === null) return; // Invalid, do not save

      // If no url was found, confirm for save
      if (
        !url &&
        !confirm(
          'Could not validate the API URL. Are you sure you want to save this downloader?',
        )
      )
        return;

      // We need to do something silly, because the test function
      // may have updated the url field, and in order to save the
      // updated url we need to wait for a re-render.
      // Save should automatically be called again.
      return setShouldSave(true);
    }

    // Save
    reset();
    onSaved?.(fields);
  };

  useEffect(() => {
    if (shouldSave) save();
  }, [shouldSave]);

  const remove = () => {
    if (
      currentDownloader &&
      confirm('Are you sure you want to remove this downloader? This cannot be undone.')
    ) {
      onRemoved?.();
    }
  };

  return (
    <div id="downloader-settings">
      <div className="form">
        {/* <ul>
        <li>dirty: {JSON.stringify(dirty)}</li>
        <li>shouldCheck: {JSON.stringify(shouldCheck)}</li>
        <li>isValid: {JSON.stringify(isValid)}</li>
        <li>invalidNames: {JSON.stringify(invalidNames)}</li>
        <li>Invalid: {JSON.stringify(invalid)}</li>
      </ul> */}
        <div
          data-tooltip-id="tooltip"
          data-tooltip-html="
            <span>
              A unique name for this downloader.
              <p>
                This is used to identify the downloader in the list. If you change the
                name of an existing downloader, it will duplicate the downloader with the
                new name.
              </p>
            </span>
          "
        >
          <label htmlFor="DownloaderName">Name:</label>
          <input
            type="text"
            name="DownloaderName"
            className={invalid.Name ? 'error' : ''}
            value={fields.Name}
            onChange={(e) => setFields({ Name: e.target.value })}
            onBlur={() => trim('Name')}
          />
        </div>

        <div>
          <label htmlFor="DownloaderType">Type:</label>
          <select
            name="DownloaderType"
            value={(fields.Type as string) || ''}
            onChange={(e) => setFields({ Type: e.target.value as DownloaderType })}
          >
            <option value=""></option>
            {Object.values(DownloaderType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {invalid.Type && <span className="error">{invalid.Type}</span>}
        </div>

        <div
          data-tooltip-id="tooltip"
          data-tooltip-html="
            The full URL to connect to downloader API.
            <p>
              This is probably different from the URL you use to access the web UI, but
              when Test or Save is clicked, NZBUnity will attempt to automatically find
              the full API URL using smart defaults
              <br />
              For example:
              <br />
              Entering '192.168.1.123' will try 'http://192.168.1.123:8080/api', etc.
              <br />
              If the URL cannot be automatically found (ie, you are using a non-standard
              port or proxy), please try the full URL from your downloader UI without
              path.
              <br />
              You may want to set 'Web UI' URL as well.
            </p>
          "
        >
          <label htmlFor="DownloaderApiUrl">API URL:</label>
          <input
            type="text"
            name="DownloaderApiUrl"
            value={fields.ApiUrl || ''}
            onChange={(e) => setFields({ ApiUrl: e.target.value })}
            onBlur={() => trim('ApiUrl')}
          />
          {invalid.ApiUrl && <span className="error">{invalid.ApiUrl}</span>}
        </div>

        {fields.Type === DownloaderType.SABnzbd && (
          <>
            <div
              data-tooltip-id="tooltip"
              data-tooltip-html="
                The API Key for SABnzbd. This can be found in the SABnzbd settings.
              "
            >
              <label htmlFor="DownloaderApiKey">API Key:</label>
              <input
                type="text"
                name="DownloaderApiKey"
                className={invalid.ApiKey ? 'error' : ''}
                value={fields.ApiKey || ''}
                onChange={(e) => setFields({ ApiKey: e.target.value })}
                onBlur={() => trim('ApiKey')}
              />
            </div>
          </>
        )}

        {fields.Type === DownloaderType.NZBGet && (
          <>
            <div
              data-tooltip-id="tooltip"
              data-tooltip-html="The control username for NZBGet."
            >
              <label htmlFor="DownloaderUsername">Username:</label>
              <input
                type="text"
                name="DownloaderUsername"
                className={invalid.Username ? 'error' : ''}
                value={fields.Username || ''}
                onChange={(e) => setFields({ Username: e.target.value })}
                onBlur={() => trim('Username')}
              />
            </div>

            <div
              data-tooltip-id="tooltip"
              data-tooltip-html="The control password for NZBGet."
            >
              <label htmlFor="DownloaderPassword">Password:</label>
              <input
                type="text"
                name="DownloaderPassword"
                className={invalid.Password ? 'error' : ''}
                value={fields.Password || ''}
                onChange={(e) => setFields({ Password: e.target.value })}
                onBlur={() => trim('Password')}
              />
            </div>
          </>
        )}

        <div
          data-tooltip-id="tooltip"
          data-tooltip-html="
            Optional, page URL to open when clicking the
            <br />
            Open web UI button on the toolbar UI.
            <br />
            Defaults to API URL value above.
          "
        >
          <label htmlFor="DownloaderWebUrl">Web URL:</label>
          <input
            type="text"
            name="DownloaderWebUrl"
            value={fields.WebUrl || ''}
            onChange={(e) => setFields({ WebUrl: e.target.value })}
            onBlur={() => trim('WebUrl')}
          />
        </div>
      </div>

      {Object.keys(invalid).length > 0 && (
        <div className="errors">
          {Object.entries(invalid).map(([field, error]) => (
            <span key={field}>{error}.&nbsp;</span>
          ))}
        </div>
      )}

      <div className="actions right">
        <button
          onClick={test}
          className={testResult === null ? '' : testResult ? 'success' : 'fail'}
        >
          Test
          {testResult === true && <Success />}
          {testResult === false && <Failure />}
        </button>
        <button onClick={save} disabled={!dirty || !isValid}>
          <Save /> Save
        </button>
        {currentDownloader && (
          <button onClick={remove}>
            <Remove /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

export default DownloaderForm;
