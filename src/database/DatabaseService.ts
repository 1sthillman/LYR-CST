import { Song, Performance } from '../types';

/**
 * IndexedDB veritabanı servisi
 * Web uygulaması için IndexedDB kullanır (sql.js yerine)
 */
class DatabaseService {
  private dbName: string = 'karaoke_db';
  private dbVersion: number = 1;
  private db: IDBDatabase | null = null;
  private isInitialized: boolean = false;

  /**
   * Veritabanını başlatır
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('IndexedDB açılamadı:', request.error);
        reject(new Error('Veritabanı başlatılamadı'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Songs tablosu
        if (!db.objectStoreNames.contains('songs')) {
          const songsStore = db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
          songsStore.createIndex('title', 'title', { unique: false });
          songsStore.createIndex('artist', 'artist', { unique: false });
          songsStore.createIndex('created_at', 'created_at', { unique: false });
        }

        // Performances tablosu
        if (!db.objectStoreNames.contains('performances')) {
          const performancesStore = db.createObjectStore('performances', { keyPath: 'id', autoIncrement: true });
          performancesStore.createIndex('song_id', 'song_id', { unique: false });
          performancesStore.createIndex('recorded_at', 'recorded_at', { unique: false });
        }

        // Error logs tablosu
        if (!db.objectStoreNames.contains('error_logs')) {
          const errorLogsStore = db.createObjectStore('error_logs', { keyPath: 'id', autoIncrement: true });
          errorLogsStore.createIndex('error_code', 'error_code', { unique: false });
          errorLogsStore.createIndex('created_at', 'created_at', { unique: false });
        }
      };
    });
  }

  /**
   * Şarkı ekler
   */
  async addSong(
    title: string, 
    artist: string, 
    lyrics: string,
    audioFilePath?: string | null,
    audioFileName?: string | null,
    duration?: number
  ): Promise<number> {
    if (!this.db) throw new Error('Veritabanı başlatılmamış');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['songs'], 'readwrite');
      const store = transaction.objectStore('songs');
      
      const song: Omit<Song, 'id'> = {
        title,
        artist,
        lyrics,
        audio_file_path: audioFilePath || null,
        audio_file_name: audioFileName || null,
        duration: duration || 0,
        volume_level: 1.0,
        created_at: new Date().toISOString()
      };

      const request = store.add(song);

      request.onsuccess = () => {
        resolve(request.result as number);
      };

      request.onerror = () => {
        reject(new Error('Şarkı eklenemedi'));
      };
    });
  }

  /**
   * Tüm şarkıları getirir
   */
  async getAllSongs(): Promise<Song[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['songs'], 'readonly');
      const store = transaction.objectStore('songs');
      const index = store.index('created_at');
      const request = index.openCursor(null, 'prev'); // DESC sıralama

      const songs: Song[] = [];

      request.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          songs.push(cursor.value as Song);
          cursor.continue();
        } else {
          resolve(songs);
        }
      };

      request.onerror = () => {
        reject(new Error('Şarkılar getirilemedi'));
      };
    });
  }

  /**
   * ID'ye göre şarkı getirir
   */
  async getSongById(id: number): Promise<Song | undefined> {
    if (!this.db) return undefined;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['songs'], 'readonly');
      const store = transaction.objectStore('songs');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result as Song | undefined);
      };

      request.onerror = () => {
        reject(new Error('Şarkı getirilemedi'));
      };
    });
  }

  /**
   * Performans kaydeder
   */
  async savePerformance(songId: number, accuracy: number, duration: number): Promise<void> {
    if (!this.db) throw new Error('Veritabanı başlatılmamış');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['performances'], 'readwrite');
      const store = transaction.objectStore('performances');
      
      const performance: Omit<Performance, 'id'> = {
        song_id: songId,
        accuracy,
        duration,
        recorded_at: new Date().toISOString()
      };

      const request = store.add(performance);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Performans kaydedilemedi'));
      };
    });
  }

  /**
   * Şarkı performanslarını getirir
   */
  async getPerformances(songId: number): Promise<Performance[]> {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['performances'], 'readonly');
      const store = transaction.objectStore('performances');
      const index = store.index('song_id');
      const request = index.getAll(songId);

      request.onsuccess = () => {
        const performances = request.result as Performance[];
        // recorded_at'e göre DESC sıralama
        performances.sort((a, b) => 
          new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
        );
        resolve(performances);
      };

      request.onerror = () => {
        reject(new Error('Performanslar getirilemedi'));
      };
    });
  }

  /**
   * Hata kaydeder
   */
  logError(errorCode: string, errorMessage: string, stackTrace?: string): void {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(['error_logs'], 'readwrite');
      const store = transaction.objectStore('error_logs');
      
      const errorLog = {
        error_code: errorCode,
        error_message: errorMessage,
        stack_trace: stackTrace || '',
        created_at: new Date().toISOString()
      };

      store.add(errorLog);
    } catch (error) {
      console.error('Hata kaydedilemedi:', error);
    }
  }
}

export default new DatabaseService();
