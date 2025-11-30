/**
 * IndexedDB Cache Sistemi - Ultra Hızlı Yükleme
 * Şarkı sözlerini önbellekler, tekrar işlemez
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class LyricsCache {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'KaraokeCache_v2';
  private readonly STORE_NAME = 'lyrics';
  private readonly TTL = 24 * 60 * 60 * 1000; // 24 saat

  /**
   * Cache'i başlat
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Cache'e kaydet
   */
  async set<T>(key: string, data: T): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) throw new Error('Cache not initialized');

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: this.TTL,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put({ id: key, ...entry });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cache'den oku
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as (CacheEntry<T> & { id: string }) | undefined;
        
        if (!entry) {
          resolve(null);
          return;
        }

        const isExpired = Date.now() - entry.timestamp > entry.ttl;
        if (isExpired) {
          this.delete(key);
          resolve(null);
          return;
        }

        resolve(entry.data);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cache'den sil
   */
  async delete(key: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Tüm cache'i temizle
   */
  async clear(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const lyricsCache = new LyricsCache();


