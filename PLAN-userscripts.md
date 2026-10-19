# PLAN-userscripts.md — userscript messaging bridge

Branch: `user-script-messaging`, based on `2.2` at `29deeab` (created 2026-10-19).
Status: **planned only — nothing implemented yet.** No worktree exists at the time
of writing.
Owner-approved decisions are recorded in §2 and are not open for re-litigation by
whoever picks this up; the genuinely open items are listed in §7.

This file is deliberately self-contained. `PLAN.md` (the JS-conversion plan) is
still on this branch because it branched from `2.2`, but that file gets deleted
when the conversion closes — do not depend on it for anything in here.

## 0. How to work this plan (agent protocol)

1. `git -C /home/hutch/Projects/nzbunity fetch --prune`
2. Create the worktree: `git worktree add ../nzbunity-userscripts user-script-messaging`
   then `cd ../nzbunity-userscripts`. Do **not** check this branch out in
   `/home/hutch/Projects/nzbunity`; the owner keeps that checkout on whatever they
   are test-driving, and the `node_modules` there belongs to another branch.
3. `npm ci` (the `postinstall` runs `wxt prepare`; `jsconfig.json` extends the
   generated `.wxt/tsconfig.json`, which is gitignored, so `npm run check` cannot
   work before this step).
4. Read §1 (ground truth), §2 (decisions), §3 (the protocol you are building) and
   the newest entries of the Progress log at the bottom.
5. Start at the first unticked box in §5. Do the milestones in order; M0 exists to
   burn down the two risky unknowns before any real code is written.
6. Gates before and after every commit:
   `npm run check && npm run lint && npm run format:check && npm test && npm run build:all`
7. Never claim an unverified pass. Anything that needs a real browser (grants,
   prompts, the popup, a userscript manager, injected CSS) is "not verified in a
   browser" until the owner says they saw it work.
8. One commit per step, message style `[userscript] <imperative subject>`. In the
   body, say why, and paste measured output (build size, manifest diff, test
   counts) rather than adjectives.
9. Tick the box for a finished step and append a Progress entry (newest first). If
   you change a decision, say so in the Progress log and update §2 — never edit
   history silently.
10. Delete this file when every box through M7 is ticked and the owner has
    reported a green browser pass (M8 is optional by design; record its outcome
    before deleting).

## 1. Ground truth (measured 2026-10-19 at `29deeab`, branch `2.2`)

Everything below was read out of the tree, not remembered.

- `src/Content.js` is 598 lines. Its surface, grouped:
  - identity/config: `id`, `name`, `useLightTheme`, `replaceLinks`, `indexerOptions`
  - page lifecycle: `ready()`, `onReady()`, `isList`, `isDetail`, `initializeLinks`,
    `initializeListLinks`, `initializeDetailLinks`, `waitForQuerySelector(All)`,
    `cleanup()`, `ctx.onInvalidated`
  - credentials/URL: `_uid`, `_apikey`, `_apiurl` + accessors, `getNzbUrl(id)`
  - DOM and actions: `toast` (296 — it uses `insertAdjacentHTML`, so it takes HTML),
    `createLink` (479), `createButton` (510), `createAddUrlLink` (549),
    `createAddUrlButton` (570), `bindAddUrl` (390), `addUrl` (311), `addFile` (324),
    `addFileByRequest` (340, fetches in the page context), `addUrlAndNotify` (370),
    `addUrlsFromElements(AndNotify)` (410/439), `extractCategory`, `getMeta`
- `Content.addUrl` / `addFile` are already just messages to the background:
  `browser.runtime.sendMessage({ addUrl: { url, options } })`. The background handler
  at `src/entrypoints/background.js:45-104` accepts `log`, `getLog`, `clearLog`,
  `addUrl`, `addFile` and **does no sender validation at all** — any content script
  can call it today. It always returns `true`.
- `Client.addUrl`/`addFile` resolve to `NZBAddUrlResult`
  (`{success, result?, error?}`, `src/downloader/index.js:63-68`).
