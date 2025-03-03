# NZB Unity

## IMPORTANT! - NZB Unity no longer works in Chrome, as it is built on Manifest v2. It will continue to work in Firefox (via the AMO) and other browsers that support Manifest v2.

**Update** - Apparently you can force the existing addon to load in Chrome by going to the chrome://extensions/ page, clicking the menu (3 dots) next to the extension and selecting "keep this extension" and ignoring the warning. The extension will continue to work until an update is released.

Browsers that still support Manifest v2 (as of 2025-03-25):

* Firefox
* Brave
* Vivaldi
* Opera (?)
* Edge

I have verified that NZB Unity can still be installed from the Chrome Web Store in Brave and Vivaldi.
You should not need to manually install the extension in these browsers.

If necessary, to manually install NZB Unity in Chromium browsers:

* Download the latest release ZIP file from the [releases page](https://github.com/tumblfeed/nzbunity/releases)
  * Filename looks like `nzbunity-1.18.2.zip`
* Extract the ZIP file to a directory, make note of the folder that contains the `manifest.json` file
* Open the Extensions page (chrome://extensions/) Menu -> Extensions -> Manage Extensions
* Enable Developer Mode (toggle in the top right)
* Click "Load unpacked" and select the directory that contains the `manifest.json` file
* NZB Unity should now be installed and working in your browser

Unfortunately, it is not possible to settings from your previous Chrome Web Store installation. You will need to re-add your server profiles.

## About

Send and control NZB files directly with SABnzbd or NZBGet download clients. Allows monitoring and control of your download queue (pause, resume), optionally intercepts NZB downloads, and allows 1-click downloading from a handful of membership NZB sites. Tested in Chrome and Firefox, but should be compatible with any webextension compatible browser.

* [Homepage](https://github.com/tumblfeed/nzbunity)
* [Issues / Feature requests](https://github.com/tumblfeed/nzbunity/issues)
* [Wiki / Roadmap](https://github.com/tumblfeed/nzbunity/wiki)

For feature requests, please consider submitting a pull request (see below for building instructions).

Heavily inspired by [SABconnect++](https://github.com/gboudreau/sabconnectplusplus).

## Setup

### Profiles

In order to use NZB Unity, at least one server profile must be defined. To get started, click the "Create" button, and fill in the details.

#### Profile Controls

* Profile selector -- Loads the selected profile into the editing pane.
* Create -- Creates a new profile and selects it for editing.
* Duplicate -- Duplicates the currently selected profile and selects the duplicate for editing.
* Delete -- Deletes the currently selected profile.
* Test Connection -- Tests the currently selected profile. **Note**: If you are using an HTTPS connection (recommended) with a self-signed certificate, you will get a connection error if you have not accepted the certificate in your browser yet. Simply make sure you can access your server at the secure address first.

#### Profile Options

* Profile Name -- Any name is accepted. On changing this name, the profile name in the selector will change as well.
* Type -- Either SABnzbd or NZBGet are supported.
  * SABnzbd profiles *must* use API Key.
  * NZBGet profiles *must* use Username and Password.
* Host -- Either protocol and host name or FQDN of the server to connect to.
  * Protocol and path are optional, defaults will be used if not specified (eg, "https://myserver.com:8081", "http://myserver:8080", "https://myserver:8080/mysab", and "myserver:8080" are all valid).
  * Protocol must be included if HTTPS connections are desired. Please also see note under Test Connection above.
  * SABnzbd connections will default to the path "/sabnzbd", but you may specify a different path. Using the root path "/" is currently unsupported (it will use the default in this case).
* API Key -- **SABnzbd Only**. The full use API key for the SABnzbd server. Currently, NZB only API keys are unsupported as they do not give access to the queue.
* Username -- **NZBGet Only**. Username for NZBGet API. Note that this can be a limited access user (NZB Unity does not access config).
* Password -- **NZBGet Only**. Password for the NZBGet API.
* "Open web UI" URL -- Optional, if specified the toolbar UI "Open web UI" button will open a tab to this URL instead of the profile Host.

### Other Options

* 1-Click Download Providers -- Enable 1-Click features for the given site. This feature modifies most list and detail pages on those sites and presents a direct download button. If the site you use is not listed, NZB download interception will work on any site that does not require an API key or authentication to download NZB files directly.
* Automatically Intercept NZB Downloads -- Detects whenever an NZB file is being downloaded by the browser and sends the URL of the NZB to the server instead. Note that this does not intercept the *contents* of the NZB, just the URL, so this will not work for sites that require an active login or do not provide API enabled download links for logged in users. URL interception does work for a great many sites currently, so it is enabled by default.
* Intercept Exclude -- Will exclude the sites listed in this option from NZB download interception. Sites should be listed by hostname only, comma separated, and regular expression syntax is allowed (eg. "mynzbhost.com").
* Simplify Category Names --  Converts category names that contain group and subgroup into just the group name (eg, "Movies > HD" becomes "movies").
* Replace Links -- Will replace native download links on most 1-Click supported sites instead of adding a separate button.
* Default Category -- If no category name can be ascertained for a particular NZB (either by the site, in the NZB itself, DNZB headers, or by category override), this category will be used.
* Refresh Rate -- The toolbar popup is refreshed by polling the server at this specified interval. Default is 15 seconds.
* UI Theme -- Select the UI color theme for the toolbar popup.
* Enable Notifications -- Shows a browser notification when an NZB was successfully sent to the server (but not necessarily successfully started downloading). Currently off by default, as it's of limited use at the moment.

* Reset -- Deletes all profiles and sets all options to their defaults.

## Toolbar Popup

The toolbar popup shows statistics and controls for the currently active profile's queue, chosen from the select box at the top.

* Top row
  * Status -- Current queue status (Idle, Downloading, Paused, etc). Clicking on this will either pause or resume the download queue
  * Speed -- Current download speed (max download speed in parentheses).
  * Remaining -- Download size remaining (estimated remaining time in parentheses).

* Options
  * Override Category -- When set, all new NZB downloads will use this category.
  * Max Speed -- Sets the server download speed limit in MB per second (decimals are allowed, eg, 3.1MB/s is equivalent to about 3100KB/s).

* Queue -- Each queue item will contain the name of the NZB, the category, and the total size. The progress for each item is shown as a progress bar in the background of the queue item itself.
* Controls
	* Refresh -- Forces a refresh from the server and resets the refresh interval timer.
	* Open Web UI -- Opens a new tab to the Web UI of the current profile.
	* Open Options -- Opens the NZB Unity options tab.

## 1-Click Site Downloads

For sites which have 1-click download enabled, a green NZB icon will be shown next to any NZB that can be downloaded. No more custom sites are currently planned, but please put in a feature request if your favorite site is not supported (or even better, build an adapter and submit it as a pull-request).

## Building

NZB Unity is built primarily in TypeScript and SASS, using a Gulp build process. Node, npm are required.

### Extension

1. Clone the repository
1. `npm ci`
1. `gulp build` or `gulp dist` or `gulp watch`
1. The built extension will be in the build directory and can be loaded into browsers using the manifest.json file there.
1. Make changes only to files in the src/ directory. JS files can be written in either JavaScript or Typescript. New TypeScript files should be added to the tsconfig.json file in the root.

Directories:

* `./` -- Build related files: gulpfiles, npm dependencies, TypeScript config, license, readme, etc.
* `build/` -- Built extension files.
* `dist/` -- Packaged un-signed extension.
* `src/` -- All extension source files.
  * `vendor/` -- Vendor JavaScript files.
  * `background/` -- Background process files and util.ts which is loaded into every  extension page.
  * `content/` -- Content pages including options and popup.
    * `css/` -- Vendor CSS and SASS (scss) source files.
    * `fonts/` -- Vendor webfonts.
    * `images/` -- Icons and images.
    * `sites/` -- 1-click site adapter source files.

Gulp commands:

* `gulp build` -- Builds the extension into build/.
* `gulp dist` -- After building, zips the build into dist/.
* `gulp clean` -- Deletes build files from build/ and dist/.
* `gulp copy` -- Copies any files that do not need pre-process to build/.
* `gulp typescript` -- Compiles TypeScript files.
* `gulp sass` -- Compiles SASS files.
* `gulp watch` -- Builds the project and then watches for any changes in src/ to rebuild.

### 1-Click Sites

A good example of a 1-click site adapter can be found in `src/content/sites/omgwtfnzbs.ts`, as this site requires fetching the username and API key to be able to build correct NZB file URLs. Ultimately what is required is that the adapter identify locations to insert download links, and passing the NZB URL and optional category to:

    PageUtil.createAddUrlLink(
      options:{ url: string, category?: string },
      adjacent:JQuery<HTMLElement>|HTMLElement = null
    ):JQuery<HTMLElement>

Which will create the link, assign the handler, and return the link. If the adjacent element is provided, it will also insert the link in the DOM as a sibling to adjacent.

The PageUtil source has some other handy functions, it's recommended to read the source.
