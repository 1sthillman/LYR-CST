/**
 * Media Service - Müzik Dosyası Yükleme Servisi
 * Web ve Android için uyumlu müzik dosyası yönetimi
 */
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { isAndroid } from '../utils/platform';

export interface MusicFile {
  uri: string;
  name: string;
  duration: number; // seconds
  size: number; // bytes
  mimeType: string;
}

export class MediaService {
  private static readonly MUSIC_DIR = 'Music/Karaoke';

  /**
   * Müzik dosyası seç (Web ve Android için)
   */
  async pickMusicFile(): Promise<MusicFile | null> {
    try {
      // Android için özel işlem
      if (isAndroid()) {
        return await this.pickMusicFileAndroid();
      }

      // Web için standart file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.multiple = false;

      return new Promise((resolve) => {
        input.onchange = async (event: any) => {
          const file = event.target.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }

          // Dosyayı oku ve URI oluştur
          const fileUri = URL.createObjectURL(file);
          
          const musicFile: MusicFile = {
            uri: fileUri,
            name: file.name,
            duration: 0, // Audio element ile alınabilir
            size: file.size,
            mimeType: file.type,
          };

          resolve(musicFile);
        };
        input.click();
      });
    } catch (error) {
      console.error('Müzik dosyası seçme hatası:', error);
      throw new Error('Dosya seçilemedi');
    }
  }

  /**
   * Android için müzik dosyası seç
   */
  private async pickMusicFileAndroid(): Promise<MusicFile | null> {
    try {
      // Dosya seçici aç (Android'de de HTML input kullanılabilir)
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.multiple = false;

      return new Promise((resolve) => {
        input.onchange = async (event: any) => {
          const file = event.target.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }

          // Android'de dosyayı app dizinine kopyala
          const fileUri = await this.copyFileToAppDirectory(file);
          
          const musicFile: MusicFile = {
            uri: fileUri,
            name: file.name,
            duration: 0,
            size: file.size,
            mimeType: file.type,
          };

          resolve(musicFile);
        };
        input.click();
      });
    } catch (error) {
      console.error('Android müzik dosyası seçme hatası:', error);
      throw new Error('Dosya seçilemedi');
    }
  }

  /**
   * Dosyayı uygulama dizinine kopyala (Android)
   */
  private async copyFileToAppDirectory(file: File): Promise<string> {
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${MediaService.MUSIC_DIR}/${fileName}`;

      // Dizin oluştur
      await Filesystem.mkdir({
        path: MediaService.MUSIC_DIR,
        directory: Directory.Data,
        recursive: true,
      });

      // FileReader ile oku
      const base64Data = await this.fileToBase64(file);
      
      // Dosyayı kaydet
      await Filesystem.writeFile({
        path: filePath,
        data: base64Data,
        directory: Directory.Data,
        encoding: Encoding.UTF8,
      });

      // URI al
      const result = await Filesystem.getUri({
        directory: Directory.Data,
        path: filePath,
      });

      return result.uri;
    } catch (error) {
      console.error('Dosya kopyalama hatası:', error);
      throw new Error('Dosya kaydedilemedi');
    }
  }

  /**
   * File → Base64 dönüşümü
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Ses dosyasının süresini al
   */
  async getAudioDuration(fileUri: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(fileUri);
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
      });
      audio.addEventListener('error', () => {
        reject(new Error('Ses dosyası yüklenemedi'));
      });
    });
  }

  /**
   * Dosya var mı kontrol et
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      if (isAndroid() && filePath.startsWith('file://')) {
        // Android için Capacitor Filesystem kontrolü
        try {
          await Filesystem.stat({
            path: filePath.replace('file://', ''),
            directory: Directory.Data,
          });
          return true;
        } catch {
          return false;
        }
      }
      
      // Web için fetch kontrolü
      const response = await fetch(filePath, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const mediaService = new MediaService();