- CSS contract in `src/assets/content.css` (146 lines): `:root` custom properties,
  then `.NZBUnityLight` (32), `.NZBUnityIcon` (37), `.NZBUnityLink` (46),
  `.NZBUnityButton` (84), `.NZBUnityToast` (126). Link and button states are
  `&.pending`, `&.disabled`/`:disabled`, `&.success`, `&.error`.
- **Pre-existing bug found while planning:** `createLink`/`createButton` set the class
  `failure` on `nzb.failure` (`src/Content.js:489,492-494,530,533-535`) but the CSS
  only styles `&.error`. Failure styling never renders. Because this bridge publishes
  these class names as a public contract, fix it in this branch by adding `&.failure`
  next to `&.error` in `content.css` (two lines) instead of renaming, so none of the
  17 adapters change behaviour.
- `cleanup()` removes every element whose class starts with `NZBUnity`
  (`src/Content.js:284`) — everything the bridge draws must keep that prefix.
- 17 content entrypoints exist, and **all 17 import `~/assets/content.css`
  themselves**. That repetition is deliberate: with WXT 0.21 + vite 8, a
  content-script stylesheet imported by a shared module crashes the build. Keep the
  pattern for the new host entrypoint.
- `wxt.config.js` (42 lines): `permissions: [activeTab, notifications, scripting,
storage, tabs, webRequest]`, four commands, **no `host_permissions` key** — host
  permissions currently come purely from content-script `matches`.
- Runtime-injection precedent: `background.js:27-40` runs
  `scripting.executeScript({files: ['content-scripts/newznab.js']})` +
  `insertCSS` for the `activate-newznab` command. That proves the built artifact
  paths we will need for runtime registration.
- `src/__tests__/structure.test.js` asserts (a) no `.ts`/`.tsx` anywhere in `src`, and
  (b) every `DefaultIndexers` key has a matching `src/entrypoints/*.content.js`. So:
  userscript code and installable scripts must **not** live in `src/entrypoints/`, and
  userscript sites must **not** gain `DefaultIndexers` keys.
- UI already exists for the grant flow: `src/entrypoints/popup/` and
  `src/entrypoints/options/`; `utils.setMenuIcon` (utils.js:27-47) drives the action
  title/badge/icon.
- Log storage already exists: `LogStorage.add/get/clear` in `src/logger.js`, reachable
  over the existing `log` message. The bridge gets an audit trail for free.
- No CI. The gates in §0.6 are local only.

## 2. Decisions (owner, 2026-10-19)

1. **We never host, load, or run userscripts.** Users run them in Tampermonkey,
   Violentmonkey, ScriptCat, or the browser's own Userscripts support. The repo may
   hold installable scripts for validated integrations, as files a user clicks to
   install.
2. **RPC style, not lifecycle tracking.** v1 exposes the simple verbs (`addUrl`,
   a link, a toast, a log). Page detection, waiting for selectors, `replaceLinks`,
   bulk selection — all of that stays in the userscript. Lifecycle hooks (by regex)
   are a v2 idea, see §7.
3. **Ask for as little as possible up front.** Chrome Web Store makes every
   permission be justified and the owner wants the install to look benign. Grants are
   per origin, requested at runtime, nothing blanket at install time.
4. **`externally_connectable` should be available as an option** (a documented
   transport that needs no content script; costs are in §4.4).
5. **Level 1 first**: the userscript draws its own elements and uses our documented
   class names; the host only moves data. **Level 2** (`createLink` where the host
   inserts and binds the anchor) is in v1 only if it is cheap after M0–M6; otherwise
   it is v1.5 and §7 records that.
6. **"Validated" means the owner personally tested it.** A fixture test is not a
   gate for third-party submissions. NZB site fixtures leak release names and
   filenames, so never accept an un-anonymized fixture; fixtures we write ourselves
   for our own tests must be synthetic or scrubbed.
