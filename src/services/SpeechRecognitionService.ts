/**
 * Web Speech API konuşma tanıma servisi - ANLIK İŞARETLEME VE SÜREKLI DİNLEME
 * Gerçek zamanlı kelime tanıma yapar - herhangi bir kelimeyi tanıyabilir
 * Interim ve final sonuçları kullanır - anlık işaretleme için
 * Sürekli dinleme garantisi - hiç kapanmaz
 * 
 * NOT: Android WebView'de Web Speech API çalışmıyor - Native Android Speech Recognition kullanılmalı
 */
export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private callback: ((word: string, confidence: number) => void) | null = null;
  private processedWords: Set<string> = new Set(); // İşlenen kelimeleri takip et (duplicate önleme)
  private lastProcessedIndex: number = -1; // Son işlenen result index'i
  private restartTimeout: number | null = null; // Restart timeout'u
  private permissionCheckInterval: NodeJS.Timeout | null = null; // Permissions kontrolü
  private transcripts: string[] = []; // Transcript geçmişi (memory leak önleme)
  private maxTranscriptLength = 500; // Maksimum transcript sayısı
  private silenceTimeout: NodeJS.Timeout | null = null; // Silence detection timeout
  private readonly SILENCE_THRESHOLD = 2000; // 2 saniye sessizlik
  private wordBuffer: string[] = []; // Word buffer for better matching
  private readonly BUFFER_SIZE = 3; // Son 3 kelimeyi tut

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
        // MOBİL TARAYICI İÇİN: Daha açıklayıcı hata mesajı (speed.md'den)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          const errorMsg = 'Mobil tarayıcınız Web Speech API\'yi desteklemiyor! 😔\n\n' +
            'Lütfen şu tarayıcılardan birini kullanın:\n' +
            '• Google Chrome (önerilen)\n' +
            '• Microsoft Edge\n' +
            '• Samsung Internet Browser';
          if (onError) {
            onError(new Error(errorMsg));
          }
          throw new Error(errorMsg);
        }
        const errorMsg = 'Tarayıcınız Web Speech API\'yi desteklemiyor! 😔\n\n' +
          'Lütfen şu tarayıcılardan birini kullanın:\n' +
          '• Google Chrome (önerilen)\n' +
          '• Microsoft Edge\n' +
          '• Safari';
        if (onError) {
          onError(new Error(errorMsg));
        }
        throw new Error(errorMsg);
      }

      console.log('✅ Web Speech API bulundu');
      console.log('🔍 [SPEECH] Web Speech API detaylı kontrol:');
      console.log('🔍 [SPEECH] window.SpeechRecognition:', typeof (window as any).SpeechRecognition);
      console.log('🔍 [SPEECH] window.webkitSpeechRecognition:', typeof (window as any).webkitSpeechRecognition);
      console.log('🔍 [SPEECH] navigator.userAgent:', navigator.userAgent);
      console.log('🔍 [SPEECH] navigator.mediaDevices:', typeof navigator.mediaDevices);
      console.log('🔍 [SPEECH] navigator.mediaDevices.getUserMedia:', typeof navigator.mediaDevices?.getUserMedia);
      
      // MOBİL TARAYICI KONTROLÜ (global - tüm fonksiyon boyunca kullanılacak)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        console.log('📱 Mobil tarayıcı tespit edildi - telefon görüşmesi gibi kesintisiz dinleme aktif');
        console.warn('⚠️ [SPEECH] ANDROID WEBVIEW UYARISI: Android WebView\'de Web Speech API desteği çok sınırlı olabilir!');
        console.warn('⚠️ [SPEECH] Eğer onresult event\'i tetiklenmiyorsa, Android WebView Web Speech API\'yi desteklemiyor olabilir.');
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
      console.log('🔧 [SPEECH] SpeechRecognition instance oluşturuluyor...');
      console.log('🔧 [SPEECH] SpeechRecognition constructor:', SpeechRecognition);
      console.log('🔧 [SPEECH] SpeechRecognition prototype:', SpeechRecognition.prototype);
      
      let recognition: SpeechRecognition;
      try {
        recognition = new SpeechRecognition();
        console.log('✅ [SPEECH] SpeechRecognition instance oluşturuldu');
        console.log('📱 [SPEECH] Recognition instance type:', typeof recognition);
        console.log('📱 [SPEECH] Recognition instance constructor:', recognition.constructor?.name);
        console.log('📱 [SPEECH] Recognition instance toString:', recognition.toString());
        
        // Instance'ın tüm property'lerini kontrol et
        console.log('📱 [SPEECH] Recognition instance properties:', Object.keys(recognition));
        console.log('📱 [SPEECH] Recognition.continuous (default):', recognition.continuous);
        console.log('📱 [SPEECH] Recognition.interimResults (default):', recognition.interimResults);
        console.log('📱 [SPEECH] Recognition.lang (default):', recognition.lang);
      } catch (createError: any) {
        console.error('❌ [SPEECH] SpeechRecognition instance oluşturulamadı:', createError);
        console.error('❌ [SPEECH] Error name:', createError?.name);
        console.error('❌ [SPEECH] Error message:', createError?.message);
        console.error('❌ [SPEECH] Error stack:', createError?.stack);
        throw new Error(`Speech Recognition instance oluşturulamadı: ${createError.message}`);
      }
      
      this.recognition = recognition;
      this.callback = callback;
      (this as any).onErrorCallback = onError; // Error callback'i sakla

      // AYARLAR - ANLIK İŞARETLEME VE SÜREKLI DİNLEME
      recognition.continuous = true; // Sürekli dinleme
      recognition.interimResults = true; // GEÇİCİ SONUÇLARI DA AL - anlık işaretleme için
      
      // TÜRKÇE DİL DESTEĞİ - MOBİL İÇİN ÖZEL AYARLAR
      // Mobilde daha fazla dil kodu deneyelim
      const supportedLangs = isMobile 
        ? ['tr-TR', 'tr', 'tr_TR', 'turkish', 'tr-TR-Turkish', 'en-US'] // Mobil için daha fazla varyasyon
        : ['tr-TR', 'tr', 'en-US']; // PC için standart
      
      let langSet = false;
      let finalLang = 'en-US'; // Fallback
      
      for (const lang of supportedLangs) {
        try {
          recognition.lang = lang;
          // Mobilde dil ayarının gerçekten uygulandığını kontrol et
          if (recognition.lang === lang || recognition.lang.toLowerCase().includes('tr')) {
            langSet = true;
            finalLang = lang;
            console.log(`✅ Dil ayarı başarılı: ${lang} | Recognition.lang: ${recognition.lang}`);
            break;
          } else {
            console.warn(`⚠️ Dil ${lang} ayarlanamadı, recognition.lang: ${recognition.lang}`);
          }
        } catch (e) {
          console.warn(`⚠️ Dil ${lang} desteklenmiyor, bir sonrakini deniyor...`, e);
        }
      }
      
      if (!langSet) {
        // Son çare: tr-TR'yi zorla ayarla
        try {
          recognition.lang = 'tr-TR';
          finalLang = 'tr-TR';
          console.log(`⚠️ Fallback: tr-TR zorla ayarlandı | Recognition.lang: ${recognition.lang}`);
        } catch (e) {
          recognition.lang = 'en-US';
          finalLang = 'en-US';
          console.error('❌ Türkçe ayarlanamadı, İngilizce kullanılıyor:', e);
        }
      }
      
      // Mobilde dil ayarını doğrula
      if (isMobile) {
        console.log(`📱 [MOBİL] Dil ayarı doğrulaması: ${recognition.lang} | Hedef: ${finalLang}`);
        if (!recognition.lang.toLowerCase().includes('tr')) {
          console.error('❌ [MOBİL] UYARI: Türkçe dil ayarı uygulanamadı! Recognition.lang:', recognition.lang);
        }
      }
      
      // Performance optimizations - speed.md'den
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      recognition.maxAlternatives = isMobileDevice ? 5 : 3; // Mobilde daha fazla alternatif (speed.md)

      console.log('⚙️ Recognition ayarları:', {
        continuous: recognition.continuous,
        interimResults: recognition.interimResults,
        lang: recognition.lang,
        maxAlternatives: recognition.maxAlternatives
      });

      // Event handler'lar
      recognition.onstart = () => {
        const state = (recognition as any).state || 'unknown';
        console.log('✅ [SPEECH] ⚡⚡⚡ onstart event tetiklendi! ⚡⚡⚡');
        console.log('📱 [SPEECH] Recognition state:', state);
        console.log('📱 [SPEECH] Recognition lang:', recognition.lang);
        console.log('📱 [SPEECH] Recognition continuous:', recognition.continuous);
        console.log('📱 [SPEECH] Recognition interimResults:', recognition.interimResults);
        console.log('📱 [SPEECH] Recognition maxAlternatives:', recognition.maxAlternatives);
        console.log('📱 [SPEECH] Recognition serviceURI:', (recognition as any).serviceURI || 'default');
        console.log('📱 [SPEECH] Recognition grammars:', (recognition as any).grammars || 'none');
        console.log('📱 [SPEECH] Mikrofon stream durumu:', (window as any).__microphoneStream ? 'AKTİF' : 'YOK');
        
        // Mikrofon stream kontrolü
        const stream = (window as any).__microphoneStream as MediaStream | undefined;
        if (stream) {
          const audioTracks = stream.getAudioTracks();
          console.log('📱 [SPEECH] Audio tracks sayısı:', audioTracks.length);
          audioTracks.forEach((track, index) => {
            console.log(`📱 [SPEECH] Audio track[${index}]:`, {
              enabled: track.enabled,
              readyState: track.readyState,
              label: track.label,
              muted: track.muted,
              kind: track.kind
            });
          });
        } else {
          console.error('❌ [SPEECH] Mikrofon stream bulunamadı!');
        }
        
        this.lastProcessedIndex = -1;
        this.processedWords.clear(); // Web ile aynı - her başlangıçta temizle
        // onstart olduğunda restart zamanını sıfırla - yeni başlangıç
        (this as any).lastRestartTime = Date.now();
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        console.log('🎤 [SPEECH] ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡ onresult event tetiklendi! ⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡');
        console.log('🎤 [SPEECH] Results length:', event.results.length);
        console.log('🎤 [SPEECH] ResultIndex:', event.resultIndex);
        console.log('🎤 [SPEECH] Recognition state:', (this.recognition as any)?.state || 'unknown');
        console.log('🎤 [SPEECH] isListening:', this.isListening);
        console.log('🎤 [SPEECH] Callback var mı:', !!this.callback);
        // Event type property'si SpeechRecognitionEvent'te olmayabilir
        console.log('🎤 [SPEECH] Event timestamp:', Date.now());
        
        // MOBİLDE TÜM RESULT EVENT'LERİNİ LOGLA (DEBUG İÇİN)
        const isMobileLocal = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobileLocal) {
          console.log(`📱 [MOBİL DEBUG] ⚡⚡⚡ onresult event ⚡⚡⚡ | Results length: ${event.results.length} | ResultIndex: ${event.resultIndex}`);
          
          // Eğer hiç result yoksa
          if (event.results.length === 0) {
            console.warn('⚠️ [MOBİL SPEECH] onresult event tetiklendi ama hiç result yok!');
          }
          
          // Her result'u detaylı logla
          for (let i = 0; i < event.results.length; i++) {
            const result = event.results[i];
            console.log(`📱 [MOBİL SPEECH] Result[${i}] var mı:`, !!result);
            console.log(`📱 [MOBİL SPEECH] Result[${i}] length:`, result?.length || 0);
            console.log(`📱 [MOBİL SPEECH] Result[${i}] isFinal:`, result?.isFinal);
            
            if (result && result.length > 0) {
              const transcript = result[0].transcript;
              const confidence = result[0].confidence || 0;
              console.log(`📱 [MOBİL SPEECH] ✅ Result[${i}]: "${transcript}" | Confidence: ${confidence.toFixed(3)} | isFinal: ${result.isFinal}`);
            } else {
              console.warn(`⚠️ [MOBİL SPEECH] Result[${i}] boş veya geçersiz!`);
            }
          }
        } else {
          console.log(`💻 [PC DEBUG] onresult event | Results length: ${event.results.length} | ResultIndex: ${event.resultIndex}`);
        }
        
        this.handleResult(event);
      };
      
      // onresult event'inin ayarlandığını doğrula
      console.log('✅ [SPEECH] onresult handler ayarlandı:', !!recognition.onresult);
      
      // Android WebView'de Web Speech API çalışmıyorsa timeout kontrolü
      let resultReceived = false;
      const originalOnResult = recognition.onresult;
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        resultReceived = true;
        if (originalOnResult) {
          originalOnResult.call(recognition, event);
        }
      };
      
      // 5 saniye içinde sonuç gelmezse hata fırlat (Android WebView'de Web Speech API çalışmıyor)
      setTimeout(() => {
        if (!resultReceived && isMobile) {
          console.error('❌ [SPEECH] Android WebView\'de Web Speech API sonuç döndürmüyor - Native Speech Recognition kullanılmalı');
          throw new Error('Web Speech API çalışmıyor - Native Speech Recognition kullanılacak');
        }
      }, 5000);

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.log('⚠️ [SPEECH] onerror event:', event.error, '| State:', (recognition as any).state);
        // Sessizlik hatası - devam et (susulduğunda kapanmaz)
        if (event.error === 'no-speech') {
          console.log('🔇 [SPEECH] Sessizlik tespit edildi (normal)');
          return; // Sessizlik normal, devam et
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
        console.log('🛑 [SPEECH] onend event tetiklendi! State:', (this.recognition as any)?.state, '| isListening:', this.isListening);
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
        console.log('🚀 [SPEECH] recognition.start() çağrılıyor...');
        console.log('🚀 [SPEECH] Recognition state (start öncesi):', (recognition as any).state || 'unknown');
        console.log('🚀 [SPEECH] Mikrofon stream var mı:', !!(window as any).__microphoneStream);
        
        recognition.start();
        
        // Start sonrası state kontrolü
        setTimeout(() => {
          console.log('🚀 [SPEECH] Recognition state (start sonrası):', (recognition as any).state || 'unknown');
        }, 100);
        
        this.isListening = true;
        this.processedWords.clear();
        this.lastProcessedIndex = -1;
        (this as any).lastRestartTime = Date.now();
        
        console.log('✅ [SPEECH] Recognition başlatıldı, isListening:', this.isListening);
        console.log('📱 [SPEECH] Kesintisiz dinleme aktif - telefon görüşmesi gibi çalışıyor');
        console.log('📱 [SPEECH] Recognition ayarları:', {
          lang: recognition.lang,
          continuous: recognition.continuous,
          interimResults: recognition.interimResults,
          maxAlternatives: recognition.maxAlternatives
        });

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
          
          // MEMORY LEAK ÖNLEME: Transcript geçmişini kaydet
          this.transcripts.push(transcript);
          if (this.transcripts.length > this.maxTranscriptLength) {
            this.transcripts = this.transcripts.slice(-100); // Son 100'ü tut
          }
          
          // Confidence değeri - Web Speech API bazen vermeyebilir veya çok düşük verebilir
          let confidence = bestAlternative.confidence;
          
          // Web Speech API genellikle çok düşük confidence veriyor (0.01 gibi)
          // Bu durumda varsayılan yüksek değer kullan
          if (!confidence || confidence < 0.1) {
            confidence = result.isFinal ? 0.9 : 0.8;
          }

          // AKILLI THRESHOLD - Sessizlik ve arka plan gürültüsü algılanmasın
          // MOBİL İÇİN ÇOK AGRESİF AYARLAR: Mobilde confidence değerleri çok düşük olabilir
          // isMobile değişkeni initialize fonksiyonunda zaten tanımlı, burada scope dışında
          // Bu yüzden tekrar kontrol ediyoruz
          const isMobileLocal = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          // Confidence threshold - mobilde HİÇBİR THRESHOLD YOK (TÜM KELİMELERİ KABUL ET)
          let minConfidence: number;
          if (result.isFinal) {
            minConfidence = isMobileLocal ? 0.01 : 0.40; // Final: Mobil 0.01 (neredeyse hiç threshold yok), PC 0.40
          } else {
            minConfidence = isMobileLocal ? 0.01 : 0.35; // Interim: Mobil 0.01 (neredeyse hiç threshold yok), PC 0.35
          }
          
          // MOBİLDE TÜM KELİMELERİ LOGLA (DEBUG İÇİN) - HER ZAMAN LOGLA
          if (isMobileLocal) {
            console.log(`📱 [MOBİL DEBUG] Transcript: "${transcript}" | Length: ${transcript.length} | Confidence: ${confidence.toFixed(3)} | isFinal: ${result.isFinal} | MinConfidence: ${minConfidence} | Geçti: ${confidence >= minConfidence}`);
          } else {
            console.log(`💻 [PC DEBUG] Transcript: "${transcript}" | Length: ${transcript.length} | Confidence: ${confidence.toFixed(3)} | isFinal: ${result.isFinal} | MinConfidence: ${minConfidence} | Geçti: ${confidence >= minConfidence}`);
          }

          // KRİTİK: Transcript boş değilse ve confidence yeterliyse işle
          if (transcript.length > 0 && confidence >= minConfidence) {
            console.log(`✅ [SPEECH] Transcript geçti! Transcript: "${transcript}" | Confidence: ${confidence.toFixed(3)} >= ${minConfidence} | isFinal: ${result.isFinal}`);
            
            // Word buffer'a ekle (speed.md'den)
            this.updateWordBuffer(transcript);
            
            // Silence timer'ı sıfırla (speed.md'den)
            this.resetSilenceTimer();
            
            // Kelimeleri ayır ve temizle
            const words = transcript.split(/\s+/).filter((w: string) => w.length > 0);
            console.log(`📝 [SPEECH] Kelimelere ayrıldı: ${words.length} kelime | Words:`, words);
            
            // Her kelimeyi işle - ANLIK İŞARETLEME İÇİN (RAP İÇİN HIZLI)
            words.forEach((word: string, wordIndex: number) => {
              const cleanWord = this.cleanWord(word);
              console.log(`🔍 [SPEECH] Kelime işleniyor: "${word}" -> "${cleanWord}" | Index: ${wordIndex}`);
              
              if (cleanWord.length > 0) {
                // Unique key oluştur: resultIndex-wordIndex-word
                const wordKey = `${i}-${wordIndex}-${cleanWord}`;
                
                // Duplicate kontrolü - sadece final results için
                if (this.processedWords.has(wordKey) && result.isFinal) {
                  console.log(`⏭️ [SPEECH] Kelime zaten işlenmiş, atlanıyor: "${cleanWord}"`);
                  return;
                }

                // Interim results için daha düşük confidence (anlık algılama için)
                // Final results için daha yüksek confidence (kesin algılama için)
                // MOBİL İÇİN ÖZEL: Mobilde confidence değerlerini daha agresif kullan
                const finalConfidence = result.isFinal 
                  ? (isMobileLocal ? Math.max(confidence, 0.6) : Math.max(confidence, 0.8)) // Mobil: 0.6, PC: 0.8
                  : (isMobileLocal ? Math.max(confidence, 0.5) : Math.max(confidence, 0.7)); // Mobil: 0.5, PC: 0.7
                
                // DETAYLI LOG - Algılanan kelimeyi logla (mobilde daha detaylı)
                const logPrefix = isMobileLocal ? '📱 [MOBİL SPEECH]' : '🎤 [SPEECH]';
                console.log(`${logPrefix} ✅✅✅ KELİME ALGILANDI VE CALLBACK ÇAĞRILIYOR: "${cleanWord}" | Confidence: ${finalConfidence.toFixed(2)} | Type: ${result.isFinal ? 'FINAL' : 'INTERIM'} | Original: "${word}" | Lang: ${this.recognition?.lang || 'unknown'}`);
                
                // CALLBACK ÇAĞRISI - KRİTİK NOKTA
                try {
                  this.callback!(cleanWord, finalConfidence);
                  console.log(`✅ [SPEECH] Callback başarıyla çağrıldı: "${cleanWord}"`);
                } catch (callbackError) {
                  console.error(`❌ [SPEECH] Callback hatası:`, callbackError);
                }
                
                // İşlenen kelimeyi kaydet (sadece final results için)
                if (result.isFinal) {
                  this.processedWords.add(wordKey);
                }
              } else {
                console.log(`⚠️ [SPEECH] Temizlenmiş kelime boş, atlanıyor: "${word}" -> "${cleanWord}"`);
              }
            });

            // Final sonuç olduğunda, eski işlenen kelimeleri temizle (memory leak önleme)
            if (result.isFinal) {
              if (this.processedWords.size > 200) {
                const wordsArray = Array.from(this.processedWords);
                this.processedWords = new Set(wordsArray.slice(-200));
              }
            }
          } else {
            console.log(`❌ [SPEECH] Transcript geçmedi! Transcript: "${transcript}" | Length: ${transcript.length} | Confidence: ${confidence.toFixed(3)} < ${minConfidence} | isFinal: ${result.isFinal}`);
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
   * Word buffer'ı güncelle (speed.md'den)
   */
  private updateWordBuffer(transcript: string): void {
    const words = transcript.split(' ').filter(w => w.length > 0);
    this.wordBuffer.push(...words);
    
    // Buffer boyutunu koru
    if (this.wordBuffer.length > this.BUFFER_SIZE) {
      this.wordBuffer = this.wordBuffer.slice(-this.BUFFER_SIZE);
    }
  }

  /**
   * Silence timer'ı sıfırla (speed.md'den)
   */
  private resetSilenceTimer(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
    }
    
    this.silenceTimeout = setTimeout(() => {
      console.log('⏱️ [SPEECH] Sessizlik algılandı, yeniden başlatılıyor...');
      if (this.isListening) {
        this.restartRecognition();
      }
    }, this.SILENCE_THRESHOLD);
  }

  /**
   * Word buffer'ı al (speed.md'den)
   */
  getWordBuffer(): string[] {
    return [...this.wordBuffer];
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

    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }

    // Word buffer'ı temizle
    this.wordBuffer = [];

    // Permission monitoring'i durdur
    if (this.permissionCheckInterval) {
      clearInterval(this.permissionCheckInterval);
      this.permissionCheckInterval = null;
    }

    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isListening = false;
        this.callback = null;
        this.processedWords.clear();
        this.lastProcessedIndex = -1;
        
        // MEMORY LEAK ÖNLEME: Transcript geçmişini temizle (eğer çok fazla biriktiyse)
        if (this.transcripts.length > this.maxTranscriptLength) {
          this.transcripts = this.transcripts.slice(-100); // Son 100'ü tut
          console.log('🧹 [SPEECH] Transcript geçmişi temizlendi (memory leak önleme)');
        }
        
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
    
    // MEMORY LEAK ÖNLEME: Tüm transcript geçmişini temizle
    this.transcripts = [];
    this.processedWords.clear();
    console.log('🧹 [SPEECH] Tüm resource\'lar temizlendi');
  }

  /**
   * Transcript geçmişini temizle (memory leak önleme)
   */
  clearTranscripts(): void {
    this.transcripts = [];
    console.log('🧹 [SPEECH] Tüm transcript geçmişi temizlendi');
  }
}

export default new SpeechRecognitionService();
