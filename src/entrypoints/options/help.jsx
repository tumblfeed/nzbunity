/**
 * The options page tooltip copy, keyed by the `data-help` attribute on whichever
 * element the tooltip is attached to.
 *
 * react-tooltip 6 takes content as markup rather than an HTML string, so the text
 * lives here instead of inline on every form element. One <Tooltip> is mounted in
 * Options.jsx and looks its content up per anchor through its `render` prop, which
 * is why nine anchors share a single tooltip and ten keys exist (the Save button
 * has a different tip depending on whether there are unsaved changes).
 */
export const HelpText = {
  name: (
    <span>
      A unique name for this downloader.
      <p>
        This is used to identify the downloader in the list. If you change the name of an
        existing downloader, it will duplicate the downloader with the new name.
      </p>
    </span>
  ),
  apiUrl: (
    <>
      The full URL to connect to downloader API.
      <p>
        This is probably different from the URL you use to access the web UI, but when
        Test or Save is clicked, NZBUnity will attempt to automatically find the full API
        URL using smart defaults
        <br />
        For example:
        <br />
        Entering '192.168.1.123' will try 'http://192.168.1.123:8080/api', etc.
        <br />
        If the URL cannot be automatically found (ie, you are using a non-standard port or
        proxy), please try the full URL from your downloader UI without path.
        <br />
        You may want to set 'Web UI' URL as well.
      </p>
    </>
  ),
  apiKey: 'The API Key for SABnzbd. This can be found in the SABnzbd settings.',
  username: 'The control username for NZBGet.',
  password: 'The control password for NZBGet.',
  webUrl: (
    <>
      Optional, page URL to open when clicking the
      <br />
      Open web UI button on the toolbar UI.
      <br />
      Defaults to API URL value above.
    </>
  ),
  test: 'Test and automatically find the full URL.',
  save: 'Save changes',
  saveDisabled: 'No changes to save',
  defaultCategory:
    'Optional, if no category can be determined from site or NZB headers, this category will be sent instead.',
};