7. **Ungranted handshakes queue in the options page**, and we try a nudge (popup
   button, optionally a notification) so the user can approve from where they are.
8. Naming: this file is `PLAN-userscripts.md` at the repo root; commits are
   `[userscript] <imperative>`.

## 3. Protocol v1 (normative)

### 3.1 Envelope, both directions

```js
{
  v: 1, // protocol version, integer
  src: 'script' | 'host', // who sent it
  id: 'a7f3c1d2', // 8 hex chars, set by the sender of a request
  re: null | 'a7f3c1d2', // set on a reply: the id this message answers
  type: 'addUrl', // see the tables below
  nonce: '…', // host-issued page token; required on every script -> host message
  payload: {}, // plain JSON only
}
```

Transport is `window.postMessage(msg, location.origin)` from the page world to the
isolated-world host script, and back. Everything crossing the wire must be plain
JSON-serialisable data — **no functions, ever** (that rule is what keeps the bridge
auditable, and it is why nothing about this feature is "run the contributor's code").

Hard receive-side guards (a hostile page is the normal case, not an edge case):

- `event.source === window` and `event.origin === location.origin`
- top frame only: `window.top === window`
- `msg && msg.v === 1 && typeof msg.type === 'string' && msg.src === 'script'`
- `nonce` must match the one this host instance generated for this page
- payload validated by the schema in `src/userscript/protocol.js` before anything is
  touched
- never `insertAdjacentHTML` with bridge data (`Content.toast` accepts HTML at
  `Content.js:296`; the bridge path must use text)

### 3.2 Handshake, in order

1. Host, at start: broadcast `hello-host {nonce, bridgeVersion}`.
2. Script, whenever it is ready: `hello {name, version}` (with the nonce if it has
   seen one). **Scripts must retry `hello` every 250 ms for up to 3 s** — a
   runtime-registered content script can easily appear after the userscript has run,
   and userscript managers vary in inject mode and timing.
3. Host replies `state {granted, enabled, bridgeVersion, extensionVersion, reason?}`.
   If `granted` is false the script must stop and is expected to tell the user how to
   enable it (the `reason` string is written for a human, e.g.
   `not-granted: open NZB Unity options and enable this site`).
4. Host, on teardown (`ctx.onInvalidated`): send `host-bye`, so scripts stop retrying
   and can say "reload the page after installing/updating the extension".
5. No keepalive. If a script gets no reply to a request it re-announces.

### 3.3 Messages the script may send

| type         | payload                          | reply               | notes                                       |
| ------------ | -------------------------------- | ------------------- | ------------------------------------------- |
| `hello`      | `{name, version}`                | `state`             | retried until answered                      |
| `addUrl`     | `{url, category?}`               | `result`            | the workhorse                               |
| `addUrls`    | `{items: [{url, category?}]}`    | `{items: [result]}` | ≤ 50 items, one round trip                  |
| `addFile`    | `{filename, content, category?}` | `result`            | ≤ 2 MB; the downloader validates            |
| `toast`      | `{message, ms?}`                 | —                   | text only, rendered with `.NZBUnityToast`   |
| `log`        | `{level, message}`               | —                   | capped and truncated, lands in `LogStorage` |
| `createLink` | §3.5                             | `result`            | Level 2, optional (M8)                      |

`addUrl`/`addUrls`/`addFile` go to the background through the same code the internal
adapters use, so the downloader's own response shape is what comes back:
`{success, result?, error?}`.

Deliberately **not** in v1: `addFileByRequest` (the extension fetching with the
user's session cookies is the scariest capability in `Content`, and a userscript can
do that fetch itself and pass the content to `addFile`), reading options, anything
that returns downloader credentials or other sites' state.

### 3.4 Messages the host may send

