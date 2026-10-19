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

* `origin/2.2` tip = `9b23c50` (2026-07-28, "Merge branch 'main' into 2.2"); 9 commits ahead of
  `origin/main` (`ed21786`); merge-base `944028f`.
* Conversion commits: `e8d1f83`, `3c5807a`, `0ad8097` ("normalize spacing" ×3),
  `b564f2e` ("remaining core file changes, removes old TS"), `1a4bcbd` ("Move public and fix
  imports"), `8bd61a6` ("[2.2] npm audit"), `dc7990c`/`ee7cbc6`. So the branch was written
  2026-03-26/27 and last refreshed from `main` on 2026-07-28.
* **Exactly two TypeScript files remain in the whole tree:**
  `src/entrypoints/amenzb.content.ts` (69 lines), `src/entrypoints/aninzb.content.ts` (42 lines).
  They were reintroduced by the later merges of `main` after the conversion — which is why the
  guard tests in M2 matter more than the port itself.
* Both start with `import { defineContentScript } from 'wxt/sandbox';`. The locked
  `wxt@0.20.20` export map publishes only `.`, `./browser`, `./modules`, `./testing`,
  `./utils/*`, `./vite-builder-env` — `wxt/sandbox` was removed in the 0.19→0.20
  "individual exports / `#imports`" change. **So the branch does not build as it stands.**
  (Established from the published export map, not from a build — there is no `node_modules` in
  this worktree yet. M0 confirms it by running the build.)
* 15 converted `src/entrypoints/*.content.js` adapters exist; these 2 make 17. `DefaultIndexers`
  in `src/store.js` already contains `amenzb` (L92) and `aninzb` (L94), so no store edit is
  needed for the port.
* House style of converted entrypoints: `import { defineContentScript } from '#imports';`,
  single quotes, semicolons, 2-space indent, **no blank line between top-level statements**
  (imports → `export default` → `class`), one blank line between class members. Compare
  `src/entrypoints/abnzb.content.js`.
* `package.json` v2.2.0: `"lint": "echo 'No linter configured'"`, no `check`/`compile` script,
  no `prettier`/`typescript`/`eslint` dependency — although a prettier config block already
  exists (`singleQuote`, `trailingComma: "all"`, `printWidth: 90`, `tabWidth: 2`).
  `postinstall` runs `wxt prepare`, which generates `.wxt/tsconfig.json` and `.wxt/wxt.d.ts`.
* `jsconfig.json` exists but is hand-rolled (`checkJs: false`, only `~/*` paths, does **not**
  extend `./.wxt/tsconfig.json`) → no `#imports`/auto-import IntelliSense today.
  `tsconfig.json` was deleted on this branch.
* `.nvmrc` = 24 (`main` still says 22). `.gitignore` L7 still lists `web-ext.config.ts` while the
  branch has `web-ext.config.js` committed.
* Tests: `src/entrypoints/__tests__/example.skip.js` is the only entrypoint test and is skipped
  by its filename → **zero adapter coverage**. `vitest.config.js` does
  `import { WxtVitest } from 'wxt/testing'`; `vitest.setup.js` sets
  `globalThis.happyDOM.settings.fetch.disableSameOriginPolicy = true`.
* Pinned direct deps: `wxt 0.20.20`, `@wxt-dev/module-react 1.2.2`, `react`/`react-dom 19.2.4`,
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

- [ ] `cd /home/hutch/Projects/nzbunity-2.2-js && npm ci` (runs `postinstall: wxt prepare`, creating the gitignored `.wxt/` dir)
- [ ] Run `npm run build` and record the outcome in the Progress log. Expected: a resolution
      failure on `wxt/sandbox` in the two adapters. This is the evidence M1 is a build fix.
- [ ] Run `npm test` and record the outcome (expect 0 real adapter tests, 1 skipped file).
- [ ] Confirm `git status --short` shows only gitignored noise.

### M1 — Port the two adapters to JS (the actual fix; do this first)

**amenzb.content.ts → amenzb.content.js** (`git mv` to keep rename detection), then:

- [ ] L1 → `import { defineContentScript } from '#imports';`
- [ ] L13 delete the stray blank line right after `class AmenzbContent extends Content {`
- [ ] L18 `apiKey: string = '';` → `apiKey = '';` (keep the field for now; M6 may replace it with the base-class `_apikey`)
- [ ] L20 → `get isList() {`, L24 → `get isDetail() {`, L29 → `async ready() {`, L44 → `buildApiUrl(downloadUrl) {`
- [ ] L34 drop ` as HTMLInputElement`; L52 and L61 drop ` as HTMLAnchorElement`
- [ ] Remove the blank lines that separate the import block / `export default` / `class` (match `abnzb.content.js`)
- [ ] Add the missing trailing newline at end of file
- [ ] Optionally add JSDoc on `ready()`/`buildApiUrl()` only if it costs nothing in review noise

**aninzb.content.ts → aninzb.content.js** (`git mv`), then:

- [ ] L1 → `import { defineContentScript } from '#imports';`
- [ ] L23 `const a = el as HTMLAnchorElement;` → `const a = el;`
- [ ] **Leave `'vertical-align': 'middle'` alone.** The quoted dashed key is a valid CSSOM
      named-property assignment; it is not a bug and does not need camelCase.
- [ ] Keep the trailing `;` after the `initializeLinks = () => {...}` property assignment
- [ ] Same top-level blank-line collapse as above

**Acceptance for M1:**

- [ ] `grep -rn "wxt/sandbox" src/` → no results
- [ ] `find src -name '*.ts' -o -name '*.tsx'` → no results
- [ ] `npm run build` succeeds; `.output/chrome-mv3/manifest.json` has one `content_scripts`
      entry per `src/entrypoints/*.content.js` (17) and includes amenzb + aninzb matches
- [ ] `npm run build:all` succeeds (chrome + firefox)
- [ ] `npm test` still passes
- [ ] commit

### M2 — Structural guard tests (prevents the drift from coming back)

Add a plain vitest file, e.g. `src/__tests__/structure.test.js`, covering:

- [ ] no `*.ts` / `*.tsx` anywhere under `src/` (walk with `node:fs`)
- [ ] parity: every `src/entrypoints/<name>.content.js` basename is a key in
      `DefaultIndexers` (`src/store.js`) and every key that is meant to be an adapter has a file —
      if the lists legitimately differ, encode the whitelist in the test with a comment
- [ ] every `wxt/...` import specifier in `src/` exists in the installed
      `node_modules/wxt/package.json` `exports` map — this catches the whole `wxt/sandbox` bug
      class on any future WXT upgrade
- [ ] write these tests **before** finishing M1 if convenient: watching them go red then green
      is the cheapest proof they work
- [ ] `npm test` green with the new tests included
- [ ] commit

### M3 — Prettier, enforced

- [ ] `npm i -D prettier@^3.9.10` (v4 is alpha-only — do not use it)
- [ ] scripts: `"format": "prettier --write ."`, `"format:check": "prettier --check ."`
- [ ] add `.prettierignore`: `.wxt`, `.output`, `node_modules`, `package-lock.json`, `public/`,
      `test/docker/`
- [ ] run `npm run format:check` and record how much of the repo is already clean. If the churn
      is non-trivial, land it as its own commit (`[2.2] apply prettier`) separate from real work,
      then re-run `npm run build`. Expect prettier to reformat this PLAN.md too — that's fine.
- [ ] commit

### M4 — Import/dependency lint (replace the placeholder `lint` script)

Pick one; prefer ESLint unless the dependency tree makes it painful.

- [ ] **Option A — ESLint 10 + `eslint-plugin-import-x` 4.17.1**, flat config `eslint.config.js`,
      rules limited to `import/no-unresolved`, `no-undef`, `no-unused-vars`. Sanity-check that
      `wxt/sandbox` *fails* and `#imports` *passes* (the resolver must honour package `exports`).
      Auto-imports: set `imports: { eslintrc: { enabled: true } }` in `wxt.config.js` so WXT emits
      `.wxt/eslint-auto-imports.json`, and wire it into `languageOptions.globals`.
- [ ] **Option B — `dependency-cruiser` 18.6.0** with just `no-orphans` + `unknown-dependencies`
      + a `forbidden` rule for `wxt/sandbox`. Less tooling to explain to contributors, no
      `no-undef` coverage.
- [ ] keep the script named `lint` (README already tells people to run it)
- [ ] do **not** add stylistic rules — prettier owns those
- [ ] commit

### M5 — JS static checking, invisible to contributors

- [ ] `npm i -D typescript@^7.0.2` (WXT 0.21 declares `typescript >=5.4` as an optional peer).
      If TS 7 is too aggressive to get to green quickly, drop to `^6`/`^5.9` and write the reason
      in the Progress log.
- [ ] replace `jsconfig.json` with the generated config as the base (aliases + `#imports` types):

      ```json
      {
        "extends": "./.wxt/tsconfig.json",
        "compilerOptions": { "checkJs": false, "jsx": "react-jsx" }
      }
      ```

      Note in a comment-free JSON-safe way (or in the Progress log) that `npm ci`/`wxt prepare`
      must have run, since `.wxt/` is gitignored.
- [ ] script `"check": "tsc --noEmit -p jsconfig.json"`. Keep the name `check`; do not add
      "typecheck"/"compile" scripts that advertise TypeScript.
- [ ] add `// @ts-check` to the top of `src/Content.js` and both new adapters; run
      `npm run check`; triage the errors.
- [ ] fix the Closure-dialect JSDoc that TypeScript rejects (TS 7 reworked how JSDoc'd JS is
      analysed; `*` wildcards and `@enum` are the two big ones in this repo):
      - `Record<string, *>` → `Record<string, any>` at `src/Client.js:263`,
        `src/Content.js:330`, `src/downloader/SABnzbd.js:32`, `src/downloader/index.js:247,273`,
        `src/utils.js:74,101`
      - `{*[]}` → `{any[]}` at `src/downloader/NZBGet.js:32`, `src/logger.js:73`;
        `{...*}` → `{...any}` at `src/logger.js:41,117,144,152,160,168`
      - `Promise<*>` → `Promise<any>` at `src/utils.js:101`
      - `/** @enum {…} */` at `src/downloader/index.js:6,17` and `src/store.js:10` → either
        plain `@type` annotations on a frozen object, or a
        `@typedef {(typeof X)[keyof typeof X]}` alias
- [ ] leave `checkJs: false` in the config so files opt in individually and CI can never block a
      contributor who never touched an opted-in file
- [ ] commit
- [ ] *(later, one commit per module, only if the above is cheap)* add `// @ts-check` to
      `store.js`, `utils.js`, `logger.js`, `Client.js`, `downloader/*.js`, then the remaining
      adapters

### M6 — Optional behaviour-neutral cleanups (only once M1–M5 are green)

- [ ] amenzb: delete the private `apiKey` field and use the base class (`src/Content.js`
      L63 `_apikey = ''`, L65 `get apikey()`), assigning `this._apikey = input.value` in `ready()`
- [ ] amenzb: replace the raw `console.info` with `this.debug('[NZB Unity] ameNZB ready()', { apikey: this.apikey })`
      plus a warn when the key is missing — the pattern used by abnzb (`src/entrypoints/abnzb.content.js:43-48`),
      dognzb, newznab, drunkenslug, gingadaddy
- [ ] amenzb: consider `window.location.origin` instead of the hardcoded `https://amenzb.moe` in
      `buildApiUrl()` (the `ready()` fetch hardcodes the same host) — **needs owner OK**
- [ ] do **not** change the `credentials: 'include'` cross-origin fetch without owner sign-off;
      it is intentional and only smoke-testable with a logged-in amenzb account
- [ ] commit

### M7 — Docs that currently teach the broken pattern

All line numbers are from `README.md` at `9b23c50`.

- [ ] L87 `built primarily in TypeScript and SASS, using a Gulp build process` → JavaScript +
      WXT (Gulp is gone)
- [ ] L109 `public/` is listed under `src/` but was moved to the repo root in `1a4bcbd`
- [ ] L114 `add a <sitename>.content.ts file` → `.content.js`; the cited examples
      `omgwtfnzbs.content.ts` / `dognzb.content.ts` / `Content.ts` don't exist on this branch →
      cite `aninzb.content.js` (smallest) and `dognzb.content.js`, and `Content.js`
- [ ] L116 `src/store.ts` → `src/store.js`
- [ ] L120-121 the ```typescript fence and `from 'wxt/sandbox'` → ```javascript and `from '#imports'`
- [ ] `src/store.js:88` comment "The keys match the names of entrypoints/\*.content.ts" → `.content.js`
- [ ] `.gitignore` L7 `web-ext.config.ts` — the tracked file is `web-ext.config.js`, so this line
      is stale: fix or delete it (do not start ignoring the `.js` config)
- [ ] add one short "adding a site adapter" pointer that mentions `npm run check` exists and runs
      in CI — without naming TypeScript
- [ ] commit

### M8 — Dependency refresh (one commit per tier; see §5 for numbers and dates)

- [ ] **WXT 0.20.20 → 0.21.4.** Breaking items that touch this repo: `vite` is now a **required**
      peer → add `vite@^8.3.4` to devDependencies; `web-ext` is an **optional** peer → add it
      (this repo has `web-ext.config.js` with Chromium/Firefox-DE binaries, so `npm run dev`
      relies on it); the `wxt/testing` barrel is gone → `vitest.config.js` imports
      `wxt/testing/vitest-plugin` and `src/entrypoints/__tests__/example.skip.js` imports
      `wxt/testing/fake-browser`; generated `.wxt/tsconfig.json` gains stricter options
      (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`) — expect noise in `checkJs` files.
      Node ≥22 required; `.nvmrc` is already 24.
- [ ] routine minors, safe: `react`/`react-dom` 19.2.4 → 19.3.1, `react-icons` 5.6.0 → 5.7.0
      (`@wxt-dev/module-react` 1.2.2 is already current)
- [ ] `happy-dom` 20.8.8 → 21.0.3: v21 disables CSS and iframe loading by default and deprecates
      `disableCSSFileLoading`; verify `vitest.setup.js` (`happyDOM.settings.fetch.disableSameOriginPolicy`)
      still behaves and that no test depended on CSS being parsed
- [ ] `vitest` 4.1.2 → 5.0.5 **in the same commit as WXT 0.21** so the `WxtVitest` pairing is
      exercised once. If WXT's vitest plugin doesn't support vitest 5 yet, pin `^4.1.12` and note it
- [ ] `react-tooltip` 5.30.0 → 6.0.9 — **last, and only with owner OK.** v6 removed the raw-HTML
      string API, and this repo uses `data-tooltip-html` with nested `<span>`/`<p>` markup in
      `src/entrypoints/options/DownloaderForm.jsx` at L153, 195, 229, 250, 265, 282 (and more).
      Also `src/assets/tooltip.css:1` imports `react-tooltip/dist/react-tooltip.css` and L36-58
      override `.react-tooltip-arrow`, `.react-tooltip__place-top`, `.react-tooltip__place-bottom`
      — verify the CSS entry path and class names against v6 markup before merging
- [ ] land the M3–M5 devDependencies as explicit pins in `package.json`
- [ ] `npm audit` (last run on this branch: 2026-03-27 in `8bd61a6`); record output
- [ ] `.nvmrc` stays 24 here; `main` still says 22 → harmonize during the M9 merge decision
- [ ] Dependabot: ~15 open branches, all lockfile-only and 12–23 commits stale (several target the
      old Gulp-era tree). After this tier, close the obsolete ones so the repo doesn't look
      abandoned to a would-be contributor

### M9 — Final pass, merge decision, cleanup

- [ ] green run of: `npm ci && npm run check && npm run lint && npm run format:check && npm run test && npm run build:all`
- [ ] manual smoke in a real browser (needs accounts; record what you could and could not test):
      amenzb logged-in `/profile` actually yields `apiKeyInput` → links get API URLs;
      aninzb list **and** detail pages, with `replaceLinks` on and off; abnzb still fine;
      the built chrome-mv3 and firefox packages load
- [ ] **owner decision:** port the same two-adapter fix onto `main` as well, or merge `2.2` into
      `main` now. `main` is only one commit ahead of the merge-base (the 2.2.0 version bump), so
      closing the loop is cheap today and gets more expensive with every site profile added on
      either side.
- [ ] `git push -u origin 2.2-js` — only after the owner is happy with the branch
- [ ] `git rm PLAN.md && git commit -m "[2.2] remove PLAN.md, JS conversion complete"`
- [ ] from the main checkout: `git worktree remove /home/hutch/Projects/nzbunity-2.2-js`
      (keep it until the PR/merge is settled)

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

No OSV advisory currently affects any pinned direct dependency, so nothing here is forced by a
security problem. Only two majors require source work: WXT 0.21 and react-tooltip 6.

| package | pinned on 2.2 | latest seen | action |
| --- | --- | --- | --- |
| `wxt` | 0.20.20 | **0.21.4** (2026-08-11) | major, required — see M8 |
| `@wxt-dev/module-react` | 1.2.2 | 1.2.2 | current |
| `react`, `react-dom` | 19.2.4 | 19.3.1 (2026-10-14) | minor bump |
| `react-icons` | 5.6.0 | 5.7.0 | minor bump |
| `react-tooltip` | 5.30.0 | **6.0.9** | major, needs `data-tooltip-html` migration |
| `happy-dom` | 20.8.8 | **21.0.3** | major, CSS/iframe loading off by default |
| `vitest` | 4.1.2 | **5.0.5** (2026-10-15) | major, couple it to the WXT bump |
| `vite` | 8.0.3 (transitive) | 8.3.4 | becomes a direct devDep with WXT 0.21 |
| `typescript` | absent | 7.0.2 (2026-07-08) | new devDep, checker only (M5) |
| `prettier` | absent (config only) | 3.9.10 | new devDep (M3) |
| `eslint` / `eslint-plugin-import-x` | absent | 10.13.0 / 4.17.1 | new devDep (M4, option A) |
| `@types/react`, `@types/react-dom` | absent | 19.3.0 | only if JSX files opt into `@ts-check` |
| `web-ext` | absent | ≥9.2.0 | add as devDep if WXT 0.21 is used with `web-ext.config.js` |

## 6. Gotchas

* `node_modules` is per-worktree — `npm ci` again here, not in the main checkout.
* `.wxt/` is generated and gitignored: anything that reads `.wxt/tsconfig.json` or the
  auto-import globals file needs `wxt prepare` to have run (`npm ci` does it via `postinstall`).
* `#imports` is the convention across all converted entrypoints; keep it, don't "modernize" to
  `wxt/utils/define-content-script` inside a mechanical port.
* amenzb's file has no trailing newline today; prettier will add one — expected diff noise.
* The two leftover `.ts` files came from merges of `main`, so M2 (guards) + M9 (merge decision)
  are what actually stop this recurring. The port alone does not.
* `npm test` passing says nothing about adapter correctness — there is no adapter test.
* WXT docs: <https://wxt.dev/guide/resources/upgrading.html> (0.20→0.21 breaking list).
* react-tooltip v5→v6: <https://react-tooltip.com/docs/upgrade-guide/changelog-v5-v6>.

## 7. Explicitly out of scope

Rewriting the React UI to anything else, chasing WXT beyond 0.21, a big lint ruleset, converting
tests to a typed flavour, CI/workflow redesign, and any behaviour change not listed in M6.

---

## Progress log (append newest first)

* **2026-10-19** — `PLAN.md` written. Worktree `/home/hutch/Projects/nzbunity-2.2-js` created on
  branch `2.2-js` from `origin/2.2` (`9b23c50`). No source files touched yet. Verified in the
  worktree: 2 remaining `.ts` files (amenzb, aninzb), 15 `.content.js` adapters,
  `DefaultIndexers` already lists `amenzb` (store.js:92) and `aninzb` (store.js:94), README stale
  lines at 87/109/114/116/120-121, `jsconfig.json` does not extend `.wxt/tsconfig.json`,
  `.gitignore:7` stale, `lint` script is a placeholder, `.nvmrc` = 24.
