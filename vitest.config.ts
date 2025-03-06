// vitest.config.ts
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    setupFiles: ['vitest.setup.ts'],
    environment: 'happy-dom',
    env: loadEnv('test', process.cwd(), ['VITE_', 'WXT_']),
  },
});