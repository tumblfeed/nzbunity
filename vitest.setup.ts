import content from "@/entrypoints/content";

Object.defineProperty(browser.runtime, 'getManifest', {
  value: () => ({
    version: '2.0.0-test.0',
    content_scripts: [
      {
        "matches": ["*://*.althub.co.za/*"],
        "js": ["sites/althub.ts"]
      },
      {
        "matches": ["*://*.lol.lmao/*"],
        "js": ["sites/lol.ts"]
      },
    ],
}),
});