import { describe, it, expect, vi, beforeEach } from 'vitest';
import background from '../background';
import { fakeBrowser } from 'wxt/testing';
describe('Background Entrypoint', () => {
  beforeEach(() => {
    // Reset the in-memory state, including storage
    fakeBrowser.reset();
  });
  it('should store the current date on install', async () => {
    const expected = '2023-12-22T15:27:25.950Z';
    vi.setSystemTime(expected);
    background.main();
    await fakeBrowser.runtime.onInstalled.trigger({
      reason: 'install',
      temporary: false,
    });
    const actual = await storage.getItem('local:installDate');
    expect(actual).toBe(expected);
  });
  it.each([
    browser.runtime.OnInstalledReason.UPDATE,
    browser.runtime.OnInstalledReason.CHROME_UPDATE,
  ])('should not store the current date on %s', async (reason) => {
    const previous = '2023-12-22T15:27:25.950Z';
    await storage.setItem('local:installDate', previous);
    background.main();
    await fakeBrowser.runtime.onInstalled.trigger({
      reason,
      temporary: false,
    });
    const actual = await storage.getItem('local:installDate');
    expect(actual).toBe(previous);
  });
});
