/**
 * Dummy Recorder Service
 * Android'in mikrofonu kapatmasını önlemek için "ses kaydediyormuş gibi" kandırma servisi
 * Gerçekte hiçbir şey kaydetmez, sadece Android'e "kayıt modundayım" sinyali verir
 */

export class DummyRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private isRecording = false;
  private dummyChunks: Blob[] = [];
  private restartTimeout: NodeJS.Timeout | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;

  /**
   * "Ses kaydı alıyormuşuz gibi" başlat
   * Android'e "kayıt modundayım" sinyali verir, böylece mikrofon kapanmaz
   */
  async start(): Promise<void> {
    if (this.isRecording) {
      console.log('⚠️ Dummy recorder zaten aktif');
      return;
    }

    try {
      // 1. Gerçek mikrofonu al - Speech Recognition ile AYNI STREAM'i kullan
      // ÖNEMLİ: Aynı stream'i kullan ki mikrofon çakışması olmasın
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
          sampleRate: 44100,
        }
      });
      
      // Stream'i global olarak sakla - Speech Recognition ile paylaş
      (window as any).__sharedMediaStream = this.mediaStream;

      // 2. MediaRecorder oluştur ama BOŞ bir stream'e bağla
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/ogg';
      
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000,
      });

      // 3. Data aldıkça boşver (gerçekte kaydetme, sadece Android'e sinyal)
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          // Chunk'ları tutma, sadece Android'e "ses varmış" sinyali
          this.dummyChunks.push(event.data);
          
          // 50 chunk'tan fazla olursa temizle (memory leak olmasın) - LOG YOK
          if (this.dummyChunks.length > 50) {
            this.dummyChunks.shift(); // İlk chunk'ı sil
          }
        }
      };

      // 4. Hata olursa sessizce tekrar başlat
      this.mediaRecorder.onerror = (error) => {
        console.error('❌ [DUMMY] Recorder hatası:', error);
        if (this.isRecording) {
          this.restart();
        }
      };

      // 5. Stop olduğunda tekrar başlat (Android kapatmaya çalışırsa)
      this.mediaRecorder.onstop = () => {
        if (this.isRecording) {
          console.warn('⚠️ [DUMMY] Recorder durdu, otomatik yeniden başlatılıyor...');
          this.restart();
        }
      };

      // 6. Her 100ms'de bir dummy data üret (Android'e sürekli sinyal - daha sık)
      // Daha sık data üretmek Android'in mikrofonu kapatmasını daha iyi önler
      this.mediaRecorder.start(100);

      // 7. Keep-alive mekanizması: Her 5 saniyede bir kontrol et
      this.keepAliveInterval = setInterval(() => {
        if (this.mediaRecorder) {
          const state = this.mediaRecorder.state;
          
          if (state === 'inactive') {
            console.warn('⚠️ [DUMMY] Recorder inactive, yeniden başlatılıyor...');
            this.restart();
          } else if (state === 'paused') {
            console.warn('⚠️ [DUMMY] Recorder paused, resume ediliyor...');
            try {
              this.mediaRecorder.resume();
            } catch (e) {
              console.error('❌ [DUMMY] Resume hatası:', e);
              this.restart();
            }
          }
          // recording state'inde log yok - performans için
        }
      }, 5000);

      this.isRecording = true;
      console.log('🔴 Dummy recorder başladı - Android mikrofonu kapatmayacak');
      
    } catch (error) {
      console.error('❌ Dummy recorder başlatılamadı:', error);
      this.cleanup();
      throw new Error('Mikrofon kaydı başlatılamadı: ' + (error as Error).message);
    }
  }

  /**
   * Android'in sessizlik algılamasını kır - otomatik yeniden başlat
   */
  private restart(): void {
    if (!this.isRecording) {
      return;
    }
    
    // Önceki restart timeout'u iptal et
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }
    
    console.warn('⚠️ [DUMMY] Recorder durdu, yeniden başlatılıyor...');
    
    this.restartTimeout = setTimeout(async () => {
      try {
        await this.stop();
        // Kısa bir bekleme sonrası tekrar başlat
        await new Promise(resolve => setTimeout(resolve, 300));
        await this.start();
      } catch (error) {
        console.error('❌ [DUMMY] Restart hatası:', error);
        // Hata olursa tekrar dene
        if (this.isRecording) {
          setTimeout(() => this.restart(), 1000);
        }
      }
    }, 200);
  }

  /**
   * Durdur - tüm kaynakları temizle
   */
  async stop(): Promise<void> {
    if (!this.isRecording) {
      return;
    }

    this.isRecording = false;

    // Timeout'ları temizle
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    try {
      // MediaRecorder'ı durdur
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Stream track'lerini durdur
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }
      
      // Temizlik
      this.dummyChunks = [];
      this.mediaRecorder = null;
      this.mediaStream = null;
      
    } catch (error) {
      console.error('❌ [DUMMY] Durdurma hatası:', error);
    }
  }

  /**
   * Status kontrolü
   */
  isActive(): boolean {
    return this.isRecording && this.mediaRecorder?.state === 'recording';
  }

  /**
   * MediaStream'i al (TensorFlow ile paylaşmak için)
   */
  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }

  /**
   * Tüm kaynakları temizle
   */
  private cleanup(): void {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    if (this.mediaRecorder) {
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (e) {
        // Ignore
      }
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      this.mediaStream = null;
    }

    this.dummyChunks = [];
    this.isRecording = false;
  }
}

// Singleton instance
export const dummyRecorderService = new DummyRecorderService();