| type         | payload                                                        |
| ------------ | -------------------------------------------------------------- |
| `hello-host` | `{nonce, bridgeVersion}`                                       |
| `state`      | `{granted, enabled, bridgeVersion, extensionVersion, reason?}` |
| `result`     | the `NZBAddUrlResult` passthrough, or `{ok:false, error}`      |
| `event`      | `{kind: 'pending'                                              | 'success' | 'failure', linkId}` — Level 2 only |
| `host-bye`   | `{}`                                                           |

### 3.5 Level 1 — the class contract (the default)

The script owns the DOM. It creates `<a class="NZBUnityLink">` (or
`.NZBUnityButton`), calls `addUrl`, and toggles state classes from the result. It gets
our exact styling for free, because the host entrypoint imports `~/assets/content.css`
and that stylesheet is live in the page whenever the host runs.

Public contract, as it must be written in the docs:

- containers: `.NZBUnityLink`, `.NZBUnityButton`, `.NZBUnityToast`, `.NZBUnityIcon`,
  and `.NZBUnityLight` on `document.documentElement` for light-text sites
- state classes: `pending`, `success`, `failure`, `disabled` (and note the current
  CSS also styles `error`, kept for compatibility — see §1)
- the extension removes anything matching `[class^="NZBUnity"]` on teardown, so use
  the prefix and do not fight it
- the icon images come from `--icon-nzb-*` custom properties on `:root`

Level 1 is recommended as the documented default because it has no locator fragility
and no per-render round trip.

### 3.6 Level 2 — `createLink` (optional, M8)

The host inserts a real `createAddUrlLink` anchor, so the icon state machine comes for
free. Cost: the script must address a node as `{selector, index}` plus
`position: 'before' | 'after'`, which breaks when the site's markup changes. Element
handles cannot cross worlds, which is why the locator is a selector and not a node.

### 3.7 Limits

- URLs: `http:`/`https:` only for `addUrl` (the URL is fetched by the **downloader**,
  so this is the main reason grants and caps exist)
- token bucket per tab: 10 actions/s, burst 20; `addUrls` counts as N
- ≤ 100 host-created links per page
- ≤ 2 MB per `addFile` body (log a warning, do not try to sniff NZB validity — the
  downloader is the real validator)
- `log` messages truncated to 500 chars, ≤ 10/s
- every bridge action writes one `LogStorage` entry: origin, type, size/count, and the
  result. That is the audit trail a user can look at.

## 4. Trust and permissions

### 4.1 Why there still has to be a gate

The user chose to install the userscript; nobody chose to let the _site_ talk to the
downloader. A granted origin is therefore a trusted origin by definition, and the
threats we defend against are: a site (or any script it loads) flooding the queue,
queueing attacker-chosen URLs, spamming the log, or using the bridge as a phishing
renderer. Defences: per-origin grants (§4.2), no secret egress (§3.3), caps and audit
logging (§3.7), top-frame + origin + nonce validation (§3.1), and Level 1 as the
default so we are mostly moving data rather than drawing on a stranger's behalf.

### 4.2 The grant model

Store (new key, `src/store.js`, with a migration version bump):

```js
UserScript: {
  Enabled: false, // master switch, off by default
  Origins: { 'https://site.example': { addedAt: 0 } },
  Pending: { 'https://other.example': { seenAt: 0, scripts: [] } },
}
```

Flow: userscript `hello` from an ungranted origin → host records it in `Pending` and
answers `state {granted: false, reason}` → the options page (and popup, §4.3) offers
"Enable for this site", whose click is the user gesture that calls
`browser.permissions.request({origins: ['https://site.example/*']})`, then stores the
grant, then registers the host script for that origin. Revoking removes the grant and
unregisters.

### 4.3 Host presence is the hard constraint (M0/M4)

There is no messaging channel to a page the extension is not in. Nothing blanket must
appear in the manifest.

Plan:

1. `wxt.config.js`: add `optional_permissions` / `optional_host_permissions`
   containing `<all_urls>`, so a single-origin grant can be requested at runtime with
   no install-time host warning.
