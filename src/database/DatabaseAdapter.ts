/**
 * Database Adapter - Platform Detection ile Web/Android Desteği
 * Web için IndexedDB, Android için Capacitor SQLite kullanır
 */
import DatabaseService from './DatabaseService';
import { capacitorDbService as capacitorDbService } from './CapacitorDatabaseService';
import { isAndroid } from '../utils/platform';
import type { Song, Performance } from '../types';

class DatabaseAdapter {
  /**
   * Veritabanını başlat
   */
  async initialize(): Promise<void> {
    if (isAndroid()) {
      await capacitorDbService.initialize();
    } else {
      await DatabaseService.initialize();
    }
  }

  /**
   * Şarkı ekle
   */
  async addSong(
    title: string,
    artist: string,
    lyrics: string,
    audioFilePath?: string | null,
    audioFileName?: string | null,
    duration?: number
  ): Promise<number> {
    if (isAndroid()) {
      return await capacitorDbService.addSong(
        title,
        artist,
        lyrics,
        audioFilePath,
        audioFileName,
        duration
      );
    } else {
      return await DatabaseService.addSong(
        title,
        artist,
        lyrics,
        audioFilePath,
        audioFileName,
        duration
      );
    }
  }

  /**
   * Tüm şarkıları getir
   */
  async getAllSongs(): Promise<Song[]> {
    if (isAndroid()) {
      return await capacitorDbService.getAllSongs();
    } else {
      return await DatabaseService.getAllSongs();
    }
  }

  /**
   * Şarkıyı ID ile getir
   */
  async getSongById(id: number): Promise<Song | undefined> {
    if (isAndroid()) {
      return await capacitorDbService.getSongById(id);
    } else {
      return await DatabaseService.getSongById(id);
    }
  }

  /**
   * Performans kaydet
   */
  async savePerformance(songId: number, accuracy: number, duration: number): Promise<void> {
    if (isAndroid()) {
      await capacitorDbService.savePerformance(songId, accuracy, duration);
    } else {
      await DatabaseService.savePerformance(songId, accuracy, duration);
    }
  }

  /**
   * Performansları getir
   */
  async getPerformances(songId: number): Promise<Performance[]> {
    if (isAndroid()) {
      return await capacitorDbService.getPerformances(songId);
    } else {
      return await DatabaseService.getPerformances(songId);
    }
  }

  /**
   * Şarkının ses seviyesini güncelle (Android için)
   */
  async updateSongVolume(songId: number, volumeLevel: number): Promise<void> {
    if (isAndroid()) {
      await capacitorDbService.updateSongVolume(songId, volumeLevel);
    }
    // Web için IndexedDB'de volume_level alanı yok, gerekirse eklenebilir
  }

  /**
   * Hata kaydet
   */
  logError(errorCode: string, errorMessage: string, stackTrace?: string): void {
    // Web için DatabaseService.logError kullan
    if (!isAndroid()) {
      DatabaseService.logError(errorCode, errorMessage, stackTrace);
    }
    // Android için loglama gerekirse eklenebilir
  }
}

// Singleton instance
export const dbAdapter = new DatabaseAdapter();

