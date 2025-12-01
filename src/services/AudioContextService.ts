/**
 * AudioContext Service
 * Android 10+ için kritik: Tarayıcı AudioContext'i suspend ediyor
 * Her 5 saniyede bir kontrol edip resume ediyor
 */

export class AudioContextService {
  private audioContext: AudioContext | null = null;
  private resumeInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  /**
   * AudioContext oluştur ve monitoring başlat
   */
  async initialize(): Promise<AudioContext> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('✅ [AUDIO] AudioContext oluşturuldu, state:', this.audioContext.state);
    }

    // Monitoring başlat (Android 10+ için kritik)
    this.startMonitoring();

    return this.audioContext;
  }

  /**
   * AudioContext'i al
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Monitoring başlat - her 5 saniyede bir kontrol et
   */
  private startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    console.log('🔍 [AUDIO] AudioContext monitoring başlatıldı');

    this.resumeInterval = setInterval(() => {
      if (this.audioContext) {
        const state = this.audioContext.state;

        if (state === 'suspended') {
          console.warn('⚠️ [AUDIO] AudioContext suspended, resume ediliyor...');
          this.audioContext.resume().then(() => {
            console.log('✅ [AUDIO] AudioContext resumed');
          }).catch((error) => {
            console.error('❌ [AUDIO] Resume hatası:', error);
          });
        } else if (state === 'running') {
          // Normal durum - log yok (performans için)
        }
      }
    }, 5000); // Her 5 saniyede bir kontrol
  }

  /**
   * Monitoring durdur
   */
  stopMonitoring(): void {
    if (this.resumeInterval) {
      clearInterval(this.resumeInterval);
      this.resumeInterval = null;
    }
    this.isMonitoring = false;
    console.log('🛑 [AUDIO] AudioContext monitoring durduruldu');
  }

  /**
   * AudioContext'i temizle
   */
  cleanup(): void {
    this.stopMonitoring();

    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (error) {
        console.error('❌ [AUDIO] AudioContext kapatma hatası:', error);
      }
      this.audioContext = null;
    }
  }
}

// Singleton instance
export const audioContextService = new AudioContextService();