2. Declare the host as `defineContentScript({ registration: 'runtime', matches: [...] })`
   so WXT bundles `content-scripts/userscript-host.js` and `.css` without adding a
   static `content_scripts` entry. WXT has historically also pushed those `matches`
   into `host_permissions` (wxt-dev/wxt issues #469, #714), which would defeat the
   point, and it may not accept an omitted `matches`. Escape hatch: a placeholder
   `matches` entry stripped back out in a `manifest.transform` hook.
3. `browser.scripting.registerContentScripts({id: 'user-script-bridge', matches:
[granted origins], js: ['content-scripts/userscript-host.js'],
css: ['content-scripts/userscript-host.css'], runAt: 'document_start'})`,
   `updateContentScripts` when the grant set changes, `unregisterContentScripts` on
   revoke. `scripting` is already a permission; runtime registration needs the origin
   permission we just requested.
4. **Hard gate before M4 is "done"**: run `npm run build:all` and diff
   `.output/chrome-mv3/manifest.json` and `.output/firefox-mv3/manifest.json` against
   `2.2`'s. The only allowed additions are the optional-permission entry and, if
   unavoidable, a documented placeholder that a `manifest.transform` removes. Paste
   both `host_permissions` lines in the commit message.
5. Firefox: verify that `permissions.request` accepts a `<all_urls>`-style optional
   origin and that `scripting.registerContentScripts` behaves (it exists in
   Firefox 101+, and `scripting` is already granted). If it does not, fall back to
   re-injecting with `scripting.executeScript` + `insertCSS` on `tabs.onUpdated` for
   granted origins — `tabs` is already a permission, and the `activate-newznab`
   handler at `background.js:27-40` is the working template. Record which path shipped.

### 4.4 `externally_connectable` as the optional no-content-script transport

Worth offering, with its costs stated:

- It is **static manifest config** (`externally_connectable.matches`), so the sites it
  works on are an allowlist in `wxt.config.js`, i.e. only sites whose scripts we have
  validated. Broad patterns such as `<all_urls>` are not permitted there (verify in
  M0).
- Handler: `browser.runtime.onMessageExternal` in `background.js`, reusing the same
  protocol validation and limits as the host bridge, plus a `sender.url` origin check.
- The script must know our extension id, which differs per browser (Chrome id vs
  Firefox guid) — the docs need a "find your id" section and the template needs
  per-browser header lines.
- It skips grants, the nonce, and the content-script intermediary: **any** script on
  an allowlisted origin can message the extension directly. It also cannot draw or
  style anything, so Level 1 styling is unavailable. Say all of this in the docs; it
  is for headless/tooling users, not the default path.

### 4.5 Chrome Web Store / AMO justification text (deliverable in M4)

One paragraph for the review form: the optional all-sites permission exists only so
the user can enable the bridge on one site at a time from the options page; no page is
accessed at install; the bridge only forwards NZB URLs the user clicked to a
user-configured downloader; every bridge action is logged in the extension's own log.
Write the real wording once the manifest diff is known, and keep it in the commit
message or `docs/`.

## 5. Milestones

### M0 — Spike, throwaway, do not commit (about half a day)

- Paste-into-devtools snippet on one origin → host `hello-host` → `hello` → `addUrl`
  → `{success: true}` from the real downloader.
- Grant one origin at runtime with `permissions.request` from the options page and
  register the content script with `scripting.registerContentScripts`; reload and see
  it run at `document_start`.
- Inspect both built manifests for what WXT added (see §4.3 step 4 and §4.4).
- Exit: all three work, and the manifest question is answered. If they do not, stop
  and rewrite §4 before writing M2. Record findings in the Progress log.

- [ ] M0 done and written up

### M1 — Protocol module (about 180 lines)

`src/userscript/protocol.js` (pure, no browser APIs) +
`src/userscript/__tests__/protocol.test.js`: envelope check, per-type payload
validators, limit constants, `reason` strings, a `newId()`, and an error shape.
Add `// @ts-check` and `@typedef`s with `@export` so the host and the docs share one
definition.

Acceptance: `npm run check` clean; tests cover a bad `v`, a bad type, an oversized
`addUrls`, a non-http URL, and an oversized `addFile`.

- [ ] M1

### M2 — Host entrypoint and bridge (about 370 lines)

`src/entrypoints/userscript-host.content.js` — imports `~/assets/content.css` itself
(the WXT/vite-8 rule), owns the WXT `ContentScriptContext` (so `ctx.onInvalidated`
→ `host-bye`), nonce, handshake, and a dev-only escape hatch (e.g.
`WXT_USERSCRIPT_HOST_ORIGINS` in `.env.local`) so development does not need the UI
from M3.
`src/userscript/bridge.js` — validates, enforces limits, calls
`browser.runtime.sendMessage({addUrl|addFile|log})`, formats results.
Separate small commit: the `content.css` `.failure` fix from §1.

Acceptance: handshake + `addUrl`/`addUrls`/`addFile`/`toast`/`log` work against the
real downloader (owner's test services, recipe in `2.2` PLAN §4.6 while that file
still exists — copy the recipe into this file's §6 if it goes away); `grep -l
"~/store" src/userscript/*.js` finds nothing (the bridge must never read options for
secrets); add that assertion to the structure test.

- [ ] M2

### M3 — Store, pending queue, options and popup UI (about 250 lines)

`UserScript` defaults + migration in `src/store.js`; a "User scripts" section in
`src/entrypoints/options/Options.jsx` (master switch, granted origins with remove,
pending origins with enable, using the existing `HelpText` + tooltip pattern from
`help.jsx`); a popup button "Enable for this site" when the active tab's origin is
pending or ungranted.

Acceptance: no `DefaultIndexers` keys added (the structure test stays green); the
options page renders the three lists; revoking removes the grant.

- [ ] M3

### M4 — Permissions and registration lifecycle (about 150 lines + risk)

`wxt.config.js` optional permissions, placeholder `matches`, `manifest.transform`;
`src/userscript/registration.js` with `syncRegistrations(grants)` called from the
grant/revoke actions and on `runtime.onStartup`/`onInstalled`.
Includes the manifest diff gate from §4.3 and the §4.5 justification text.

Acceptance: manifest diff pasted in the commit message; grant → reload → bridge alive
without any manual step; revoke → bridge gone (owner verifies in a browser).

- [ ] M4

### M5 — Docs and template (about 400 lines)

`docs/userscript-api.md`: the envelope, the handshake, the message tables, the Level 1
class contract, worked examples (a minimal list-page script and a detail-page script),
how to install a userscript in each manager, how to find the extension id for the
`externally_connectable` path, the security notes a reader needs, and the dev workflow:
`npx serve` a local folder of saved HTML, grant `http://localhost:PORT` in the options
page, and iterate on a script with **no site access and no extension rebuild**. That
workflow is the whole reason this feature is worth building; do not skip documenting
it.
`userscripts/nzbunity.template.user.js`: self-contained, `@grant none`, Level 1,
comments pointing at the doc sections.

- [ ] M5

### M6 — First real validated script (no `src/` changes)

`userscripts/amenzb.user.js` — natural proof, because the built-in adapter there is
best-effort and the site needs a session key the script can read itself. Owner
installs and tests; acceptance is the owner's word, recorded in the Progress log.

- [ ] M6

### M7 — Hardening and the nudge (about 150 lines)

Token bucket, log caps and truncation, `sender` and payload shape check added to the
existing `background.js:45-104` handler (it currently trusts any content script),
audit entries for every bridge call, and the pending-request nudge: an action badge
and/or a `browser.notifications` click-through that opens the options page with that
origin preselected.

Acceptance: caps verifiable in a unit test; the sender check cannot break the 17
adapters (all existing tests green).

- [ ] M7

### M8 — Level 2 `createLink` (optional; only if M0–M6 landed clean)

`createLink {locator: {selector, index}, position, url, category, label, styles}` and
`event` replies. If it is not cheap, write "v1.5" next to this box, note why, and
stop.

- [ ] M8

## 6. Playbook and gotchas

- Gates: `npm run check` (tsc over `jsconfig.json`, opt-in per file via
  `// @ts-check`), `npm run lint`, `npm run format:check` (prettier covers markdown —
  **including this file**), `npm test`, `npm run build:all`.
- `jsconfig.json` extends the gitignored `.wxt/tsconfig.json`, so `npm ci` (which
  runs `wxt prepare`) must happen before `check` works.
- TypeScript 7 is used only for checking. Subclass members need `/** @override */`
  (8 of those already exist on this branch), enum-in-type-position needs
  `@typedef {(typeof X)[keyof typeof X]} X`, and cross-module typedefs need `@export`.
  Contributors never see TypeScript; keep it that way — no `.ts` files, no config
  that forces a checker.
- Import from `#imports` (`defineContentScript`, `defineBackground`, `browser`),
  never `wxt/sandbox` (no such export in WXT 0.21). `wxt/testing` is split into
  `wxt/testing/vitest-plugin` and `wxt/testing/fake-browser`.
- A content-script stylesheet must be imported by the entrypoint itself; importing
  `content.css` from a shared module crashes WXT 0.21 + vite 8.
- Userscript files live in `userscripts/`, never in `src/entrypoints/` (structure
  test). Userscript sites get no `DefaultIndexers` key (same test).
- Browser tests use `wxt/testing/fake-browser` for `browser.*` mocks; DOM tests use
  happy-dom. Bridge protocol tests need neither — keep `protocol.js` pure.
- Fixtures: synthetic or anonymized only (§2.6). A real NZB site page dump carries
  release names, filenames, sometimes usernames.
- To exercise the bridge by hand: options page → enable `http://localhost` (or the
  fixture server's origin) → serve a saved page → open devtools on that page and
  paste the client side of the handshake from `docs/userscript-api.md`.
- Do not touch the owner's checkout at `/home/hutch/Projects/nzbunity`.

## 7. Out of scope, and v2

Open questions that need the owner (do not guess):

1. Is `UserScript.Enabled` off-by-default right, or should a fresh install already
   allow the bridge once a site is granted?
2. Should the popup offer the grant only for pending origins, or for any site?
3. Does the `externally_connectable` variant get its own build flag (so the default
   manifest stays minimal), or a checked-in allowlist of validated sites?

Explicitly out of scope for v1:

- Lifecycle hooks over the wire (v2 candidate: `hook {urlPattern, selector,
urlTemplate, categoryFrom}` so the host does the waiting and re-rendering). The v1
  envelope, grants, and limits are designed so this can be added without a rewrite —
  and the "no functions over the wire" rule is what makes it possible.
- `addFileByRequest` over the bridge, ever, unless the threat model changes.
- Loading, hosting, auto-updating, or shipping userscripts to users. The repo holds
  installables; installation is always the user's action.
- Showing userscript sites in the existing Indexers list, or giving them
  `DefaultIndexers` keys.
- A log viewer UI (the popup polls the log store already and shows nothing).
- `test/docker/docker-compose.yaml` fixes (its `network_mode: host` makes its
  `ports:` no-ops and it supplies no credentials).

## Progress log (append newest first)

- **2026-10-19 — plan written, nothing implemented.** Branch `user-script-messaging`
  created from `2.2` (`29deeab`); no worktree, no code. Owner rulings recorded as §2
  decisions 1–8. During research, found the pre-existing class-contract bug (JS emits
  `failure`, `content.css` styles only `error`) — recorded in §1 and fixed at M2
  because the bridge publishes those class names. Design is Level 1 first, RPC only,
  data-not-functions, per-origin grants, `externally_connectable` documented as an
  option. M0 exists to answer the two risky unknowns (runtime content-script
  registration without a blanket host permission; Firefox optional-permission
  behaviour) before any code is written.
