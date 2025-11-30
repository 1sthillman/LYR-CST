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
  private permissionCheckInterval: NodeJS.Timeout | null = null; // Permissions kontrolü

  /**
   * Servisi başlatır ve modeli yükler
   */
  async initialize(
    callback: (word: string, confidence: number) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      
      // Web Speech API kontrolü - MOBİL TARAYICI DESTEĞİ İÇİN
      const SpeechRecognition = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        console.error('❌ Web Speech API bulunamadı!');
        // MOBİL TARAYICI İÇİN: Daha açıklayıcı hata mesajı
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          throw new Error('Mobil tarayıcınız Web Speech API\'yi desteklemiyor. Lütfen Chrome veya Safari kullanın.');
        }
        throw new Error('Tarayıcınız Web Speech API\'yi desteklemiyor. Lütfen Chrome, Edge veya Safari kullanın.');
      }

      console.log('✅ Web Speech API bulundu');
      
      // MOBİL TARAYICI KONTROLÜ
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        console.log('📱 Mobil tarayıcı tespit edildi - telefon görüşmesi gibi kesintisiz dinleme aktif');
      }

      // ÖNCE: Eski recognition instance'ını temizle (memory leak önleme)
      if (this.recognition) {
        try {
          const oldRecognition = this.recognition;
          oldRecognition.stop();
        } catch (e) {
          // Ignore
        }
        this.recognition = null;
      }

      // Konuşma tanıma örneği oluştur
      const recognition = new SpeechRecognition();
      this.recognition = recognition;
      this.callback = callback;
      (this as any).onErrorCallback = onError; // Error callback'i sakla
      (this as any).onErrorCallback = onError; // Error callback'i sakla

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
        console.log('✅ [SPEECH] Recognition başladı! Kesintisiz dinleme aktif...');
        this.lastProcessedIndex = -1;
        this.processedWords.clear(); // Web ile aynı - her başlangıçta temizle
        // onstart olduğunda restart zamanını sıfırla - yeni başlangıç
        (this as any).lastRestartTime = Date.now();
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
        
        // İzin reddedildi - gerçek hata
        if (event.error === 'not-allowed') {
          console.error('❌ [SPEECH] Mikrofon erişimi reddedildi!');
          if (this.callback) {
            (this as any).onErrorCallback?.(new Error('Mikrofon erişimi reddedildi'));
          }
          this.stop();
          throw new Error('Mikrofon erişimi reddedildi');
        }
        
        // Aborted ve Network hataları - Speech Recognition API'nin normal davranışı
        // continuous: true modunda bu hatalar sık görülür ve gerçek bir sorun değildir
        // Sessizce handle et - log ve toast yok
        if (event.error === 'aborted' || event.error === 'network') {
          // Sessizce restart yap - log ve toast yok (normal API davranışı)
          if (this.isListening && this.recognition) {
            // Kısa bir delay ile restart (API'nin kendini toparlaması için)
            setTimeout(() => {
              if (this.isListening && this.recognition) {
                try {
                  // State kontrolü - eğer hala aktifse restart yapma
                  const state = (this.recognition as any).state;
                  if (state === 'listening' || state === 'starting' || state === 'processing') {
                    return; // Zaten aktif, restart yapma
                  }
                  // Sessizce restart
                  this.recognition.start();
                } catch (error: any) {
                  // "already started" hatası normal, görmezden gel
                  if (error?.message?.includes('already') || 
                      error?.message?.includes('started') ||
                      error?.name === 'InvalidStateError') {
                    return;
                  }
                  // Diğer hatalarda restartRecognition kullan
                  this.restartRecognition();
                }
              }
            }, 500);
          }
          return; // Normal API davranışı, devam et
        }
        
        // Diğer hatalarda (service-unavailable, bad-grammar, vb.) sessizce restart
        if (this.isListening && this.recognition) {
          // Sadece gerçekten kritik hatalarda log göster
          if (event.error === 'service-unavailable') {
            console.warn('⚠️ [SPEECH] Servis kullanılamıyor, yeniden başlatılıyor...');
          }
          // Sessizce restart yap
          this.restartRecognition();
        }
      };

      recognition.onend = () => {
        // KESİNTİSİZ DİNLEME - ChatGPT/Grok gibi sistemlerde onend event'i ignore edilir
        // continuous: true ile çalışırken onend normal bir durum, restart yapmaya GEREK YOK
        // Sadece gerçek hatalarda (onerror) restart yapılır
        
        if (this.isListening && this.recognition) {
          // ÖNCE: Recognition state'ini kontrol et - eğer hala aktifse TAMAMEN ignore et
          try {
            const state = (this.recognition as any).state;
            if (state === 'listening' || state === 'starting' || state === 'processing') {
              // Zaten dinliyor, işliyor veya başlıyor - onend'i TAMAMEN ignore et
              // Bu ChatGPT/Grok gibi sistemlerin yaptığı gibi
              return;
            }
          } catch (e) {
            // State kontrolü başarısız, devam et
          }
          
          // İKİNCİ: Son restart zamanını kontrol et - çok agresif kontrol
          const lastRestartTime = (this as any).lastRestartTime || 0;
          const timeSinceLastRestart = Date.now() - lastRestartTime;
          
          // Son restart'tan 10 saniye geçmediyse restart yapma (çok agresif - kesintisiz dinleme için)
          if (timeSinceLastRestart < 10000) {
            // Sessizce atla - log yok (performans için)
            return;
          }
          
          // ÜÇÜNCÜ: Sadece gerçekten durmuşsa ve uzun süre geçtiyse restart yap
          // Ama önce bir kez daha state kontrolü yap
          setTimeout(() => {
            if (this.isListening && this.recognition) {
              try {
                const state = (this.recognition as any).state;
                if (state === 'listening' || state === 'starting' || state === 'processing') {
                  // Hala aktif, restart yapma
                  return;
                }
                
                // Gerçekten durmuşsa ve 10 saniye geçtiyse restart yap
                (this as any).lastRestartTime = Date.now();
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
          }, 3000); // 3 saniye bekleme - kesintisiz dinleme için
        }
      };

      // Dinlemeyi başlat - MOBİL TARAYICI İÇİN ÖZEL
      console.log('🚀 Recognition başlatılıyor...');
      
      // MOBİL TARAYICI İÇİN: User gesture kontrolü
      // Bazı mobil tarayıcılarda getUserMedia veya Speech Recognition
      // sadece kullanıcı etkileşimi (buton tıklama) sonrası çalışır
      try {
        recognition.start();
        this.isListening = true;
        this.processedWords.clear();
        this.lastProcessedIndex = -1;
        (this as any).lastRestartTime = Date.now();
        
        console.log('✅ Recognition başlatıldı, isListening:', this.isListening);
        console.log('📱 Kesintisiz dinleme aktif - telefon görüşmesi gibi çalışıyor');

        // Permissions kontrolü başlat (her 10 saniyede bir)
        this.startPermissionMonitoring();
      } catch (startError: any) {
        // "already started" hatası normal
        if (startError?.message?.includes('already') || 
            startError?.message?.includes('started') ||
            startError?.name === 'InvalidStateError') {
          console.log('ℹ️ Recognition zaten başlatılmış');
          this.isListening = true;
          return;
        }
        
        // MOBİL TARAYICI İÇİN: Daha açıklayıcı hata mesajı
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          throw new Error('Mobil tarayıcıda Speech Recognition başlatılamadı. Lütfen butona tekrar tıklayın veya sayfayı yenileyin.');
        }
        throw startError;
      }
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
    
    // KESİNTİSİZ DİNLEME - Çok agresif restart önleme
    const lastRestartTime = (this as any).lastRestartTime || 0;
    const timeSinceLastRestart = Date.now() - lastRestartTime;
    
    // Son restart'tan 10 saniye geçmediyse restart yapma (kesintisiz dinleme için)
    if (timeSinceLastRestart < 10000) {
      // Sessizce atla - log yok (performans için)
      return;
    }
    
    (this as any).lastRestartTime = Date.now();
    
    // Uzun delay - kesintisiz dinleme için
    this.restartTimeout = window.setTimeout(() => {
      if (this.isListening && this.recognition) {
        try {
          // ÖNCE: Recognition state'ini kontrol et
          const state = (this.recognition as any).state;
          if (state === 'listening' || state === 'starting' || state === 'processing') {
            // Zaten dinliyor, işliyor veya başlıyor, restart yapma
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
            setTimeout(() => this.restartRecognition(), 10000); // 10 saniye bekleme - kesintisiz dinleme
          }
        }
      }
    }, 5000); // 5 saniye bekleme - kesintisiz dinleme için
  }

  /**
   * Permissions monitoring başlat
   */
  private startPermissionMonitoring(): void {
    // Önceki interval'i temizle
    if (this.permissionCheckInterval) {
      clearInterval(this.permissionCheckInterval);
    }

    // Permissions API destekleniyorsa kontrol et
    if ('permissions' in navigator && 'query' in navigator.permissions) {
      this.permissionCheckInterval = setInterval(async () => {
        try {
          const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          
          if (permission.state === 'denied') {
            console.error('❌ [SPEECH] Mikrofon izni iptal edilmiş!');
            (this as any).onErrorCallback?.(new Error('Mikrofon izni iptal edilmiş. Lütfen tarayıcı ayarlarından izin verin.'));
            this.stop();
          } else if (permission.state === 'prompt') {
            // İzin isteniyor - normal durum
          }
        } catch (error) {
          // Permissions API desteklenmiyor veya hata - devam et
        }
      }, 10000); // Her 10 saniyede bir kontrol
    }
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

          // AKILLI THRESHOLD - Sessizlik ve arka plan gürültüsü algılanmasın
          // MOBİL İÇİN ÖZEL: Mobilde confidence değerleri genelde daha düşük, bu yüzden daha esnek threshold
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          // Confidence threshold - mobilde daha esnek
          let minConfidence: number;
          if (result.isFinal) {
            minConfidence = isMobile ? 0.30 : 0.40; // Final: Mobil 0.30, PC 0.40
          } else {
            minConfidence = isMobile ? 0.25 : 0.35; // Interim: Mobil 0.25, PC 0.35
          }

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

                // Interim results için daha düşük confidence (anlık algılama için)
                // Final results için daha yüksek confidence (kesin algılama için)
                const finalConfidence = result.isFinal ? Math.max(confidence, 0.8) : Math.max(confidence, 0.7);
                
                // DETAYLI LOG - Algılanan kelimeyi logla
                console.log(`🎤 [SPEECH] Kelime algılandı: "${cleanWord}" | Confidence: ${finalConfidence.toFixed(2)} | Type: ${result.isFinal ? 'FINAL' : 'INTERIM'} | Original: "${word}"`);
                
                // Callback'e gönder - ANLIK İŞARETLEME (INTERIM VE FINAL)
                // Interim results anlık algılama için kritik - hemen gönder
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
