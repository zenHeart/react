import { LRU } from './LRU'
export class WithCache {
  constructor(maxCacheLen = 20) {
    this.lru = new Cache()
  }
}