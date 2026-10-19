# PLAN.md — finish the JS conversion on the 2.2 branch

**Branch:** `2.2-js` (created from `origin/2.2` @ `9b23c50`)
**Worktree:** `/home/hutch/Projects/nzbunity-2.2-js` (main checkout `/home/hutch/Projects/nzbunity` stays on `main`)
**Plan written:** 2026-10-19, from a read-only audit. No source files have been changed yet.

---

## 0. How to work this plan (agent protocol)

1. **Resume check** — do this before anything else, every time you pick the plan up:

   ```bash
   cd /home/hutch/Projects/nzbunity-2.2-js
   git status --short
   git log --oneline origin/2.2..HEAD
   grep -n '^- \[ \]' PLAN.md | head   # next unchecked boxes
   ```

   Then read the **Progress log** at the bottom, pick the first unchecked box in the first
   incomplete milestone, and start there. Do not restart work a previous session already
   committed.

2. **Keep this file updated.** After each box: flip `- [ ]` → `- [x]` and append one line to
   the Progress log (newest first) with the commit hash, what changed, and anything
   surprising (a failing command, a version that had to be pinned, an owner decision). The
   log is append-only; never rewrite history there. If you learn something that changes the
   plan, edit the relevant milestone in place and note the edit in the log.

3. **Commit per unit of work** with the branch's own style (short imperative subject, `[2.2]`
   prefix where it helps): e.g. `[2.2] port amenzb and aninzb adapters to JS`,
   `[2.2] add structural guards for entrypoint drift`. Do not squash milestones together —
   reviewers on this repo review file-by-file renames.

4. **Do not switch branches** in `/home/hutch/Projects/nzbunity`; it is a separate checkout of
   `main`. All work happens in this worktree. Do not `git push` until milestone M9 says so.

5. **Delete this file when the work is done.** When every box through M9 is ticked and the
   final verification pass in §4 is green:

   ```bash
   git rm PLAN.md && git commit -m "[2.2] remove PLAN.md, JS conversion complete"
   ```

   Then follow M9's last box about removing the worktree.

6. **Honesty rule.** If a step needs network access, an account, or a browser and you don't
   have it, leave the box unticked and write what blocked you in the Progress log. Never mark
   a build/test box complete without its command having actually run.

---

## 1. Current state (verified 2026-10-19)

- `origin/2.2` tip = `9b23c50` (2026-07-28, "Merge branch 'main' into 2.2"); 9 commits ahead of
  `origin/main` (`ed21786`); merge-base `944028f`.
