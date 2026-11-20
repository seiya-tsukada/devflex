import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Minimal key-value persistence used by the API.
 *
 * Local development persists to a JSON file under `.data/`. Serverless platforms such
 * as Vercel have a read-only, per-instance filesystem, so there the store is kept in
 * memory: data survives only while a function instance stays warm. To persist data on
 * Vercel later, add another KeyValueStore implementation (e.g. a managed database)
 * and select it in createStore().
 */
export interface KeyValueStore {
  readonly kind: 'file' | 'memory';
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ttlSec?: number }): Promise<void>;
  del(key: string): Promise<void>;
}

interface StoredEntry {
  value: unknown;
  expiresAt: number | null;
}

class MemoryStore implements KeyValueStore {
  readonly kind: 'file' | 'memory' = 'memory';
  protected entries = new Map<string, StoredEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    // Clone so callers never mutate the stored copy without calling set().
    return structuredClone(entry.value) as T;
  }

  async set(key: string, value: unknown, options?: { ttlSec?: number }): Promise<void> {
    this.entries.set(key, {
      value: structuredClone(value),
      expiresAt: options?.ttlSec ? Date.now() + options.ttlSec * 1000 : null,
    });
    this.persist();
  }

  async del(key: string): Promise<void> {
    this.entries.delete(key);
    this.persist();
  }

  protected persist(): void {}
}

class FileStore extends MemoryStore {
  override readonly kind = 'file';
  private readonly filePath: string;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, StoredEntry>;
      this.entries = new Map(Object.entries(raw));
    } catch {
      // Missing or unreadable file: start empty (seed data is created lazily).
    }
  }

  protected override persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(Object.fromEntries(this.entries), null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }
}

function createStore(): KeyValueStore {
  if (process.env.VERCEL) {
    console.warn(
      '[storage] Running on Vercel with in-memory storage: ' +
        'data is lost whenever the function instance is recycled.',
    );
    return new MemoryStore();
  }
  return new FileStore(path.resolve(process.cwd(), '.data', 'kv-store.json'));
}

export const kvStore: KeyValueStore = createStore();
