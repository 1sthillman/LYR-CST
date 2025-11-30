/**
 * Audio Control Service - Ses Kontrol ve Karaoke Oynatıcı Servisi
 * Web ve Android için uyumlu ses kontrolü
 */
import { Filesystem, Directory } from '@capacitor/filesystem';
import { isAndroid } from '../utils/platform';

export interface AudioControlOptions {
  volume: number; // 0.0 - 1.0
  playbackRate: number; // 0.5 - 2.0
  isMuted: boolean;
}

export class AudioControlService {
  private audioElement: HTMLAudioElement | null = null;
  private volumeLevel: number = 1.0;
  private isMuted: boolean = false;

  /**
   * Şarkı yükle ve ses seviyesini ayarla
   * GitHub Pages blob URL sorununu çözmek için data URL kullanıyoruz
   */
  async loadSong(filePath: string): Promise<void> {
    try {
      // Eski audio element'i temizle
      if (this.audioElement) {
        this.audioElement.pause();
        // Blob URL'i revoke et (memory leak önleme)
        if (this.audioElement.src.startsWith('blob:')) {
          URL.revokeObjectURL(this.audioElement.src);
        }
        this.audioElement = null;
      }

      let audioSrc = filePath;

      // Blob URL ise (GitHub Pages'de çalışmaz) - data URL'e dönüştür
      if (filePath.startsWith('blob:')) {
        try {
          const response = await fetch(filePath);
          const blob = await response.blob();
          // Blob'u data URL'e dönüştür (GitHub Pages uyumlu)
          const reader = new FileReader();
          audioSrc = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                resolve(reader.result);
              } else {
                reject(new Error('Blob okunamadı'));
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.warn('Blob URL dönüştürme hatası, direkt kullanılıyor:', error);
        }
      }
      // Android için özel işlem
      else if (isAndroid() && filePath.startsWith('file://')) {
        // Android'de Capacitor Filesystem'den oku
        try {
          const pathWithoutPrefix = filePath.replace('file://', '');
          const fileData = await Filesystem.readFile({
            path: pathWithoutPrefix,
            directory: Directory.Data,
          });
          
          // Base64'ü data URL'e dönüştür (blob URL yerine - GitHub Pages uyumlu)
          audioSrc = `data:audio/*;base64,${fileData.data}`;
        } catch (error) {
          console.warn('Android dosya okuma hatası, direkt path kullanılıyor:', error);
        }
      }

      // Yeni audio element oluştur
      const audio = new Audio(audioSrc);
      
      // Hata yakalama
      audio.addEventListener('error', (e) => {
        console.error('❌ Audio element hatası:', e);
        console.error('Audio src:', audioSrc.substring(0, 100));
      });

      this.audioElement = audio;

      // Ses seviyesini ayarla
      audio.volume = this.isMuted ? 0 : this.volumeLevel;

      console.log('✅ Şarkı yüklendi:', filePath);
    } catch (error) {
      console.error('❌ Şarkı yükleme hatası:', error);
      throw new Error('Ses dosyası yüklenemedi: ' + (error as Error).message);
    }
  }

  /**
   * Ses seviyesini ayarla (0.0 - 1.0)
   */
  setVolume(level: number): void {
    if (!this.audioElement) return;

    // 0.0 - 1.0 arasına sınırla
    const normalizedLevel = Math.max(0, Math.min(1, level));
    this.volumeLevel = normalizedLevel;
    
    if (!this.isMuted) {
      this.audioElement.volume = normalizedLevel;
    }
    
    console.log('🔊 Ses seviyesi ayarlandı:', normalizedLevel * 100, '%');
  }

  /**
   * Ses seviyesini al
   */
  getVolume(): number {
    return this.volumeLevel;
  }

  /**
   * Oynatmayı başlat
   */
  play(): void {
    if (!this.audioElement) {
      throw new Error('Ses sistemi hazır değil');
    }

    this.audioElement.play().catch((error) => {
      console.error('Oynatma hatası:', error);
      throw new Error('Oynatma başlatılamadı');
    });
    
    console.log('▶️ Oynatma başladı');
  }

  /**
   * Oynatmayı durdur
   */
  pause(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      console.log('⏸️ Oynatma duraklatıldı');
    }
  }

  /**
   * Oynatmayı durdur ve sıfırla
   */
  stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      console.log('⏹️ Oynatma durduruldu');
    }
  }

  /**
   * Sustur/Aç
   */
  toggleMute(): void {
    if (!this.audioElement) return;
    
    this.isMuted = !this.isMuted;
    this.audioElement.volume = this.isMuted ? 0 : this.volumeLevel;
    
    console.log('🔇 Mute:', this.isMuted);
  }

  /**
   * Mute durumunu al
   */
  getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Oynatma hızını ayarla (0.5x - 2.0x)
   */
  setPlaybackRate(rate: number): void {
    if (!this.audioElement) return;
    
    const normalizedRate = Math.max(0.5, Math.min(2.0, rate));
    this.audioElement.playbackRate = normalizedRate;
    
    console.log('⚡ Oynatma hızı:', normalizedRate, 'x');
  }

  /**
   * Tüm kaynakları temizle
   */
  cleanup(): void {
    this.stop();
    
    if (this.audioElement) {
      this.audioElement = null;
    }
  }

  /**
   * Şarkının geçerli konumunu al (saniye)
   */
  getCurrentTime(): number {
    return this.audioElement?.currentTime ?? 0;
  }

  /**
   * Şarkının toplam süresini al (saniye)
   */
  getDuration(): number {
    return this.audioElement?.duration ?? 0;
  }

  /**
   * Belirli bir saniyeye git
   */
  seekTo(time: number): void {
    if (this.audioElement) {
      this.audioElement.currentTime = time;
    }
  }

  /**
   * Oynatma durumunu al
   */
  isPlaying(): boolean {
    return this.audioElement ? !this.audioElement.paused : false;
  }
}

export const audioControlService = new AudioControlService();
