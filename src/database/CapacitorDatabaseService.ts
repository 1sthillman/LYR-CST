/**
 * Capacitor SQLite Database Service
 * Android için native SQLite kullanır
 */
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { Song, Performance } from '../types';

class CapacitorDatabaseService {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;
  private isInitialized = false;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  /**
   * Veritabanını başlat ve bağlantıyı kur
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Veritabanı bağlantı kontrolü
      const result = await this.sqlite.checkConnectionsConsistency();
      const isConnected = await this.sqlite.isConnection('karaoke', false);

      if (result.result && isConnected.result) {
        this.db = await this.sqlite.retrieveConnection('karaoke', false);
      } else {
        this.db = await this.sqlite.createConnection(
          'karaoke',
          false,
          'no-encryption',
          1,
          false
        );
      }

      await this.db.open();
      await this.createTables();
      this.isInitialized = true;
      console.log('✅ SQLite veritabanı başarıyla başlatıldı');
    } catch (error) {
      console.error('❌ SQLite başlatma hatası:', error);
      throw new Error('Veritabanı bağlantısı kurulamadı');
    }
  }

  /**
   * Tabloları oluştur
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Veritabanı bağlantısı yok');

    const createSongsTable = `
      CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        lyrics TEXT NOT NULL,
        audio_file_path TEXT,
        audio_file_name TEXT,
        duration INTEGER DEFAULT 0,
        volume_level REAL DEFAULT 1.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createPerformancesTable = `
      CREATE TABLE IF NOT EXISTS performances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        song_id INTEGER NOT NULL,
        accuracy REAL NOT NULL,
        duration INTEGER NOT NULL,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (song_id) REFERENCES songs (id) ON DELETE CASCADE
      );
    `;

    await this.db.execute(createSongsTable);
    await this.db.execute(createPerformancesTable);
  }

  /**
   * Yeni şarkı ekle (müzik dosyası ile birlikte)
   */
  async addSong(
    title: string,
    artist: string,
    lyrics: string,
    audioFilePath?: string | null,
    audioFileName?: string | null,
    duration?: number
  ): Promise<number> {
    if (!this.db) throw new Error('Veritabanı bağlantısı yok');

    try {
      const sql = `
        INSERT INTO songs (title, artist, lyrics, audio_file_path, audio_file_name, duration)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const result = await this.db.run(sql, [
        title,
        artist,
        lyrics,
        audioFilePath || null,
        audioFileName || null,
        duration || 0,
      ]);

      return result.changes?.lastId || 0;
    } catch (error) {
      console.error('Şarkı eklenirken hata:', error);
      throw new Error('Şarkı eklenemedi');
    }
  }

  /**
   * Tüm şarkıları getir
   */
  async getAllSongs(): Promise<Song[]> {
    if (!this.db) throw new Error('Veritabanı bağlantısı yok');

    const sql = 'SELECT * FROM songs ORDER BY created_at DESC';
    const result = await this.db.query(sql);
    return (result.values || []) as Song[];
  }

  /**
   * Şarkıyı ID ile getir
   */
  async getSongById(id: number): Promise<Song | undefined> {
    if (!this.db) throw new Error('Veritabanı bağlantısı yok');

    const sql = 'SELECT * FROM songs WHERE id = ?';
    const result = await this.db.query(sql, [id]);
    return result.values?.[0] as Song | undefined;
  }

  /**
   * Şarkının ses seviyesini güncelle
   */
  async updateSongVolume(songId: number, volumeLevel: number): Promise<void> {
    if (!this.db) throw new Error('Veritabanı bağlantısı yok');

    const sql = 'UPDATE songs SET volume_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    await this.db.run(sql, [volumeLevel, songId]);
  }

  /**
   * Performans kaydet
   */
  async savePerformance(songId: number, accuracy: number, duration: number): Promise<void> {
    if (!this.db) throw new Error('Veritabanı bağlantısı yok');

    const sql = `
      INSERT INTO performances (song_id, accuracy, duration)
      VALUES (?, ?, ?)
    `;
    
    await this.db.run(sql, [songId, accuracy, duration]);
  }

  /**
   * Performansları getir
   */
  async getPerformances(songId: number): Promise<Performance[]> {
    if (!this.db) throw new Error('Veritabanı bağlantısı yok');

    const sql = 'SELECT * FROM performances WHERE song_id = ? ORDER BY recorded_at DESC';
    const result = await this.db.query(sql, [songId]);
    return (result.values || []) as Performance[];
  }

  /**
   * Bağlantıyı kapat
   */
  async closeConnection(): Promise<void> {
    if (this.db) {
      await this.db.close();
      await this.sqlite.closeConnection('karaoke', false);
      this.isInitialized = false;
    }
  }
}

// Singleton instance
export const capacitorDbService = new CapacitorDatabaseService();



