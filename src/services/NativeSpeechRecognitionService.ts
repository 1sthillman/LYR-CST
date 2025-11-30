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
      console.log('📱 [NATIVE SPEECH] Native Android Speech Recognition başlatılıyor...');
      
      this.callback = callback;
      this.onErrorCallback = onError || null;

      // JavaScript bridge ile Android'e mesaj gönder
      const bridge = (window as any).AndroidSpeechBridge;
      if (!bridge) {
        console.error('❌ [NATIVE SPEECH] Android Speech Bridge bulunamadı!');
        console.error('❌ [NATIVE SPEECH] MainActivity.java\'da bridge kurulmalı.');
        throw new Error('Android Speech Bridge bulunamadı! Lütfen native Android app kullanın.');
      }

      console.log('✅ [NATIVE SPEECH] Android Speech Bridge bulundu');

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

      // Android'e başlatma mesajı gönder
      console.log('📱 [NATIVE SPEECH] Android\'e startListening() mesajı gönderiliyor...');
      console.log('📱 [NATIVE SPEECH] Bridge var mı:', !!bridge);
      console.log('📱 [NATIVE SPEECH] Bridge type:', typeof bridge);
      console.log('📱 [NATIVE SPEECH] Bridge startListening var mı:', typeof bridge.startListening);
      
      try {
        bridge.startListening();
        console.log('✅ [NATIVE SPEECH] bridge.startListening() çağrıldı');
      } catch (bridgeError) {
        console.error('❌ [NATIVE SPEECH] bridge.startListening() hatası:', bridgeError);
        throw bridgeError;
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

