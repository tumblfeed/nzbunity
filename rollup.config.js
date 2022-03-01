import path from 'path';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';

import { chromeExtension, simpleReloader } from 'rollup-plugin-chrome-extension';
import { emptyDir } from 'rollup-plugin-empty-dir';
import postcss from 'rollup-plugin-postcss';
import zip from 'rollup-plugin-zip';

const isProduction = /^prod/i.test(process.env.NODE_ENV);

export default {
  input: 'src/manifest.json',
  output: {
    dir: 'dist',
    format: 'esm',
    chunkFileNames: path.join('chunks', '[name]-[hash].js'),
  },
  plugins: [
    replace({
      'process.env.NODE_ENV': isProduction ? `'production'` : `'development'`,
      preventAssignment: true,
    }),
    chromeExtension(),
    simpleReloader(),
    resolve(),
    commonjs(),
    typescript(),
    postcss({
      // extract: true,
      plugins: [],
    }),
    emptyDir(),
    isProduction && zip({ dir: 'releases' }),
  ],
};
