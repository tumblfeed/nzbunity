# NZB Unity

Send and control NZB files directly with SABnzbd or NZBGet download clients. Allows monitoring and control of your download queue (pause, resume) and enables 1-click downloading from a handful of membership NZB sites. Tested in Chrome and Firefox, but should be compatible with any webextension compatible browser. Version 2 and above is a complete rewrite of the original NZB Unity extension, which is fully Manifest V3 compatible.

- [Homepage](https://github.com/tumblfeed/nzbunity)
- [Issues / Feature requests](https://github.com/tumblfeed/nzbunity/issues)

For feature requests, please consider submitting a pull request (see below for building instructions).

Heavily inspired by [SABconnect++](https://github.com/gboudreau/sabconnectplusplus).

## Setup

### Download Clients

In order to use NZB Unity, at least one download client (SABnzbd or NZBGet) must be defined.
To get started, click the "Create" button, and fill in the details.

> Previous versions of NZB Unity referred to these as "Profiles".

#### Downloader Selection

- Downloader selector -- On the left, loads the selected profile into the editing form.
- Add -- Creates a new profile and selects it for editing.
- Save -- Saves the currently selected profile. If the profile name is changed, a new profile will be created.
- Delete -- Deletes the currently selected profile.
- Test Connection -- Tests the currently selected profile. **Note**: If you are using an HTTPS connection (recommended) with a self-signed certificate, you will get a connection error if you have not accepted the certificate in your browser yet. Simply make sure you can access your server at the secure address first.

#### Downloader Options

- Name -- Any name is accepted. On changing this name, the profile name in the selector will change as well.
- Type -- Either SABnzbd or NZBGet are supported.
  - SABnzbd profiles _must_ use API Key.
  - NZBGet profiles _must_ use Username and Password.
- API URL -- The full URL to the API endpoint of the download client.
  - This should be the full URL including the protocol and port (if not standard). For example, `https://myserver.com:8080/sabnzbd/api` or `http://myserver.com:6789/jsonrpc`.
  - You can enter a partial URL (eg, `https://myserver.com:8080`), and NZB Unity will attempt to find the API endpoint automatically and fill in the rest of the URL.
- API Key -- **SABnzbd Only**. The full use API key for the SABnzbd server. Currently, NZB only API keys are unsupported as they do not give access to the queue.
- Username -- **NZBGet Only**. Username for NZBGet API. Note that this can be a limited access user (NZB Unity does not access config).
- Password -- **NZBGet Only**. Password for the NZBGet API.
- "Open web UI" URL -- Optional, if specified the toolbar UI "Open web UI" button will open a tab to this URL.
  - If not specified, the toolbar UI will attempt try the url with no path (eg, `https://myserver.com:8080`).

### Other Options

- 1-Click Download Providers -- Enable 1-Click features for the given site. This feature modifies most list and detail pages on those sites and presents a direct download button. If the site you use is not listed, NZB download interception will work on any site that does not require an API key or authentication to download NZB files directly.
- Ignore Categories -- NZB Unity will not send categories to the download client.
- Simplify Category Names -- Converts category names that contain group and subgroup into just the group name (eg, "Movies > HD" becomes "movies").
- Default Category -- If no category name can be determined for a particular NZB (either by the site or by category override), this category will be used.
- Replace Links -- Will replace native download links on most 1-Click supported sites instead of adding a separate button.
- Refresh Rate -- The toolbar popup is refreshed by polling the server at this specified interval. Default is 15 seconds.
- Enable Notifications -- Shows a browser notification when an NZB was successfully sent to the server (but not necessarily successfully started downloading). Currently off by default, as it's of limited use at the moment.

- Reset -- Deletes all profiles and sets all options to their defaults.

## Toolbar Popup

The toolbar popup shows statistics and controls for the currently active profile's queue, chosen from the select box at the top.

- Top row

  - Status -- Current queue status (Idle, Downloading, Paused, etc). Clicking on this will either pause or resume the download queue
  - Speed -- Current download speed (max download speed in parentheses).
  - Remaining -- Download size remaining (estimated remaining time in parentheses).

- Options

  - Override Category -- When set, all new NZB downloads will use this category.
  - Max Speed -- Sets the server download speed limit in MB per second (decimals are allowed, eg, 3.1MB/s is equivalent to about 3100KB/s).

- Queue

  - Each queue item will contain the name of the NZB, the category, and the total size / progress. The progress for each item is shown as a progress bar in the background of the queue item itself.
  - Each item will also have Pause / Resume buttons, and a Cancel button.

- Controls
  - Refresh -- Forces a refresh from the server and resets the refresh interval timer.
  - Open Web UI -- Opens a new tab to the Web UI of the current profile.
  - Open Options -- Opens the NZB Unity options tab.

## 1-Click Site Downloads

For sites which have 1-click download enabled, a green NZB icon will be shown next to any NZB that can be downloaded. No more custom sites are currently planned, but please put in a feature request if your favorite site is not supported (or even better, build an adapter and submit it as a pull-request).

## Building

NZB Unity is built primarily in TypeScript and SASS, using a Gulp build process. Node, npm are required.

### Extension

NZB Unity is built using WXT [https://wxt.dev/](https://wxt.dev/) and the WXT CLI. Please see the WXT documentation for reference.

1. Clone the repository
1. `npm ci`
1. `npm run dev` -- Start a browser session with the extension loaded. This will also watch for changes in the source files and automatically rebuilds the extension and hot-reloads the changes.
1. Make sure that after any changes `npm run test` passes and `npm run build` completes successfully.
1. Check `package.json` for commands.

Directories:

- `./` -- Build related files
- `.wxt/` -- WXT related files
- `.output/` -- Build output files
- `src/` -- All extension source files (files in the root of this directory are "main" extension files and support entrypoints).
  - `__tests__/` -- Unit tests for the extension.
  - `assets/` -- Static assets (images, css, etc) to be inlined in the extension.
  - `downloader/` -- Download client adapters.
  - `entrypoints/` -- Main entry point for the extension (background, popup, options, content scripts).
  - `public/` -- Static files to be copied to the build directory (note this is not the same as `assets/`).
- `test/` -- Helpers for unit tests.

### 1-Click Sites

To build a 1-click site adapter you will need to add a `<sitename>.content.ts` file to `src/entrypoints/` using a format similar to the ones already in the directory; see `omgwtfnzbs.content.ts` or `dognzb.content.ts` for a good example. The file should export a WXT `defineContentScript` function call, and the main function should instantiate a `Content` object. Please see the `Content.ts` class for available options as it does a lot of the heavy lifting for you and only needs a few function defined to get started.

The site will also need to be added to the default list of 1-click sites in `src/store.ts` in `DefaultIndexers`, but this is not necessary for a pull request, you can hardcode the site check or use a name of an existing enabled site for testing.

The head of the file should look something like this:

```typescript
import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';
import { getQueryParam } from '~/utils';

export default defineContentScript({
  matches: ['*://*.myradsite.org/*'],
  main(ctx) {
    new MyRadSiteContent(ctx);
  },
});

class MyRadSiteContent extends Content {
  get id() {
    return 'myradsite';
  }
  ...
```

## Troubleshooting

### General advice when making an issue

- Make sure you have the latest version of NZBUnity.
- Make note of the site you are using, or what settings you are changing.
- Check the developer console for errors and take a screenshot, these are very helpful in figuring out what is going wrong.
- Steps to reproduce the issue are very helpful: what you did, what you didn't do, what you expected to see, what you actually saw.

### SABnzbd on a remote server

Some LAN configurations may require reverse proxy setups to use NZBUnity if your downloader is on a different machine from your browser (ie, a media server). NZBUnity makes all requests from the browser background context and not the website so some of this should be mitigated, but SABnzbd fully blocks CORS requests to the api if not from the same origin and they have no plans to change that.

If in the developer console you see a message like:

> Access to fetch at 'http://192.168.1.999:8080/?output=json&apikey=deadbeefcafe&mode=fullstatus&skip_dashboard=1' from origin 'chrome-extension://gpifmafclfppgkpjphdkhdaikolnlank' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.

That means you will need to set up a reverse proxy for SABnzbd. The easiest way to do this is with [nginx](https://www.nginx.com/resources/wiki/) or [caddy](https://github.com/mholt/caddy) on a docker compose stack with the downloader. Configuration is beyond the scope of this document, but there are a lot of examples on github.
