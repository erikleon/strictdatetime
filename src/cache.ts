export class LruCache<K, V> {
  readonly capacity: number;
  readonly #values = new Map<K, V>();

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    const value = this.#values.get(key);
    if (value === undefined) return undefined;
    this.#values.delete(key);
    this.#values.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    this.#values.delete(key);
    this.#values.set(key, value);
    if (this.#values.size > this.capacity) {
      const oldest = this.#values.keys().next().value;
      this.#values.delete(oldest as K);
    }
  }

  get size(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }
}

export const intlFormatterCache = new LruCache<string, Intl.DateTimeFormat>(128);
