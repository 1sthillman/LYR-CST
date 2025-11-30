/**
 * Native Android Speech Recognition Service
 * Android WebView'de Web Speech API çalışmadığı için native Android SpeechRecognizer kullanır
 */
import { Capacitor } from '@capacitor/core';

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
      // Sadece native Android app için çalış
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        throw new Error('Native Speech Recognition sadece Android app için kullanılabilir');
      }

      console.log('📱 [NATIVE SPEECH] Native Android Speech Recognition başlatılıyor...');
      
      this.callback = callback;
      this.onErrorCallback = onError;

      // JavaScript bridge ile Android'e mesaj gönder
      const bridge = (window as any).AndroidSpeechBridge;
      if (!bridge) {
        throw new Error('Android Speech Bridge bulunamadı! MainActivity.java\'da bridge kurulmalı.');
      }

      // Android'den gelen mesajları dinle
      (window as any).onNativeSpeechResult = (transcript: string, confidence: number) => {
        if (this.isListening && this.callback) {
          console.log(`📱 [NATIVE SPEECH] Kelime algılandı: "${transcript}" | Confidence: ${confidence.toFixed(3)}`);
          this.callback(transcript, confidence);
        }
      };

      (window as any).onNativeSpeechError = (error: string) => {
        console.error(`❌ [NATIVE SPEECH] Hata: ${error}`);
        if (this.onErrorCallback) {
          this.onErrorCallback(new Error(error));
        }
      };

      // Android'e başlatma mesajı gönder
      bridge.startListening();
      
      this.isListening = true;
      console.log('✅ [NATIVE SPEECH] Native Android Speech Recognition başlatıldı');
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

