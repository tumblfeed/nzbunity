import { Downloader } from './downloader';

export class Profile {
  #name: string;
  #host: Downloader;

  constructor(name: string = null) {
    this.#name = name;
  }

  get name(): string {
    return this.#name;
  }
}
