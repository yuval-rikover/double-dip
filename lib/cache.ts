/** Batched key-value storage, backed by `storage.local` in the background. */
export interface KeyValueCache<V> {
  get(keys: string[]): Promise<Record<string, V | undefined>>;
  set(entries: Record<string, V>): Promise<void>;
}
