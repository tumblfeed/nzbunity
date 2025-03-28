import { defineContentScript } from 'wxt/sandbox';
import { Content } from '~/Content';

export default defineContentScript({
  matches: ['*://*.omgwtfnzbs.org/*'],

  main(ctx) {
    new OmgwtfnzbsContent(ctx);
  },
});

class OmgwtfnzbsContent extends Content {
  get isDetail(): boolean {
    return false;
  }

  get isList(): boolean {
    return false;
  }

  get uid(): string {
    return '';
  }

  get apikey(): string {
    return '';
  }

  getNzbUrl(id: string): string {
    return id;
  }

  async ready() {
    // warn on missing parms
    this.debug(`[NZB Unity] ready()`, { uid: this.uid, apikey: this.apikey });
    if (!this.uid) console.warn(`[NZB Unity] Unable to find username`);
    if (!this.apikey) console.warn(`[NZB Unity] Unable to find apikey`);
  }

  initializeDetailLinks = () => {
    this.debug(`[NZB Unity] initializeDetailLinks()`);
  };

  initializeListLinks = () => {
    this.debug(`[NZB Unity] initializeListLinks()`);
  };
}
