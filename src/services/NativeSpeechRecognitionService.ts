/**
 * Native Android Speech Recognition Service
 * Android WebView'de Web Speech API çalışmadığı için native Android SpeechRecognizer kullanır
 */

export class NativeSpeechRecognitionService {
  private isListening: boolean = false;
  private callback: ((word: string, confidence: number) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;

  /**
   * Native Android Speech Recognition başlat
   */
  async initialize(
    callback: (word: string, confidence: number) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      console.log('📱 [NATIVE SPEECH] ⚡⚡⚡ Native Android Speech Recognition başlatılıyor... ⚡⚡⚡');
      console.log('📱 [NATIVE SPEECH] Callback var mı:', !!callback);
      console.log('📱 [NATIVE SPEECH] onError var mı:', !!onError);
      
      this.callback = callback;
      this.onErrorCallback = onError || null;

      // JavaScript bridge ile Android'e mesaj gönder
      console.log('📱 [NATIVE SPEECH] AndroidSpeechBridge aranıyor...');
      console.log('📱 [NATIVE SPEECH] window object:', typeof window);
      console.log('📱 [NATIVE SPEECH] window.AndroidSpeechBridge:', (window as any).AndroidSpeechBridge);
      console.log('📱 [NATIVE SPEECH] window keys:', Object.keys(window).filter(k => k.includes('Android') || k.includes('Speech')));
      
      const bridge = (window as any).AndroidSpeechBridge;
      console.log('📱 [NATIVE SPEECH] Bridge var mı:', !!bridge);
      console.log('📱 [NATIVE SPEECH] Bridge type:', typeof bridge);
      console.log('📱 [NATIVE SPEECH] Bridge value:', bridge);
      
      if (!bridge) {
        const errorMsg = '❌ [NATIVE SPEECH] Android Speech Bridge bulunamadı! MainActivity.java\'da bridge kurulmalı.';
        console.error(errorMsg);
        console.error('❌ [NATIVE SPEECH] window.AndroidSpeechBridge:', (window as any).AndroidSpeechBridge);
        console.error('❌ [NATIVE SPEECH] Tüm window keys:', Object.keys(window).slice(0, 50));
        
        // 5 saniye bekle ve tekrar dene (bazen bridge geç yüklenir)
        console.log('📱 [NATIVE SPEECH] 5 saniye bekleniyor, bridge yüklenmesi için...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const bridgeRetry = (window as any).AndroidSpeechBridge;
        console.log('📱 [NATIVE SPEECH] Retry - Bridge var mı:', !!bridgeRetry);
        
        if (!bridgeRetry) {
          throw new Error('Android Speech Bridge bulunamadı! Lütfen native Android app kullanın ve uygulamayı yeniden başlatın.');
        }
        
        // Retry başarılı - bridge'i kullan
        (window as any).AndroidSpeechBridge = bridgeRetry;
      }

      const finalBridge = bridge || (window as any).AndroidSpeechBridge;
      if (!finalBridge) {
        throw new Error('Android Speech Bridge bulunamadı! Lütfen native Android app kullanın.');
      }
      
      console.log('✅ [NATIVE SPEECH] Android Speech Bridge bulundu');
      console.log('📱 [NATIVE SPEECH] Bridge methods:', Object.keys(finalBridge));
      console.log('📱 [NATIVE SPEECH] Bridge startListening var mı:', typeof finalBridge.startListening);
      console.log('📱 [NATIVE SPEECH] Bridge stopListening var mı:', typeof finalBridge.stopListening);

      // Android'den gelen mesajları dinle
      (window as any).onNativeSpeechResult = (transcript: string, confidence: number) => {
        console.log(`📱 [NATIVE SPEECH] ⚡⚡⚡ onNativeSpeechResult CALLBACK TETİKLENDİ! ⚡⚡⚡`);
        console.log(`📱 [NATIVE SPEECH] Transcript: "${transcript}" | Confidence: ${confidence.toFixed(3)}`);
        console.log(`📱 [NATIVE SPEECH] isListening: ${this.isListening} | callback var mı: ${!!this.callback}`);
        
        if (this.isListening && this.callback) {
          console.log(`📱 [NATIVE SPEECH] ⚡⚡⚡ Kelime algılandı: "${transcript}" | Confidence: ${confidence.toFixed(3)} ⚡⚡⚡`);
          // Kelimeleri temizle ve ayır
          const words = transcript.trim().toLowerCase().split(/\s+/).filter((w: string) => w.length > 0);
          console.log(`📱 [NATIVE SPEECH] Kelimelere ayrıldı: ${words.length} kelime`, words);
          
          words.forEach((word: string, index: number) => {
            const cleanWord = word.replace(/[.,!?;:'"()\[\]{}…–—]/g, '').trim();
            if (cleanWord.length > 0) {
              console.log(`📱 [NATIVE SPEECH] Kelime[${index}] işleniyor: "${cleanWord}"`);
              this.callback!(cleanWord, confidence);
              console.log(`📱 [NATIVE SPEECH] Kelime[${index}] callback'e gönderildi: "${cleanWord}"`);
            } else {
              console.log(`📱 [NATIVE SPEECH] Kelime[${index}] temizlendikten sonra boş, atlanıyor: "${word}"`);
            }
          });
        } else {
          console.warn(`⚠️ [NATIVE SPEECH] Callback çağrılamadı! isListening: ${this.isListening}, callback: ${!!this.callback}`);
        }
      };

      (window as any).onNativeSpeechError = (error: string) => {
        console.error(`❌ [NATIVE SPEECH] Hata: ${error}`);
        if (this.onErrorCallback) {
          this.onErrorCallback(new Error(error));
        }
      };

      // Speech Recognition hazır olduğunda bildir
      (window as any).onNativeSpeechReady = () => {
        console.log('✅ [NATIVE SPEECH] ⚡⚡⚡ Speech Recognition hazır - Dinlemeye başladı! ⚡⚡⚡');
        (window as any).__nativeSpeechReady = true; // Flag set et
      };

      // 5 saniye sonra hala onReadyForSpeech tetiklenmediyse hata bildir
      setTimeout(() => {
        if (!(window as any).__nativeSpeechReady) {
          console.error('❌ [NATIVE SPEECH] onReadyForSpeech 5 saniye içinde tetiklenmedi - SpeechRecognizer başlatılamadı!');
          if (this.onErrorCallback) {
            this.onErrorCallback(new Error('SpeechRecognizer başlatılamadı - onReadyForSpeech tetiklenmedi'));
          }
        }
      }, 5000);

      // Android'e başlatma mesajı gönder
      console.log('📱 [NATIVE SPEECH] Android\'e startListening() mesajı gönderiliyor...');
      console.log('📱 [NATIVE SPEECH] Bridge var mı:', !!bridge);
      console.log('📱 [NATIVE SPEECH] Bridge type:', typeof bridge);
      console.log('📱 [NATIVE SPEECH] Bridge startListening var mı:', typeof bridge.startListening);
      
      try {
        if (!finalBridge || typeof finalBridge.startListening !== 'function') {
          throw new Error('AndroidSpeechBridge.startListening() fonksiyonu bulunamadı!');
        }
        
        console.log('📱 [NATIVE SPEECH] bridge.startListening() çağrılıyor...');
        finalBridge.startListening();
        console.log('✅ [NATIVE SPEECH] bridge.startListening() çağrıldı - BAŞARILI!');
      } catch (bridgeError) {
        const errorMsg = bridgeError instanceof Error ? bridgeError.message : String(bridgeError);
        console.error('❌ [NATIVE SPEECH] bridge.startListening() hatası:', errorMsg);
        console.error('❌ [NATIVE SPEECH] Bridge error details:', bridgeError);
        throw new Error(`Android Speech Bridge hatası: ${errorMsg}`);
      }
      
      this.isListening = true;
      console.log('✅ [NATIVE SPEECH] Native Android Speech Recognition başlatıldı - Dinleme aktif!');
      console.log('📱 [NATIVE SPEECH] onNativeSpeechResult callback ayarlandı:', typeof (window as any).onNativeSpeechResult);
    } catch (error) {
      console.error('❌ [NATIVE SPEECH] Başlatılamadı:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Native Android Speech Recognition durdur
   */
  stop(): void {
    if (!this.isListening) {
      return;
    }

    console.log('🛑 [NATIVE SPEECH] Native Android Speech Recognition durduruluyor...');
    
    try {
      const bridge = (window as any).AndroidSpeechBridge;
      if (bridge) {
        bridge.stopListening();
      }
    } catch (error) {
      console.error('❌ [NATIVE SPEECH] Durdurulamadı:', error);
    }

    this.isListening = false;
    this.callback = null;
    this.onErrorCallback = null;
    
    console.log('✅ [NATIVE SPEECH] Native Android Speech Recognition durduruldu');
  }

  /**
   * Dinleme durumunu döndür
   */
  get listening(): boolean {
    return this.isListening;
  }
}

export default new NativeSpeechRecognitionService();

