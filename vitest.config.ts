// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    setupFiles: ['vitest.setup.ts'],
    environment: 'happy-dom',
  },
});