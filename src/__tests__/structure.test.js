import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DefaultIndexers } from '../store.js';

// These tests guard the shape of the source tree rather than its behaviour.
// They exist because the TypeScript -> JavaScript conversion silently regressed
// when newer site profiles arrived from main: the leftover .ts entrypoints were
// invisible until the build (and even `npm ci`) stopped working.

const srcDir = path.resolve(fileURLToPath(import.meta.url), '../..');
const entrypointsDir = path.join(srcDir, 'entrypoints');

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const allFiles = walk(srcDir);
const jsFiles = allFiles.filter((file) => /\.(js|jsx)$/.test(file));

describe('source tree structure', () => {
  it('keeps every source file in JavaScript', () => {
    const typed = allFiles
      .filter((file) => /\.(ts|tsx|mts|cts)$/.test(file))
      .map((file) => path.relative(srcDir, file));

    // The project is JavaScript on purpose: contributors add site adapters
    // without needing TypeScript. Anything that needs a checker opts in per
    // file with `// @ts-check`.
    expect(typed).toEqual([]);
  });

  it('has a content-script entrypoint for every default indexer', () => {
    const adapters = readdirSync(entrypointsDir)
      .filter((file) => file.endsWith('.content.js'))
      .map((file) => file.replace(/\.content\.js$/, ''));

    const missing = Object.keys(DefaultIndexers).filter((key) => !adapters.includes(key));
    expect(missing).toEqual([]);
  });

  it('registers an indexer setting for every content-script entrypoint', () => {
    const adapters = readdirSync(entrypointsDir)
      .filter((file) => file.endsWith('.content.js'))
      .map((file) => file.replace(/\.content\.js$/, ''));

    // newznab is one adapter shared by all newznab-style sites and is switched
    // by the EnableNewznab option, so it has no DefaultIndexers key of its own.
    const sharedAdapters = ['newznab'];
    const unlisted = adapters.filter(
      (name) => !(name in DefaultIndexers) && !sharedAdapters.includes(name),
    );
    expect(unlisted).toEqual([]);
  });

  it('only imports wxt subpaths that the installed wxt actually exports', () => {
    const pkgPath = path.resolve(srcDir, '../node_modules/wxt/package.json');
    const { exports: wxtExports } = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const specifier = /(?:from|import)\s*\(?\s*['"](wxt(?:\/[^'"]*)?)['"]/g;

    const unresolved = [];
    for (const file of jsFiles) {
      for (const match of readFileSync(file, 'utf8').matchAll(specifier)) {
        const subpath = match[1] === 'wxt' ? '.' : `./${match[1].slice('wxt/'.length)}`;
        if (!(subpath in wxtExports)) {
          unresolved.push(`${path.relative(srcDir, file)} -> ${match[1]}`);
        }
      }
    }

    // WXT has removed subpath exports before (wxt/sandbox in 0.20, wxt/testing
    // in 0.21) and the failure is a hard build error, so catch it here instead.
    expect(unresolved).toEqual([]);
  });
});
