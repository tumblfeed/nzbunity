import { NZBHost } from './NZBHost/NZBHost.js';

export class Profile {
  #name: string;
  #host: NZBHost;

  constructor(name: string = null) {
    this.#name = name;
  }

  get name(): string {
    return this.#name;
  }
}
