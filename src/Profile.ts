import { NZBHost } from './nzb/NZBHost';

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