- Conversion commits: `e8d1f83`, `3c5807a`, `0ad8097` ("normalize spacing" ×3),
  `b564f2e` ("remaining core file changes, removes old TS"), `1a4bcbd` ("Move public and fix
  imports"), `8bd61a6` ("[2.2] npm audit"), `dc7990c`/`ee7cbc6`. So the branch was written
  2026-03-26/27 and last refreshed from `main` on 2026-07-28.
- **Exactly two TypeScript files remain in the whole tree:**
  `src/entrypoints/amenzb.content.ts` (69 lines), `src/entrypoints/aninzb.content.ts` (42 lines).
  They were reintroduced by the later merges of `main` after the conversion — which is why the
  guard tests in M2 matter more than the port itself.
- Both start with `import { defineContentScript } from 'wxt/sandbox';`. The locked
  `wxt@0.20.20` export map publishes only `.`, `./browser`, `./modules`, `./testing`,
  `./utils/*`, `./vite-builder-env` — `wxt/sandbox` was removed in the 0.19→0.20
  "individual exports / `#imports`" change. **So the branch does not build as it stands.**
  (Established from the published export map, not from a build — there is no `node_modules` in
  this worktree yet. M0 confirms it by running the build.)
- 15 converted `src/entrypoints/*.content.js` adapters exist; these 2 make 17. `DefaultIndexers`
  in `src/store.js` already contains `amenzb` (L92) and `aninzb` (L94), so no store edit is
  needed for the port.
- House style of converted entrypoints: `import { defineContentScript } from '#imports';`,
  single quotes, semicolons, 2-space indent, **no blank line between top-level statements**
  (imports → `export default` → `class`), one blank line between class members. Compare
  `src/entrypoints/abnzb.content.js`.
- `package.json` v2.2.0: `"lint": "echo 'No linter configured'"`, no `check`/`compile` script,
  no `prettier`/`typescript`/`eslint` dependency — although a prettier config block already
  exists (`singleQuote`, `trailingComma: "all"`, `printWidth: 90`, `tabWidth: 2`).
  `postinstall` runs `wxt prepare`, which generates `.wxt/tsconfig.json` and `.wxt/wxt.d.ts`.
- `jsconfig.json` exists but is hand-rolled (`checkJs: false`, only `~/*` paths, does **not**
  extend `./.wxt/tsconfig.json`) → no `#imports`/auto-import IntelliSense today.
  `tsconfig.json` was deleted on this branch.
- `.nvmrc` = 24 (`main` still says 22). `.gitignore` L7 still lists `web-ext.config.ts` while the
  branch has `web-ext.config.js` committed.
- Tests: `src/entrypoints/__tests__/example.skip.js` is the only entrypoint test and is skipped
  by its filename → **zero adapter coverage**. `vitest.config.js` does
  `import { WxtVitest } from 'wxt/testing'`; `vitest.setup.js` sets
  `globalThis.happyDOM.settings.fetch.disableSameOriginPolicy = true`.
- Pinned direct deps: `wxt 0.20.20`, `@wxt-dev/module-react 1.2.2`, `react`/`react-dom 19.2.4`,
  `react-icons 5.6.0`, `react-tooltip 5.30.0`, `happy-dom 20.8.8`, `vitest 4.1.2`
  (+ `vite 8.0.3` transitive). No OSV advisory currently covers any of them.

## 2. Ground rules (non-negotiable)

1. **JavaScript is the contribution surface.** No `.ts`/`.tsx` under `src/`, no TS syntax in
   `.js` files, no type annotations in adapters. A contributor adding a site adapter must only
   ever need `npm ci && npm run dev`.
2. **TypeScript and Prettier are private tooling.** devDependencies + a script + a config file
   only. Contributor-facing docs must not name TypeScript — call it "the checker" behind
   `npm run check`, and formatting behind `npm run format`.
3. **Mechanical port only in M1.** No logic changes, no renames of public members. Behaviour
   changes belong in M6 as separately-labelled commits so the rename diff stays reviewable.
4. **Style is Prettier's job, not the linter's.** The lint config stays about correctness
   (unresolved imports, undefined globals), never formatting.
5. Do not add `@types/chrome` back: nothing in `src/` uses bare `chrome.*`; WXT's `wxt/browser`
   provides those types.
6. This worktree sits outside most agents' default workspace, so writes into it may need
   elevated file permissions. If a write is blocked, say so in the Progress log instead of
   writing the file somewhere else.

---

## 3. Milestones

### M0 — Baseline the worktree

- [x] `cd /home/hutch/Projects/nzbunity-2.2-js && npm ci` (runs `postinstall: wxt prepare`, creating the gitignored `.wxt/` dir)
- [x] Run `npm run build` and record the outcome. **Actual baseline: `npm ci` itself failed**, because the `postinstall: wxt prepare` step aborted with `"./sandbox" is not exported ... from package .../node_modules/wxt`. So the branch breaks even earlier than the build. (wxt 0.20.20, node 26.11.1, npm 12.2.1)
- [x] Run `npm test` and record the outcome. **Baseline: 39 passed / 10 failed / 9 skipped / 1 todo.** All 10 failures are `NZBGetHost.test.js` and `SABnzbd.test.js` hitting `ECONNREFUSED` on localhost 7357/7358 — they need `npm run compose:sabnzbd` and `compose:nzbget` (docker). Environmental and pre-existing, so compare against this baseline instead of expecting zero failures.
- [x] Confirm `git status --short` shows only gitignored noise.

### M1 — Port the two adapters to JS (the actual fix; do this first)

**amenzb.content.ts → amenzb.content.js** (`git mv` to keep rename detection), then:

- [x] L1 → `import { defineContentScript } from '#imports';`
- [x] L13 delete the stray blank line right after `class AmenzbContent extends Content {`
- [x] L18 `apiKey: string = '';` → `apiKey = '';` (keep the field for now; M6 may replace it with the base-class `_apikey`)
- [x] L20 → `get isList() {`, L24 → `get isDetail() {`, L29 → `async ready() {`, L44 → `buildApiUrl(downloadUrl) {`
- [x] L34 drop ` as HTMLInputElement`; L52 and L61 drop ` as HTMLAnchorElement`
- [x] Remove the blank lines that separate the import block / `export default` / `class` (match `abnzb.content.js`)
- [x] Add the missing trailing newline at end of file
- [ ] ~~Optionally add JSDoc on `ready()`/`buildApiUrl()`~~ — skipped on purpose: M1 stays a
      pure conversion so the diff is a rename plus deletions. JSDoc can ride along with M5.

**aninzb.content.ts → aninzb.content.js** (`git mv`), then:

- [x] L1 → `import { defineContentScript } from '#imports';`
- [x] L23 `const a = el as HTMLAnchorElement;` → `const a = el;`
- [x] **Leave `'vertical-align': 'middle'` alone.** The quoted dashed key is a valid CSSOM
      named-property assignment; it is not a bug and does not need camelCase.
- [x] Keep the trailing `;` after the `initializeLinks = () => {...}` property assignment
- [x] Same top-level blank-line collapse as above

**Acceptance for M1:**

- [x] `grep -rn "wxt/sandbox" src/` → no results
- [x] `find src -name '*.ts' -o -name '*.tsx'` → no results
- [x] `npm run build` succeeds; `.output/chrome-mv3/manifest.json` has one `content_scripts`
      entry per `src/entrypoints/*.content.js` (17) and includes amenzb + aninzb matches
- [x] `npm run build:all` succeeds (chrome + firefox)
- [x] `npm test` result **unchanged from the M0 baseline** (same 10 docker-dependent failures;
      nothing regressed). A fully green suite needs `npm run compose:sabnzbd` + `compose:nzbget`.
- [x] commit -> `d163353`

### M2 — Structural guard tests (prevents the drift from coming back)

Add a plain vitest file, e.g. `src/__tests__/structure.test.js`, covering:

- [x] no `*.ts` / `*.tsx` anywhere under `src/` (walk with `node:fs`)
- [x] parity: every `src/entrypoints/<name>.content.js` basename is a key in
      `DefaultIndexers` (`src/store.js`) and every key that is meant to be an adapter has a file —
      if the lists legitimately differ, encode the whitelist in the test with a comment
- [x] every `wxt/...` import specifier in `src/` exists in the installed
      `node_modules/wxt/package.json` `exports` map — this catches the whole `wxt/sandbox` bug
      class on any future WXT upgrade
- [x] proof the guards actually bite: instead of un-fixing M1, the tests were run against two
      throwaway probe files (`src/entrypoints/tmpsite.content.ts` and
      `src/entrypoints/tmprole.content.js` importing `wxt/sandbox`); three of the four guards went
      red with the right assertion messages, both probes were deleted and the suite went green
      again. Delete any probe file you create before committing.
- [x] new tests pass: `npx vitest run --mode test src/__tests__/structure.test.js` -> 4/4
- [x] commit

### M3 — Prettier, enforced

- [x] `npm i -D prettier@^3.9.10` (v4 is alpha-only — do not use it) — installed **3.9.10**
- [x] scripts: `"format": "prettier --write ."`, `"format:check": "prettier --check ."`
- [x] added `.prettierignore`: `.wxt`, `.output`, `node_modules`, `package-lock.json`, `test/docker`, and `*.svg` (prettier rewrites svg markup, and the icons are hand-tuned assets — that replaces the `public/` entry the draft called for)
- [x] measured churn: **the entire JS/CSS/JSON tree was already prettier-clean**, so only 3 files moved — `PRIVACY.md` (two double blank lines), `src/entrypoints/options/index.html` (`<!DOCTYPE html>` → `<!doctype html>`, cosmetic and safe), and this file. No standalone `[2.2] apply prettier` commit was needed. `format:check` is green; `npm run build` (810.23 kB, 991 ms) and `npm test` (43 passed, same 10 docker failures) are unchanged afterwards.
- [x] commit

Editing note for whoever picks this up: keep task-list items on one long line. Six-space continuation lines inside a task list parse as an indented code block, which makes `prettier --check` on this file never settle.

### M4 — Import/dependency lint (replace the placeholder `lint` script)

Pick one; prefer ESLint unless the dependency tree makes it painful.

- [x] **Option A taken: ESLint 10.13 + `eslint-plugin-import-x` 4.17.1** (plus `@eslint/js` and `globals`), flat `eslint.config.js`, correctness only. The trick the draft worried about is solved by `settings['import-x/resolver-next']` with `createNodeResolver({ tsconfig: { configFile: '.wxt/tsconfig.json' }, extensions: [...] })` — that is what makes `~/...` resolve, and it also honours package `exports`. `#imports` is allow-listed in `no-unresolved` because it is a build-time alias with no real file.
- [x] auto-import globals come from WXT, not a hand-kept list: `imports: { eslintrc: { enabled: true } }` in `wxt.config.js` makes `wxt prepare` emit **`.wxt/eslint-auto-imports.mjs`** (0.20.20 also writes `.wxt/eslintrc-auto-import.json`; the draft guessed `.json` only). That module default-exports a ready-made flat-config entry, so it is spread into a `files: ['src/entrypoints/**/*.js']` block. If `.wxt/` is missing, `npm run lint` fails with a clear "cannot find module" — `npm ci` regenerates it via postinstall.
- [x] both sanity checks proven, not assumed: a probe adapter importing `~/Contnet` and `wxt/sandbox` produced `import-x/no-unresolved` for each, while `#imports` and real `wxt/*` subpaths passed. Probe deleted.
- [x] Option B (dependency-cruiser) unnecessary now that the resolver works; it would add a second mental model for the same class of bug.
- [x] script kept as `lint`, now `eslint .`
- [x] no stylistic rules; formatting stays with `npm run format` / `format:check`
- [x] commit

**Triage record — the first run produced 56 errors in 22 files, all pre-existing.** Only one rule was switched off: `no-sparse-arrays` (15 hits), because `const [, id] = href.match(..) ?? [, '']` is the established adapter idiom and the elisions are never read. Everything else was fixed in place and each change is provably behaviour-neutral: `let category = '';` -> `let category;` in abnzb, althub, drunkenslug, nzbgeek and omgwtfnzbs (every branch overwrites it before any read); `{ }` around the `toggle-queue` case in `background.js`; the empty `if (this.isInList(a)) {}` in `nzbfinder.content.js` inverted to `if (!this.isInList(a))`; two dead regex escapes (`[\d\.]` and `[a-f0-9\-]`); `[dName, mm, dd, yy]` -> `[, mm, dd, yy]`; one unused import dropped from `store.test.js`; and `getLastError()` deleted from `utils.js` (private, referenced nowhere in `src/`, not exported — git history still has it if the owner wants it back). `no-unused-vars` runs with `args: 'none'` and `ignoreRestSiblings: true`, both justified inline: downloader interface stubs, browser-API-shaped callbacks, and the `const { formatted, ...rest }` key-dropping idiom in `logger.js`.

Owner-gated finding, deliberately left alone: `src/entrypoints/options/Options.jsx:19` calls `useLogger('Options')` whose only effect is a 5-second polling subscription that the Options page never renders. The unused binding was dropped but the call kept — removing a hook call changes render behaviour, so it is not provably neutral.

### M5 — JS static checking, invisible to contributors

- [x] `npm i -D typescript@^7.0.2` (the only new devDependency; WXT 0.21 declares `typescript >=5.4` as an optional peer). TS 7 handled JSDoc'd JavaScript without trouble, so no fallback to `^6`/`^5.9` was needed.
- [x] `jsconfig.json` replaced: it now `extends: "./.wxt/tsconfig.json"` (aliases + `#imports` + auto-import types come from the generated base) and sets `checkJs: false`, `allowJs: true`, `jsx: "react-jsx"`, `noImplicitAny: false`. Two of those were missing from this plan's original sketch and both matter: without `allowJs` the program contains **no JavaScript at all** and `// @ts-check` would be a no-op; without `noImplicitAny: false` every untyped callback parameter becomes an error whose only fix is more JSDoc in front of the contributor. The file carries JSONC comments in neutral language, and notes that `.wxt/` is gitignored so `npm ci`/`wxt prepare` must have run before `npm run check` can resolve the base.
- [x] script `"check": "tsc --noEmit -p jsconfig.json"`. No "typecheck"/"compile" alias, and nothing TypeScript-shaped appears in README, CONTRIBUTING, or any error string a contributor would see.
- [x] `// @ts-check` on `src/Content.js` + both new adapters. 24 errors at first; every one was fixed with comments only (zero runtime-affected lines). The fixes, as a recipe for the next module:
  - Shared JSDoc typedefs are module-scoped, so a name like `NZBAddUrlResult` is invisible in `Content.js` even though it is used everywhere. Fix: `@export` on the typedef where it lives (`src/downloader/index.js`) plus a one-line alias where it is used: `/** @typedef {import('~/downloader').NZBAddUrlResult} NZBAddUrlResult */`. `DownloaderOptions` still needs this and is the single biggest remaining error class.
  - `Record<string, *>` / `Promise<*>` / `{*[]}` are Closure, not TypeScript. In an unchecked file they are silently wrong; in an opted-in file they error. Fixed in the reachable files: `src/Content.js:330` and `src/utils.js` (`RequestOptions.params`, `objectToQuery`, `request`'s return). The rest of the list from the plan is still outstanding.
  - `@enum` objects: TS 7 rejects the enum name in a type position (TS2749) even with the JSDoc attached, so each needs a `/** @typedef {(typeof X)[keyof typeof X]} X */` alias. Also, the conversion left a blank line between `/** @enum … */` and its `export const`, which detaches the comment entirely; removed at all three sites (`downloader/index.js` x2, `store.js` x1).
  - `@param {string | NodeList | Element[]}` loses the element type: `Array.from` then yields `Node[]`. `NodeListOf<Element>` is the accurate type and needs no cast.
  - Where the TS original had a cast and the conversion dropped it, restore it as a JSDoc cast rather than inventing a narrower type: `git show origin/main:src/entrypoints/amenzb.content.ts` had `as HTMLInputElement` / `as HTMLAnchorElement`, and aninzb had `as HTMLAnchorElement`. Verified against `origin/main` before writing them.
  - Base-class members that subclasses widen need an explicit JSDoc type or TS believes the base declaration: `get id()` returns `string` (was inferred as the literal `''`, which made `DefaultIndexers[this.id]` `never`), `indexerOptions` is `IndexerOptions | undefined`, `ready()` returns `void | boolean | Promise<void | boolean>` (its own doc block already says it may return false).
  - `src/utils.js`'s `RequestOptions` typedef had fallen behind its own implementation (`method`, `headers`, `body` are all read by `request()`); the JSDoc now lists them.
- [x] `checkJs: false` stays, and the opt-in contract was proven with three probes: an opted-in file reports a typo'd property; a non-opted-in file stays silent about the same class of mistake; a non-opted-in file still fails on a **syntax** error (`allowJs` parses every `.js`, so broken files cannot hide). All probes were reverted; `git status` after them showed only intended edits.
- [x] commit (see Progress log). No CI wiring: the repo has no workflow files and §7 puts CI redesign out of scope, so `check`/`lint`/`format:check` are local gates only.
- [ ] _(later, one module per commit, never mandatory for a contributor)_ widen the opt-in. Measured cost today: **133 errors under `src/`** (`npx tsc --noEmit --checkJs -p jsconfig.json`, ignore the node_modules noise in that output). Worst files: `downloader/SABnzbd.js` 17, `downloader/NZBGet.js` 17, `entrypoints/binsearch.content.js` 14, `Client.js` 12, `omgwtfnzbs.content.js` 9, `popup/Popup.jsx` 8. By code: 44x TS2304 (cross-module typedef names, fixed by the `@export` + alias recipe above), 29x TS2339, 15x TS2322, 14x TS2531 + 5x TS18047 + 5x TS18048 (genuine missing null-guards — those are **behaviour changes**, so they need the owner's sign-off, not a cast), 3x TS2538 (indexing with a possibly-null key).

### M6 — Optional behaviour-neutral cleanups (only once M1–M5 are green)

- [x] amenzb: the private `apiKey` field is gone; `ready()` assigns the base class `_apikey` (`src/Content.js:63`) and `buildApiUrl()` reads the base getter `this.apikey`. No other file referenced the field.
- [x] amenzb: `this.debug(`[NZB Unity] ready()`, { apikey: this.apikey })` plus `if (!this.apikey) console.warn(...)` now matches abnzb / dognzb / drunkenslug exactly. The amenzb wording was kept for the warning ("Unable to find apikey — are you logged in?") because the login hint is the useful part. **Console output only**: the unconditional `console.info('API key loaded')` became a DEV-gated `debug`, so a production build logs one line less and nothing else changed.
- [ ] amenzb (left unticked, needs the owner): consider `window.location.origin` instead of the hardcoded `https://amenzb.moe` in
      `buildApiUrl()` (the `ready()` fetch hardcodes the same host) — **needs owner OK**
- [ ] (left unticked deliberately) do **not** change the `credentials: 'include'` cross-origin fetch without owner sign-off;
      it is intentional and only smoke-testable with a logged-in amenzb account
- [ ] commit together with the two unticked items above, once the owner rules on them

### M7 — Docs that currently teach the broken pattern

Line numbers were from `README.md` at `9b23c50`; all are done, so they are listed by what changed rather than by line.

- [x] "built primarily in TypeScript and SASS, using a Gulp build process" → "written in JavaScript (a little JSX for the popup and option pages), styled with CSS, and built with the WXT CLI". Gulp has been gone for years; naming it sent contributors looking for a build system that does not exist.
- [x] `public/` was listed as a subdirectory of `src/`; it lives at the repo root (`srcDir: 'src'`, WXT's `publicDir` defaults to `<root>/public`, and `public/icon` is there). Moved to the top level of the directory list.
- [x] `<sitename>.content.ts` → `.content.js`; the recommended examples `omgwtfnzbs.content.ts` / `dognzb.content.ts` / `Content.ts` do not exist on this branch → now cites `aninzb.content.js` (smallest adapter) and `dognzb.content.js`, and `Content.js`.
- [x] `src/store.ts` → `src/store.js` (also in the `src/store.js:88` comment about `DefaultIndexers` keys, and a stray `store.ts` in `src/dev.js:3` that was not on this plan's list).
- [x] the adapter example fence changed from ` ```typescript ` to ` ```javascript ` and its import from `wxt/sandbox` to `#imports` — this was the only place in the repo that still taught the import that breaks `wxt prepare` on 0.20.
- [x] the setup steps now name the local gates (`lint`, `format:check`, `check`) next to `test`/`build`, described as "report no problems", with no reference to what `check` is built on.
- [x] added one sentence pointing a new adapter author at `src/__tests__/structure.test.js`, which fails when an entrypoint has no `DefaultIndexers` entry or vice versa — the exact drift that caused this branch's breakage.
- [x] `.gitignore`: dropped the `web-ext.config.ts` line. The tracked file is `web-ext.config.js`, so the pattern matched nothing; it is not replaced with a `.js` pattern because that config is committed on purpose.
- [x] commit

### M8 — Dependency refresh (one commit per tier; see §5 for numbers and dates)

- [x] routine minors, safe: `react`/`react-dom` 19.2.4 → 19.3.1 (commit `a757545`; about +30 kB in the built package, worth knowing), `react-icons` 5.6.0 → 5.7.0, `react-tooltip` 5.30.0 → 5.30.1 (patch only). `@wxt-dev/module-react` 1.2.2 is already current.
- [x] `happy-dom` 20.8.8 → 21.0.3 (+ `globals` 16 → 17 for the eslint config), commit `ae4e124`. v21 turns CSS and iframe loading off by default, which is what this suite already saw; `disableCSSFileLoading` is not used anywhere; `vitest.setup.js`'s `happyDOM.settings.fetch.disableSameOriginPolicy` still exists and is still a boolean, checked against a fresh `Window` rather than assumed. Test totals identical to the M0 baseline.
- [x] **WXT 0.20.20 → 0.21.4**, commit `115dacb`, with an important caveat found on the way:
  - **Blocker found and worked around.** 0.21.4 cannot build this project as laid out. A stylesheet imported from the shared `src/Content.js` module (every content script gets its CSS that way) crashes vite 8's `vite:css` plugin during the content-script build: `Cannot read properties of undefined (reading 'get')` at `cssModulesCache.get(config).get(id)` — the plugin's `buildStart` never ran for that container. Reproduced on vite 8.0.16 / 8.1.6 / 8.2.4 / 8.3.4, so it is not a vite-window problem. `cssInjectionMode: 'file'` does not help. vite 7 is not available because `@wxt-dev/module-react` bundles a `@vitejs/plugin-react` that imports vite's `./internal` subpath. Nothing upstream matches it: searched WXT's issues and the 0.21.0-0.21.4 release notes.
  - **Workaround:** each `src/entrypoints/*.content.js` now imports `~/assets/content.css` itself, and the import is gone from `src/Content.js`. That is what WXT documents for content-script CSS, and it costs nothing: 0.20 already emitted one copy per script, so the package is 837.68 kB against 838.07 kB before the change.
  - **Verified, not assumed:** 17 `content_scripts` entries in the built manifest, every one with both `js` and `css`; `content-scripts/newznab.js` and `content-scripts/newznab.css` are still emitted at the exact paths `src/entrypoints/background.js:31-36` injects them from (that coupling is silent — nothing tests it); `build:all` green for chrome-mv3 and firefox.
  - `vite@^8.3.4` is now an explicit devDependency (required peer on 0.21). `web-ext` is deliberately **not** installed: it is an optional peer, WXT 0.21 does not depend on it, and installing it re-adds 5 high advisories (`web-ext` → `@devicefarmer/adbkit` → `node-forge`, plus a `brace-expansion` DoS through `multimatch`). Consequence to tell the owner: `npm run dev:firefox` (and `wxt -b firefox`) will need `npm i -D web-ext` on the owner's machine.
  - `wxt/testing` is gone in 0.21 → `vitest.config.js` imports `WxtVitest` from `wxt/testing/vitest-plugin`, `src/entrypoints/__tests__/example.skip.js` imports `fakeBrowser` from `wxt/testing/fake-browser`.
  - The generated `.wxt/tsconfig.json` changed shape on 0.21: it now sets `noImplicitOverride`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `moduleDetection: force`, `allowImportingTsExtensions`, `module: Preserve`, `lib: [ESNext, DOM, DOM.Iterable]`, and drops `esModuleInterop`/`forceConsistentCasingInFileNames`. Only one of them produced errors: `noImplicitOverride` needed `@override` JSDoc tags on the 8 overridden members in the two `@ts-check` files (amenzb, aninzb). Kept the flag on rather than turning it off: a typo'd hook (`initializeLink` instead of `initializeLinks`) is exactly the silent-failure class this branch had, and the structure test does not catch it. `noUncheckedIndexedAccess` produced nothing today but will bite as more files opt in.
- [x] `vitest` 4.1.2 → 5.0.5, landed with the WXT commit as planned. `WxtVitest` works with it; the `^4.1.12` fallback was not needed. Also verified separately that vitest 5 + WXT 0.20.27 gives identical results, in case the WXT upgrade is ever reverted.
- [x] `npm audit`: **0 vulnerabilities** on the committed tree (measured after a clean `npm ci`). The 0.20 line was the problem, not this project: WXT 0.20 depends on `web-ext-run`, which pulled 11 findings — 3 critical (`fx-runner`, `shell-quote`, `web-ext-run`), 6 high (`adm-zip`, `firefox-profile`, `node-forge`, `@devicefarmer/adbkit`, `tmp`), 2 moderate. `npm audit fix` could not reach any of them without jumping to 0.21. Previous audit on this branch: 2026-03-27 in `8bd61a6`.
- [ ] `react-tooltip` 5.30.1 → 6.0.9 — **left for the owner.** v6 removed the raw-HTML string API, and this repo uses `data-tooltip-html` with nested `<span>`/`<p>` markup at `src/entrypoints/options/DownloaderForm.jsx:153,195,229,250,265,282`; `src/assets/tooltip.css:36-58` also overrides `.react-tooltip-arrow`, `.react-tooltip__place-top` and `.react-tooltip__place-bottom`, and the `react-tooltip/dist/react-tooltip.css` entry path would need re-checking against v6 markup. Six call sites plus CSS that only a browser can confirm: that is a deliberate migration, not a routine bump.
- [~] "land the M3-M5 devDependencies as explicit pins": **done differently on purpose.** `prettier`, `eslint`, `@eslint/js`, `eslint-plugin-import-x`, `globals`, `typescript` are all in `package.json` as carets, matching every other entry in the file; exact pins would be the only caret-free entries and would send `npm outdated` silent for them too. Say so in the review rather than pretending the box was ticked as written.
- [x] `.nvmrc` stays 24 on this branch (WXT 0.21 needs Node >=22; verified on Node 26.11.1). `main` still says 22 → harmonize during the M9 merge decision.
- [ ] Dependabot cleanup is owner-side and cannot be done from a worktree: ~15 open branches, all lockfile-only and 12-23 commits stale, several against the Gulp-era tree. After this tier they are worth closing so the repo does not look abandoned to a first-time contributor.

### M9 — Final pass, merge decision, cleanup

- [x] green run of `npm ci && npm run check && npm run lint && npm run format:check && npm run test && npm run build:all`, 2026-10-19, run exactly in that order from `rm -rf node_modules .wxt .output`: `npm ci` clean (257 packages, 0 vulnerabilities, postinstall `wxt prepare` succeeds); `check` silent; `lint` silent; `format:check` clean; **`npm test` fully green: 5 files, 53 passed / 9 skipped / 1 todo** — the first time this branch has been green, because the test containers from §4.6 were finally running; `build:all` green for chrome-mv3 and firefox, 837.68 kB each.
- [ ] manual smoke in a real browser. **Not done, and not attempted**: this session has no browser session, no indexer accounts, and no GUI. What the automated gates do cover: the built chrome-mv3 and firefox packages build, all 17 content scripts appear in the manifest with both `js` and `css`, and `content-scripts/newznab.js` / `newznab.css` are where `background.js` injects them from. What only a logged-in browser can confirm: amenzb's `/profile` really contains `apiKeyInput` and the key is picked up; aninzb list **and** detail pages with `replaceLinks` on and off; the CSS injection actually styling the buttons after the per-entrypoint import move; abnzb and the other 14 adapters still working; the command shortcut `activate-newznab`. `/usr/bin/chromium` exists on this machine, but headless Chromium loading an MV3 extension against logged-in indexers is not something to fake.
- [ ] **owner decision:** port the same two-adapter fix onto `main` as well, or merge `2.2` into `main` now. `main` is only one commit ahead of the merge-base (the 2.2.0 version bump), so closing the loop is cheap today and gets more expensive with every site profile added on either side. This branch now also carries the whole toolchain tier, which makes the merge more valuable and slightly more reviewable commit-by-commit.
- [ ] `git push -u origin 2.2-js` — only after the owner is happy with the branch. Not pushed.
- [ ] `git rm PLAN.md && git commit -m "[2.2] remove PLAN.md, JS conversion complete"` — **deliberately not done.** The conversion work itself is complete (M0-M8), but these remain open and belong to the owner, not the agent: `react-tooltip` 6, the amenzb origin/credentials hardcoding, Dependabot cleanup, the browser smoke pass, the merge/push decision. Delete the file once those are settled.
- [ ] from the main checkout: `git worktree remove /home/hutch/Projects/nzbunity-2.2-js` (keep it until the PR/merge is settled)

---

## 4. Verification playbook

```bash
cd /home/hutch/Projects/nzbunity-2.2-js
npm ci                                  # also runs wxt prepare
grep -rn "wxt/sandbox" . --include='*.js' --include='*.ts' --include='*.md'   # expect: nothing
find src -name '*.ts' -o -name '*.tsx'  # expect: nothing
ls src/entrypoints/*.content.js | wc -l # adapters (17 after M1)
npm run check && npm run lint && npm run format:check && npm run test
npm run build && npm run build:firefox
node -e "const m=require('./.output/chrome-mv3/manifest.json');console.log(m.content_scripts.length)"
```

Two things no automated check can prove, so call them out explicitly in the Progress log:

1. amenzb's `ready()` fetch with `credentials: 'include'` only works with a logged-in session —
   needs a real account.
2. DOM injection timing / link placement per site (`adjacent`, `replaceLinks`, CSS `styles`) is
   only observable in a browser.

## 5. Dependency reference (lookups performed 2026-10-19)

> Kept as the research snapshot taken before the upgrade. §M8 records what actually landed and what was found on the way.

No OSV advisory currently affects any pinned direct dependency, so nothing here is forced by a
security problem. Only two majors require source work: WXT 0.21 and react-tooltip 6.

| package                             | pinned on 2.2        | latest seen             | action                                                     |
| ----------------------------------- | -------------------- | ----------------------- | ---------------------------------------------------------- |
| `wxt`                               | 0.20.20              | **0.21.4** (2026-08-11) | major, required — see M8                                   |
| `@wxt-dev/module-react`             | 1.2.2                | 1.2.2                   | current                                                    |
| `react`, `react-dom`                | 19.2.4               | 19.3.1 (2026-10-14)     | minor bump                                                 |
| `react-icons`                       | 5.6.0                | 5.7.0                   | minor bump                                                 |
| `react-tooltip`                     | 5.30.0               | **6.0.9**               | major, needs `data-tooltip-html` migration                 |
| `happy-dom`                         | 20.8.8               | **21.0.3**              | major, CSS/iframe loading off by default                   |
| `vitest`                            | 4.1.2                | **5.0.5** (2026-10-15)  | major, couple it to the WXT bump                           |
| `vite`                              | 8.0.3 (transitive)   | 8.3.4                   | becomes a direct devDep with WXT 0.21                      |
| `typescript`                        | absent               | 7.0.2 (2026-07-08)      | new devDep, checker only (M5)                              |
| `prettier`                          | absent (config only) | 3.9.10                  | new devDep (M3)                                            |
| `eslint` / `eslint-plugin-import-x` | absent               | 10.13.0 / 4.17.1        | new devDep (M4, option A)                                  |
| `@types/react`, `@types/react-dom`  | absent               | 19.3.0                  | only if JSX files opt into `@ts-check`                     |
| `web-ext`                           | absent               | ≥9.2.0                  | add as devDep if WXT 0.21 is used with `web-ext.config.js` |

## 6. Gotchas

- `node_modules` is per-worktree — `npm ci` again here, not in the main checkout.
- `.wxt/` is generated and gitignored: anything that reads `.wxt/tsconfig.json` or the
  auto-import globals file needs `wxt prepare` to have run (`npm ci` does it via `postinstall`).
- `#imports` is the convention across all converted entrypoints; keep it, don't "modernize" to
  `wxt/utils/define-content-script` inside a mechanical port.
- amenzb's file has no trailing newline today; prettier will add one — expected diff noise.
- The two leftover `.ts` files came from merges of `main`, so M2 (guards) + M9 (merge decision)
  are what actually stop this recurring. The port alone does not.
- `npm test` passing says nothing about adapter correctness — there is no adapter test.
- WXT docs: <https://wxt.dev/guide/resources/upgrading.html> (0.20→0.21 breaking list).
- react-tooltip v5→v6: <https://react-tooltip.com/docs/upgrade-guide/changelog-v5-v6>.

## 7. Explicitly out of scope

Rewriting the React UI to anything else, chasing WXT beyond 0.21, a big lint ruleset, converting
tests to a typed flavour, CI/workflow redesign, and any behaviour change not listed in M6.

---

## Progress log (append newest first)

- **2026-10-19 — M9 verification run is green end to end, including the tests that never ran before.** `npm ci` → `check` → `lint` → `format:check` → `test` → `build:all` from a wiped `node_modules`/`.wxt`/`.output`: 0 vulnerabilities, silent checker, silent linter, 53 passed / 9 skipped / 1 todo, 837.68 kB for both browser targets. The 10 downloader tests that have failed with `ECONNREFUSED` on this branch since it started are now passing, because the SABnzbd and NZBGet containers were finally brought up by hand — recipe in §4.6, containers removed again afterwards. What is still open is owner work, not conversion work: the browser smoke pass, `react-tooltip` 6, amenzb origin/credentials, Dependabot, the merge and the push. PLAN.md stays in the tree for that reason.

- **2026-10-19 — M8 done except the owner-gated boxes (three commits: `a757545` React, `ae4e124` happy-dom/globals, `115dacb` WXT/vite/vitest).** The interesting one is the last: WXT 0.21.4 would not build this project because vite 8 crashes on the CSS imported through the shared `src/Content.js` module, so each content script now imports the stylesheet it injects. Measured before accepting that: 17 content scripts each with their own `content-scripts/<name>.css`, `newznab.js`/`newznab.css` still at the paths `background.js` injects them from, 837.68 kB against 838.07 kB. `npm audit` went from 11 findings (3 critical, all through WXT 0.20's `web-ext-run`) to 0, measured after a clean `npm ci` - which also means `postinstall: wxt prepare` now succeeds on this branch for the first time. `web-ext` is deliberately not installed, so `dev:firefox` will need it added locally. Not done: `react-tooltip` 6 (owner), Dependabot cleanup (owner).

- **2026-10-19 — M7 done, commit `077a68a`.** README no longer mentions TypeScript, SASS, Gulp, `.content.ts`, `src/store.ts` or `from 'wxt/sandbox'`; `public/` is documented at the repo root where it actually is; the setup steps list `lint` / `format:check` / `check` as local gates without saying what `check` runs; and new adapter authors get pointed at `structure.test.js`. Also fixed `.gitignore`'s dead `web-ext.config.ts` pattern and a stray `store.ts` in `src/dev.js:3`. Gates unchanged: `check`/`lint`/`format:check` clean, tests at baseline, build 810.22 kB.

- **2026-10-19 — M6 partially done, commit `20c5258` (the two owner-gated boxes are still open).** amenzb now uses the base class `_apikey`/`apikey` instead of its own `apiKey` field, and its logging matches the sibling adapters (`this.debug(...)` plus a warn when the key is missing). Only console output changed. The hardcoded `https://amenzb.moe` origin and `credentials: 'include'` were left alone on purpose: both are owner decisions and neither is testable without a logged-in amenzb account. Gates after the change: `check` / `lint` / `format:check` clean, `npm test` identical to the M0 baseline, build 810.22 kB.

- **2026-10-19 — M5 done, commit `36fc427`.** `npm run check` is a real gate: `typescript@7.0.2` (only new devDep), `jsconfig.json` extends the generated `.wxt/tsconfig.json`, `checkJs: false` + per-file `// @ts-check`. Opted in `src/Content.js` + both new adapters: 24 errors, all fixed with JSDoc-only edits, and the check was proven to bite with throwaway probes. Two conversions casualties fixed on the way: three `@enum` consts had their JSDoc detached by a blank line, and shared typedefs were unreachable from other modules (TS2304). `npm run check`/`lint`/`format:check` exit 0, `npm test` is unchanged from the M0 baseline (10 docker-dependent failures), build size identical at 810.21 kB. Measured the cost of a repo-wide opt-in for later: 133 errors under `src/`, of which ~44 are one typedef-scoping pattern. Nothing TypeScript-related appears in contributor-facing text.

- **2026-10-19 — M4 done.** `npm run lint` is a real gate now: ESLint 10.13 + eslint-plugin-import-x 4.17.1 flat config, zero errors across the tree, and it demonstrably catches both a typo'd `~/` import and the historical `wxt/sandbox` import. 56 pre-existing findings were triaged (see the M4 triage record) with behaviour-neutral fixes; one rule disabled with a written reason. `wxt.config.js` gained `imports.eslintrc.enabled` so the auto-import globals stay generated.

* **2026-10-19 — M3 done.** prettier 3.9.10 as a devDependency, `format` + `format:check` scripts, `.prettierignore`. The headline result: **the source tree needed no reformatting at all** — the 2.2 conversion pass left it prettier-clean, so enforcing formatting costs three files of noise, all documentation/markup. `format:check` now passes and is a usable gate.

- **2026-10-19 — M2 done, `src/__tests__/structure.test.js` (uncommitted at time of writing).**
  Four guards: no typed files under `src/`, indexer->entrypoint parity, entrypoint->indexer parity
  (with `newznab` whitelisted: it is one shared adapter gated by the `EnableNewznab` option, so it
  intentionally has no `DefaultIndexers` key - 17 adapters vs 16 keys), and every `wxt/*` import
  specifier validated against the installed `node_modules/wxt/package.json` exports map.
  4/4 green, and proven red against probe files (see M2).

- **2026-10-19 — M1 done, commit `d163353`** (`git mv` preserved rename detection, 15 changed
  lines in amenzb + 4 in aninzb, zero logic changes). After it: `wxt prepare` succeeds,
  `npm run build` and `npm run build:all` both succeed, the chrome manifest has 17
  `content_scripts` entries including amenzb and aninzb, `grep wxt/sandbox src/` is empty and
  `find src -name '*.ts*'` is empty. Also confirmed the JSDoc-free conversion needs no other edit:
  the base class already exposes `_apikey`/`get apikey()` (Content.js:63,65) for M6 to use.

- **2026-10-19 — M0 done (with an ordering deviation worth knowing).** `npm ci` could not
  complete _before_ M1, because its `postinstall: wxt prepare` is where the `wxt/sandbox` failure
  surfaces: `ERROR "./sandbox" is not exported under the conditions [...] from package
.../node_modules/wxt`. node_modules was still populated (310 entries) and `.wxt/tsconfig.json`
  was generated, so tooling could run. This turns the earlier inference into a fact: **branch 2.2
  fails `npm ci` as published.** Test baseline: 39 passed / 10 failed / 9 skipped / 1 todo, all
  failures `ECONNREFUSED` on localhost 7357-7358 (NZBGetHost + SABnzbd integration tests need the
  docker services). Docker was deliberately not started: that is state outside the worktree.

- **2026-10-19** — `PLAN.md` written. Worktree `/home/hutch/Projects/nzbunity-2.2-js` created on
  branch `2.2-js` from `origin/2.2` (`9b23c50`). No source files touched yet. Verified in the
  worktree: 2 remaining `.ts` files (amenzb, aninzb), 15 `.content.js` adapters,
  `DefaultIndexers` already lists `amenzb` (store.js:92) and `aninzb` (store.js:94), README stale
  lines at 87/109/114/116/120-121, `jsconfig.json` does not extend `.wxt/tsconfig.json`,
  `.gitignore:7` stale, `lint` script is a placeholder, `.nvmrc` = 24.
