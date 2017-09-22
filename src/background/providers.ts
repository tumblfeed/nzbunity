const Providers:Object = {
  animenzb: {
    matches: [
      '*://animenzb.com/*',
      '*://*.animenzb.com/*'
    ],
    include: ['sites/animenzb.js']
  },
  animezb: {
    matches: ['*://*.animezb.com/*'],
    include: ['sites/animezb.js']
  },
  binsearch: {
    displayAvailable: true,
    matches: [
      '*://*.binsearch.info/*',
      '*://*.binsearch.net/*',
      '*://*.binsearch.co.uk/*',
      '*://*.binsear.ch/*'
    ],
    include: ['sites/binsearch.js']
  },
  bintube: {
    matches: ['*://*.bintube.com/*'],
    include: ['sites/bintube.js']
  },
  dognzb: {
    matches: ['*://*.dognzb.cr/*'],
    include: ['sites/dognzb.js']
  },
  fanzub: {
    matches: ['*://*.fanzub.com/*'],
    include: ['sites/fanzub.js']
  },
  nzbclub: {
    matches: ['*://*.nzbclub.com/*'],
    include: ['sites/nzbclub.js']
  },
  nzbindex: {
    displayAvailable: true,
    matches: [
      '*://*.nzbindex.com/*',
      '*://*.nzbindex.nl/*'
    ],
    include: ['sites/nzbindex.js']
  },
  nzbrss: {
    matches: ['*://*.nzb-rss.com/*'],
    include: ['sites/nzbrss.js']
  },
  omgwtfnzbs: {
    matches: ['*://*.omgwtfnzbs.me/*'],
    include: ['sites/omgwtfnzbs.js']
  },
  usenet4ever: {
    matches: ['*://*.usenet4ever.info/*'],
    include: ['sites/nzbclub.js']
  },
  yubse: {
    displayAvailable: true,
    matches: ['*://*.yubse.com/*'],
    include: ['sites/yubse.js']
  }
};
