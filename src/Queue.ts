export interface QueueItem {
  id: number;
}

export class Queue {
  #items: QueueItem[];

  constructor() {
    this.#items = [];
  }
}
