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
  private wakeLock: any = null; // Wake Lock - ekran kapansa bile devam et

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

      // 4. Hata olursa OTOMATIK YENIDEN BASLAT (dummy.md'deki gibi: 500ms sonra)
      this.mediaRecorder.onerror = (error) => {
        console.warn('⚠️ [DUMMY] Recorder hatası, 500ms sonra yeniden başlatılacak...', error);
        if (this.isRecording) {
          setTimeout(() => this.restart(), 500);
        }
      };

      // 5. Stop olduğunda HEMEN yeniden başlat (Android kapatmaya çalışırsa)
      // dummy.md'deki gibi: onstop'da hemen restart (100ms)
      this.mediaRecorder.onstop = () => {
        if (this.isRecording) {
          console.warn('⚠️ [DUMMY] Recorder durduruldu, HEMEN yeniden başlatılıyor...');
          // Hemen restart - 100ms bekleme (dummy.md'deki gibi)
          setTimeout(() => {
            if (this.isRecording) {
              this.start().catch(console.error);
            }
          }, 100);
        }
      };

      // 6. Wake Lock al (ekran kapansa bile devam et)
      await this.acquireWakeLock();

      // 7. Her 50ms'de bir dummy data üret (Android'e sürekli sinyal - kesintisiz dinleme için)
      // ChatGPT/Grok gibi sistemlerde mikrofon sürekli açık, daha sık sinyal gerekli
      this.mediaRecorder.start(50);

      // 8. Keep-alive mekanizması: Her 5 saniyede bir kontrol et
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
   * dummy.md'deki gibi: 500ms sonra restart
   */
  private restart(): void {
    if (!this.isRecording) {
      return;
    }
    
    // Önceki restart timeout'u iptal et
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }
    
    console.warn('⚠️ [DUMMY] Recorder durdu, 500ms sonra yeniden başlatılacak...');
    
    this.restartTimeout = setTimeout(async () => {
      try {
        await this.stop();
        // Kısa bir bekleme sonrası tekrar başlat (dummy.md'deki gibi)
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.start();
      } catch (error) {
        console.error('❌ [DUMMY] Restart hatası:', error);
        // Hata olursa tekrar dene
        if (this.isRecording) {
          setTimeout(() => this.restart(), 1000);
        }
      }
    }, 500); // dummy.md'deki gibi 500ms
  }

  /**
   * Wake Lock al - ekran kapansa bile devam et
   * dummy.md'deki gibi: screen wake lock
   */
  private async acquireWakeLock(): Promise<void> {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('🔒 [DUMMY] Wake Lock alındı - ekran kapansa bile devam edecek');
      } catch (error) {
        console.warn('⚠️ [DUMMY] Wake Lock alınamadı:', error);
        // Wake Lock olmadan da devam et
      }
    }
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
      
      // Wake Lock bırak
      if (this.wakeLock) {
        try {
          await this.wakeLock.release();
          console.log('🔓 [DUMMY] Wake Lock bırakıldı');
        } catch (error) {
          console.warn('⚠️ [DUMMY] Wake Lock bırakılamadı:', error);
        }
        this.wakeLock = null;
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

