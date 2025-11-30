/**
 * Web Speech API konuşma tanıma servisi - ANLIK İŞARETLEME VE SÜREKLI DİNLEME
 * Gerçek zamanlı kelime tanıma yapar - herhangi bir kelimeyi tanıyabilir
 * Interim ve final sonuçları kullanır - anlık işaretleme için
 * Sürekli dinleme garantisi - hiç kapanmaz
 */
export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private callback: ((word: string, confidence: number) => void) | null = null;
  private processedWords: Set<string> = new Set(); // İşlenen kelimeleri takip et (duplicate önleme)
  private lastProcessedIndex: number = -1; // Son işlenen result index'i
  private restartTimeout: number | null = null; // Restart timeout'u

  /**
   * Servisi başlatır ve modeli yükler
   */
  async initialize(
    callback: (word: string, confidence: number) => void
  ): Promise<void> {
    try {
      
      // Web Speech API kontrolü
      const SpeechRecognition = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        console.error('❌ Web Speech API bulunamadı!');
        throw new Error('Tarayıcınız Web Speech API\'yi desteklemiyor');
      }

      console.log('✅ Web Speech API bulundu');

      // Konuşma tanıma örneği oluştur
      const recognition = new SpeechRecognition();
      this.recognition = recognition;
      this.callback = callback;

      // AYARLAR - ANLIK İŞARETLEME VE SÜREKLI DİNLEME
      recognition.continuous = true; // Sürekli dinleme
      recognition.interimResults = true; // GEÇİCİ SONUÇLARI DA AL - anlık işaretleme için
      
      // TÜRKÇE DİL DESTEĞİ - Android WebView'de farklı kodlar deneyelim
      // Önce tr-TR, sonra tr, sonra en-US (fallback)
      const supportedLangs = ['tr-TR', 'tr', 'en-US'];
      let langSet = false;
      for (const lang of supportedLangs) {
        try {
          recognition.lang = lang;
          langSet = true;
          console.log(`✅ Dil ayarı: ${lang}`);
          break;
        } catch (e) {
          console.warn(`⚠️ Dil ${lang} desteklenmiyor, bir sonrakini deniyor...`);
        }
      }
      if (!langSet) {
        recognition.lang = 'en-US'; // Fallback
        console.warn('⚠️ Türkçe desteklenmiyor, İngilizce kullanılıyor');
      }
      
      recognition.maxAlternatives = 1; // Sadece en iyi sonuç

      console.log('⚙️ Recognition ayarları:', {
        continuous: recognition.continuous,
        interimResults: recognition.interimResults,
        lang: recognition.lang,
        maxAlternatives: recognition.maxAlternatives
      });

      // Event handler'lar
      recognition.onstart = () => {
        console.log('✅ [SPEECH] Recognition başladı! Dinliyor...');
        this.lastProcessedIndex = -1;
        this.processedWords.clear(); // Web ile aynı - her başlangıçta temizle
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Log azaltıldı - performans için
        this.handleResult(event);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // Sessizlik hatası - devam et (susulduğunda kapanmaz)
        if (event.error === 'no-speech') {
          return; // Sessizlik normal, devam et - log yok
        }
        if (event.error === 'not-allowed') {
          console.error('❌ [SPEECH] Mikrofon erişimi reddedildi!');
          throw new Error('Mikrofon erişimi reddedildi');
        }
        if (event.error === 'aborted') {
          console.warn('⚠️ [SPEECH] Recognition aborted - yeniden başlatılıyor...');
          if (this.isListening && this.recognition) {
            this.restartRecognition();
          }
          return;
        }
        // Diğer hatalarda yeniden başlat
        if (this.isListening && this.recognition) {
          console.warn('🔄 [SPEECH] Hata nedeniyle yeniden başlatılıyor...', event.error);
          this.restartRecognition();
        }
      };

      recognition.onend = () => {
        // SÜREKLI DİNLEME - continuous: true ile çalışırken onend normal bir durum
        // ÖNEMLİ: onend çok sık tetiklenebilir, çok agresif kontrol yap
        if (this.isListening && this.recognition) {
          // ÖNCE: Recognition state'ini kontrol et - eğer hala aktifse restart yapma
          try {
            const state = (this.recognition as any).state;
            if (state === 'listening' || state === 'starting') {
              // Zaten dinliyor veya başlıyor, onend'i ignore et (normal durum)
              return;
            }
          } catch (e) {
            // State kontrolü başarısız, devam et
          }
          
          // İKİNCİ: Son restart zamanını kontrol et - çok sık restart önleme
          const lastRestartTime = (this as any).lastRestartTime || 0;
          const timeSinceLastRestart = Date.now() - lastRestartTime;
          
          // Son restart'tan 5 saniye geçmediyse restart yapma (çok agresif kontrol)
          if (timeSinceLastRestart < 5000) {
            // Sessizce atla - log yok (performans için)
            return;
          }
          
          (this as any).lastRestartTime = Date.now();
          
          // ÜÇÜNCÜ: Uzun bekleme sonrası restart - mikrofon stabilitesi için
          setTimeout(() => {
            if (this.isListening && this.recognition) {
              // Restart yapmadan önce tekrar state kontrolü
              try {
                const state = (this.recognition as any).state;
                if (state === 'listening' || state === 'starting') {
                  // Zaten dinliyor, restart yapma
                  return;
                }
                
                // Sadece gerçekten durmuşsa restart yap
                this.recognition.start();
              } catch (error: any) {
                // "already started" hatası normal, görmezden gel
                if (error?.message?.includes('already') || 
                    error?.message?.includes('started') ||
                    error?.name === 'InvalidStateError') {
                  return;
                }
                // Diğer hatalarda restart yap
                this.restartRecognition();
              }
            }
          }, 2000); // 2 saniye bekleme - mikrofon stabilitesi için
        }
      };

      // Dinlemeyi başlat
      console.log('🚀 Recognition başlatılıyor...');
      recognition.start();
      this.isListening = true;
      this.processedWords.clear();
      this.lastProcessedIndex = -1;
      
      console.log('✅ Recognition başlatıldı, isListening:', this.isListening);
    } catch (error) {
      console.error('❌ Ses tanıma başlatılamadı:', error);
      if (error instanceof Error) {
        throw new Error(`Mikrofon erişimi reddedildi veya Speech API yüklenemedi: ${error.message}`);
      }
      throw new Error('Mikrofon erişimi reddedildi veya Speech API yüklenemedi');
    }
  }

  /**
   * Recognition'ı yeniden başlatır (sürekli dinleme için)
   * MİKROFON STABİLİTESİ İÇİN: Çok sık restart yapma
   */
  private restartRecognition(): void {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }
    
    // Çok sık restart önleme - mikrofon stabilitesi için
    const lastRestartTime = (this as any).lastRestartTime || 0;
    const timeSinceLastRestart = Date.now() - lastRestartTime;
    
    // Son restart'tan 5 saniye geçmediyse restart yapma (çok agresif kontrol)
    if (timeSinceLastRestart < 5000) {
      // Sessizce atla - log yok (performans için)
      return;
    }
    
    (this as any).lastRestartTime = Date.now();
    
    // Uzun delay - mikrofon stabilitesi için
    this.restartTimeout = window.setTimeout(() => {
      if (this.isListening && this.recognition) {
        try {
          // ÖNCE: Recognition state'ini kontrol et
          const state = (this.recognition as any).state;
          if (state === 'listening' || state === 'starting') {
            // Zaten dinliyor veya başlıyor, restart yapma
            return;
          }
          
          // Sadece gerçekten durmuşsa restart yap
          this.recognition.start();
        } catch (error: any) {
          // "already started" hatası normal, görmezden gel
          if (error?.message?.includes('already') || 
              error?.message?.includes('started') ||
              error?.name === 'InvalidStateError') {
            return;
          }
          
          // Hata olursa daha uzun bekle ve tekrar dene
          if (this.isListening) {
            setTimeout(() => this.restartRecognition(), 5000); // 5 saniye bekleme
          }
        }
      }
    }, 3000); // 3 saniye bekleme - mikrofon stabilitesi için
  }

  /**
   * Noktalama işaretlerini temizler
   */
  private cleanWord(word: string): string {
    return word
      .replace(/[.,!?;:'"()\[\]{}…–—]/g, '') // Tüm noktalama işaretleri
      .replace(/[^\wçğıöşüÇĞIİÖŞÜ]/g, '') // Sadece harf ve Türkçe karakterler
      .trim();
  }

  /**
   * Tanıma sonucunu işler - INTERIM VE FINAL SONUÇLAR (ANLIK İŞARETLEME)
   */
  private handleResult(event: SpeechRecognitionEvent): void {
    if (!this.callback) {
      console.error('❌ Callback yok!');
      return;
    }

    try {
      const results = event.results;
      const resultLength = results.length;

      // WEB İLE BİREBİR AYNI - Result array sıfırlanma kontrolü
      // Web'de de nadiren olabilir, aynı mantıkla işle
      if (resultLength <= this.lastProcessedIndex) {
        // Result array sıfırlandı - index'i sıfırla ve devam et (web ile aynı)
        this.lastProcessedIndex = -1;
        // Web'de de aynı şekilde işle, return etme - devam et
      }

      // TÜM yeni sonuçları işle (interim + final)
      for (let i = this.lastProcessedIndex + 1; i < resultLength; i++) {
        const result = results[i];
        
        if (result && result.length > 0) {
          const bestAlternative = result[0];
          const transcript = bestAlternative.transcript.trim().toLowerCase();
          
          // Confidence değeri - Web Speech API bazen vermeyebilir veya çok düşük verebilir
          let confidence = bestAlternative.confidence;
          
          // Web Speech API genellikle çok düşük confidence veriyor (0.01 gibi)
          // Bu durumda varsayılan yüksek değer kullan
          if (!confidence || confidence < 0.1) {
            confidence = result.isFinal ? 0.9 : 0.8;
          }

          // ÇOK DÜŞÜK THRESHOLD - Web Speech API'nin düşük confidence sorunu için
          const minConfidence = 0.01;

          if (transcript.length > 0 && confidence >= minConfidence) {
            // Kelimeleri ayır ve temizle
            const words = transcript.split(/\s+/).filter((w: string) => w.length > 0);
            
            // Her kelimeyi işle - ANLIK İŞARETLEME İÇİN (RAP İÇİN HIZLI)
            words.forEach((word: string, wordIndex: number) => {
              const cleanWord = this.cleanWord(word);
              
              if (cleanWord.length > 0) {
                // Unique key oluştur: resultIndex-wordIndex-word
                const wordKey = `${i}-${wordIndex}-${cleanWord}`;
                
                // Duplicate kontrolü - sadece final results için
                if (this.processedWords.has(wordKey) && result.isFinal) {
                  return;
                }

                // Final sonuçlar için daha yüksek confidence ver
                const finalConfidence = result.isFinal ? Math.max(confidence, 0.8) : Math.max(confidence, 0.75);
                
                // Callback'e gönder - ANLIK İŞARETLEME (INTERIM VE FINAL)
                this.callback!(cleanWord, finalConfidence);
                
                // İşlenen kelimeyi kaydet (sadece final results için)
                if (result.isFinal) {
                  this.processedWords.add(wordKey);
                }
              }
            });

            // Final sonuç olduğunda, eski işlenen kelimeleri temizle (memory leak önleme)
            if (result.isFinal) {
              if (this.processedWords.size > 200) {
                const wordsArray = Array.from(this.processedWords);
                this.processedWords = new Set(wordsArray.slice(-200));
              }
            }
          }
        }
      }

      // Son işlenen result index'i güncelle
      this.lastProcessedIndex = resultLength - 1;
    } catch (error) {
      console.error('❌ [SPEECH] Sonuç işlenirken hata:', error);
    }
  }

  /**
   * Dinlemeyi durdurur
   */
  stop(): void {
    console.log('🛑 Recognition durduruluyor...');
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isListening = false;
        this.callback = null;
        this.processedWords.clear();
        this.lastProcessedIndex = -1;
        console.log('✅ Recognition durduruldu');
      } catch (error) {
        console.error('❌ Dinleme durdurulamadı:', error);
      }
    }
  }

  /**
   * Dinleme durumunu döndürür
   */
  get listening(): boolean {
    return this.isListening;
  }

  /**
   * Modeli temizler
   */
  dispose(): void {
    this.stop();
    if (this.recognition) {
      this.recognition = null;
    }
  }
}

export default new SpeechRecognitionService();
