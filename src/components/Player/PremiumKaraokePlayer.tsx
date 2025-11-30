import React, { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MicOff, RotateCcw, Settings, 
  Volume2, Heart, Share2, X,
  Target, Zap
} from 'lucide-react';
import speechRecognitionService from '../../services/SpeechRecognitionService';
import { dummyRecorderService } from '../../services/DummyRecorderService';
import { LyricsMatcher } from '../../engine/LyricsMatcher';
import { isAndroid } from '../../utils/platform';
import { dbAdapter } from '../../database/DatabaseAdapter';
import { VirtualLyricsDisplay } from './VirtualLyricsDisplay';
import { lyricsCache } from '../../cache/LyricsCache';
import { audioControlService } from '../../services/AudioControlService';
import { AudioControlPanel } from '../Media/AudioControlPanel';
import toast from 'react-hot-toast';

interface Props {
  lyrics: string;
  songId: number;
  songTitle: string;
  artist: string;
  audioFilePath?: string | null;
}

/**
 * Premium karaoke oynatıcı bileşeni
 * Gerçek zamanlı kelime tanıma ve eşleştirme yapar
 */
export const PremiumKaraokePlayer: React.FC<Props> = ({ lyrics, songId, songTitle, artist, audioFilePath }) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(75);
  const [favorites, setFavorites] = useState<boolean>(false);
  const [waveData, setWaveData] = useState<number[]>(Array(50).fill(0));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showAudioPanel, setShowAudioPanel] = useState<boolean>(false);
  
  const matcherRef = useRef<LyricsMatcher>(new LyricsMatcher());
  const lyricsRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);
  const [useVirtualDisplay, setUseVirtualDisplay] = useState<boolean>(false);
  
  // Matcher'a pozisyon değişikliği callback'i ayarla
  useEffect(() => {
    matcherRef.current.setOnPositionChange((newPosition: number) => {
      flushSync(() => {
        setCurrentWordIndex(newPosition);
        setAccuracy(Math.round(matcherRef.current.getAccuracy() * 100));
      });
    });
  }, []);

  // Cache'i başlat
  useEffect(() => {
    lyricsCache.initialize().catch(console.error);
  }, []);

  const words: string[] = lyrics.split(/\s+/).filter((w: string) => w.trim());

  // Uzun şarkılar için virtual display kullan (500+ kelime)
  useEffect(() => {
    if (words.length > 500) {
      setUseVirtualDisplay(true);
    }
  }, [words.length]);

  // Şarkı sözlerini ayarla
  useEffect(() => {
    console.log('Lyrics ayarlanıyor:', lyrics.substring(0, 100) + '...');
    matcherRef.current.setLyrics(lyrics);
    setCurrentWordIndex(0);
    setAccuracy(0);
    console.log('Lyrics ayarlandı, kelime sayısı:', words.length);
  }, [lyrics]);

  // Ses Dalga Animasyonu
  useEffect(() => {
    if (isListening) {
      const interval = setInterval(() => {
        setWaveData(Array(50).fill(0).map(() => Math.random() * 100));
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isListening]);

  // Kelime Takibi ve Otomatik Scroll - UZUN ŞARKI SÖZLERİ İÇİN OPTİMİZE
  useEffect(() => {
    if (lyricsRef.current && currentWordIndex >= 0) {
      // Scroll işlemini requestAnimationFrame ile optimize et
      requestAnimationFrame(() => {
        const element = lyricsRef.current?.querySelector(`[data-index="${currentWordIndex}"]`);
        if (element && lyricsRef.current) {
          // Element'in pozisyonunu hesapla
          const container = lyricsRef.current;
          const elementRect = element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // Element container'ın görünür alanında mı kontrol et
          const isVisible = (
            elementRect.top >= containerRect.top &&
            elementRect.bottom <= containerRect.bottom
          );

          // Eğer görünür alanda değilse scroll yap
          if (!isVisible) {
            // Element'i container'ın ortasına getir
            const elementOffsetTop = (element as HTMLElement).offsetTop;
            const containerHeight = container.clientHeight;
            const elementHeight = elementRect.height;
            
            // Ortalama scroll pozisyonu hesapla
            const targetScrollTop = elementOffsetTop - (containerHeight / 2) + (elementHeight / 2);
            
            // Smooth scroll
            container.scrollTo({
              top: targetScrollTop,
              behavior: 'smooth'
            });
          } else {
            // Görünür alandaysa, sadece hafif ayarlama yap (mikro-optimizasyon)
            const margin = 50; // 50px margin
            if (elementRect.top < containerRect.top + margin) {
              container.scrollBy({
                top: elementRect.top - containerRect.top - margin,
                behavior: 'smooth'
              });
            } else if (elementRect.bottom > containerRect.bottom - margin) {
              container.scrollBy({
                top: elementRect.bottom - containerRect.bottom + margin,
                behavior: 'smooth'
              });
            }
          }
        }
      });
    }
  }, [currentWordIndex]);

  // Kelime algılama callback'i - ANLIK İŞARETLEME (HER KELİME İÇİN GÜNCELLE)
  const handleWordDetected = useCallback((word: string, confidence: number): void => {
    // Anında işle - gecikme yok
    const match = matcherRef.current.processWord(word, confidence);
    
    // HER ZAMAN match döner (yanlış olsa bile) - anlık işaretleme için
    if (match) {
      const newPosition = matcherRef.current.currentPosition;
      const newAccuracy = Math.round(matcherRef.current.getAccuracy() * 100);
      
      // ANLIK İŞARETLEME - Her kelime için state'i güncelle
      // flushSync ile anında DOM güncellemesi - anlık görsel geri bildirim
      flushSync(() => {
        setCurrentWordIndex(newPosition);
        setAccuracy(newAccuracy);
      });
    }
  }, []);

  // Müzik dosyasını yükle
  useEffect(() => {
    if (audioFilePath) {
      audioControlService.loadSong(audioFilePath).catch((error) => {
        console.error('Müzik yükleme hatası:', error);
      });
    }
  }, [audioFilePath]);

  // Karaoke başlat
  const startKaraoke = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 1. Mikrofon izni kontrolü - MOBİL TARAYICI İÇİN ÖZEL YÖNTEM
      console.log('🎤 [PLAYER] Mikrofon izni isteniyor...');
      
      // MOBİL TARAYICI İÇİN: Daha detaylı audio constraints
      // Telefon görüşmesi gibi kesintisiz çalışması için optimize edilmiş ayarlar
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true, // Yankı iptali - telefon görüşmesi gibi
        noiseSuppression: true, // Gürültü bastırma
        autoGainControl: true, // Otomatik ses seviyesi
        sampleRate: 44100, // Yüksek kalite
        channelCount: 1, // Mono
      };
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: audioConstraints 
        });
        console.log('✅ [PLAYER] Mikrofon izni verildi! Stream aktif:', stream.active);
        
        // Stream'in aktif olduğunu kontrol et
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error('Mikrofon stream\'inde audio track bulunamadı');
        }
        
        // Track'in enabled olduğunu kontrol et
        const audioTrack = audioTracks[0];
        if (!audioTrack.enabled) {
          audioTrack.enabled = true;
        }
        
        console.log('✅ [PLAYER] Audio track durumu:', {
          enabled: audioTrack.enabled,
          readyState: audioTrack.readyState,
          label: audioTrack.label,
          muted: audioTrack.muted
        });
        
        // Stream'i global olarak sakla (gerekirse)
        (window as any).__microphoneStream = stream;
        
      } catch (error: any) {
        console.error('❌ [PLAYER] Mikrofon izni hatası:', error);
        
        // Detaylı hata mesajı
        let errorMessage = 'Mikrofon erişimi reddedildi';
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Mikrofon izni reddedildi. Lütfen tarayıcı ayarlarından mikrofon iznini verin.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'Mikrofon bulunamadı. Lütfen cihazınızda mikrofon olduğundan emin olun.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = 'Mikrofon başka bir uygulama tarafından kullanılıyor. Lütfen diğer uygulamaları kapatın.';
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
          errorMessage = 'Mikrofon ayarları desteklenmiyor. Daha basit ayarlarla tekrar deniyoruz...';
          // Daha basit constraints ile tekrar dene
          try {
            const simpleStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('✅ [PLAYER] Basit constraints ile mikrofon açıldı');
            (window as any).__microphoneStream = simpleStream;
          } catch (simpleError) {
            throw new Error(errorMessage);
          }
        } else {
          errorMessage = `Mikrofon hatası: ${error.message || error.name}`;
        }
        
        throw new Error(errorMessage);
      }

      // 2. Veritabanını başlat
      await dbAdapter.initialize();

      // 3. DUMMY RECORDER başlat - SADECE NATIVE ANDROID APP İÇİN
      // Web sitesinden (GitHub Pages) çalışıyorsa Capacitor yok, bu yüzden çalışmaz
      // Bu Android'e "ses kaydediyorum" sinyali verir, böylece mikrofon kapanmaz
      if (isAndroid()) {
        try {
          console.log('📱 [PLAYER] Native Android app tespit edildi - Dummy recorder başlatılıyor...');
          await dummyRecorderService.start();
          // 1 saniye bekle - Android'in "kayıt modunu" anlaması için
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('✅ [PLAYER] Dummy recorder başlatıldı - Android mikrofonu kapanmayacak');
        } catch (dummyError) {
          console.error('❌ [PLAYER] Dummy recorder başlatılamadı:', dummyError);
          // Dummy recorder olmadan da devam et
        }
      } else {
        console.log('🌐 [PLAYER] Web sitesi tespit edildi - Dummy recorder gerek yok (mikrofon zaten stabil)');
      }

      // 4. Müzik varsa oynat
      if (audioFilePath) {
        try {
          await audioControlService.loadSong(audioFilePath);
          audioControlService.play();
        } catch (error) {
          console.warn('Müzik oynatılamadı:', error);
        }
      }

      // 5. Konuşma tanımayı başlat - HER PLATFORMDA ÇALIŞIR (Web ve Android)
      console.log('🎤 [PLAYER] Speech Recognition başlatılıyor...');
      await speechRecognitionService.initialize(handleWordDetected);
      console.log('✅ [PLAYER] Speech Recognition başlatıldı - Mikrofon aktif!');
      
      matcherRef.current.reset();
      setCurrentWordIndex(0);
      setAccuracy(0);
      startTimeRef.current = Date.now();
      setIsListening(true);
      
      toast.success('🎤 Karaoke başlatıldı!', {
        duration: 2000,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen hata';
      setError(errorMessage);
      dbAdapter.logError('MICROPHONE_ACCESS_DENIED', errorMessage);
      toast.error(`Hata: ${errorMessage}`);
      
      // Hata olursa dummy recorder'ı da durdur - SADECE ANDROID'DE
      if (isAndroid()) {
        try {
          await dummyRecorderService.stop();
        } catch (e) {
          // Ignore
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [handleWordDetected, audioFilePath]);

  // Karaoke durdur
  const stopKaraoke = useCallback(async (): Promise<void> => {
    setIsListening(false);
    
    // 1. Önce Speech Recognition durdur
    speechRecognitionService.stop();
    
    // 2. Müziği durdur
    audioControlService.stop();
    
    // 3. Dummy recorder'ı durdur - SADECE ANDROID'DE
    if (isAndroid()) {
      try {
        await dummyRecorderService.stop();
        console.log('✅ [PLAYER] Dummy recorder durduruldu (Android)');
      } catch (error) {
        console.error('❌ [PLAYER] Dummy recorder durdurulamadı:', error);
      }
    }
    
    // 4. Performans kaydet
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const finalAccuracy = matcherRef.current.getAccuracy();
    
    try {
      await dbAdapter.savePerformance(songId, finalAccuracy, duration);
      toast.success(`Performans kaydedildi! Doğruluk: %${Math.round(finalAccuracy * 100)}`);
    } catch (err) {
      console.error('Performans kaydedilemedi:', err);
    }
  }, [songId]);

  // Kelime stilini belirle
  const getWordStyle = useCallback((index: number): string => {
    if (index < currentWordIndex) {
      return 'text-green-400 bg-green-400/10 border-green-400/30';
    } else if (index === currentWordIndex) {
      return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50 scale-105 sm:scale-110 shadow-lg shadow-yellow-400/20 font-bold';
    }
    return 'text-gray-400/60 border-transparent';
  }, [currentWordIndex]);

  // Sıfırla
  const handleReset = useCallback((): void => {
    matcherRef.current.reset();
    setCurrentWordIndex(0);
    setAccuracy(0);
    audioControlService.stop();
    // Dummy recorder aktifse durdurma, sadece reset yap
  }, []);

  // Cleanup - component unmount olduğunda
  useEffect(() => {
    return () => {
      // Component kapanırken tüm servisleri temizle
      if (isListening) {
        speechRecognitionService.stop();
        // Cleanup - SADECE ANDROID'DE
        if (isAndroid()) {
          dummyRecorderService.stop().catch(console.error);
        }
      }
    };
  }, [isListening]);

  return (
    <div className="min-h-screen relative">
      {/* Fullscreen Glass Panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative bg-gray-900/60 backdrop-blur-2xl border border-white/10 rounded-2xl sm:rounded-3xl m-2 sm:m-4 overflow-hidden"
      >
        {/* Üst Bilgi Barı */}
        <div className="relative p-3 sm:p-4 md:p-6 border-b border-white/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <motion.h2 
                className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent truncate"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
              >
                {songTitle}
              </motion.h2>
              <motion.p 
                className="text-sm sm:text-base text-gray-400 truncate"
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1, transition: { delay: 0.1 } }}
              >
                {artist}
              </motion.p>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {/* Müzik Kontrol Paneli Toggle */}
              {audioFilePath && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowAudioPanel(!showAudioPanel)}
                  className="p-2 sm:p-3 bg-white/5 rounded-xl border border-white/10 relative"
                >
                  <Volume2 className={`w-4 h-4 sm:w-5 sm:h-5 ${showAudioPanel ? 'text-purple-400' : 'text-gray-400'}`} />
                  {showAudioPanel && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute inset-0 bg-purple-500/20 rounded-xl"
                    />
                  )}
                </motion.button>
              )}
              
              {/* Favori */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setFavorites(!favorites)}
                className="p-2 sm:p-3 bg-white/5 rounded-xl border border-white/10"
              >
                <Heart className={`w-4 h-4 sm:w-5 sm:h-5 ${favorites ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
              </motion.button>
              
              {/* Paylaş */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 sm:p-3 bg-white/5 rounded-xl border border-white/10"
              >
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              </motion.button>
              
              {/* Ayarlar */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 sm:p-3 bg-white/5 rounded-xl border border-white/10"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Hata Mesajı */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-6 mt-4 p-4 bg-red-600/20 border border-red-600 rounded-lg text-red-300"
          >
            {error}
          </motion.div>
        )}

        {/* Ana Içerik */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6 p-3 sm:p-4 md:p-6">
          {/* Sol Panel - İstatistikler */}
          <motion.div 
            className="lg:col-span-1 space-y-3 sm:space-y-4 order-2 lg:order-1"
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1, transition: { delay: 0.2 } }}
          >
            {/* Accuracy Kartı */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-green-500/30 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-green-500/20 rounded-full blur-2xl" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-green-400 text-xs sm:text-sm font-semibold">DOĞRULUK</p>
                  <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">{accuracy}%</p>
                </div>
                <Target className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 text-green-400 flex-shrink-0" />
              </div>
            </motion.div>

            {/* Progress Kartı */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-purple-500/30 overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-purple-500/20 rounded-full blur-2xl" />
              <div className="relative">
                <p className="text-purple-400 text-xs sm:text-sm font-semibold">İLERLEME</p>
                <p className="text-xl sm:text-2xl font-bold text-white mb-2">{currentWordIndex}/{words.length}</p>
                <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    animate={{ width: `${(currentWordIndex / words.length) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 100 }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Ses Seviyesi */}
            {isListening && (
              <div className="bg-white/5 backdrop-blur rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <span className="text-xs sm:text-sm font-semibold text-white">MİKROFON SEVİYESİ</span>
                </div>
                <div className="relative h-16 sm:h-20 bg-gray-800/50 rounded-lg overflow-hidden">
                  {waveData.map((height: number, i: number) => (
                    <motion.div
                      key={i}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 0.1 }}
                      className="absolute bottom-0 w-0.5 sm:w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-t-full"
                      style={{ left: `${i * 2}%` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Ses Kontrol Paneli */}
            <AnimatePresence>
              {showAudioPanel && audioFilePath && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: 'spring', stiffness: 100 }}
                  className="overflow-hidden"
                >
                  <AudioControlPanel songFilePath={audioFilePath} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Orta Panel - Şarkı Sözleri */}
          <motion.div 
            className="lg:col-span-2 order-1 lg:order-2"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { delay: 0.3 } }}
          >
            <div className="relative bg-gray-800/50 backdrop-blur rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 border border-white/10 h-64 sm:h-80 md:h-96 overflow-hidden">
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-gray-900/0 via-gray-900/20 to-gray-900/80 pointer-events-none z-10" />
              
              {/* Virtual Display (500+ kelime için) veya Normal Display */}
              {useVirtualDisplay ? (
                <div className="relative h-full z-20">
                  <VirtualLyricsDisplay
                    words={words}
                    currentIndex={currentWordIndex}
                    matchedWords={matcherRef.current.matchedWordsList.map((m, i) => 
                      m ? {
                        original: m.original,
                        detected: m.detected,
                        confidence: m.confidence,
                        isCorrect: m.isCorrect,
                        isSkipped: false,
                        timestamp: m.timestamp,
                        index: i
                      } : null
                    )}
                  />
                </div>
              ) : (
                <div 
                  ref={lyricsRef}
                  className="relative h-full overflow-y-auto custom-scrollbar pr-2 sm:pr-4 z-20"
                >
                  <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl leading-relaxed sm:leading-relaxed font-medium">
                    {words.map((word: string, index: number) => {
                      const isActive = index === currentWordIndex;
                      return (
                        <motion.span
                          key={`${word}-${index}`}
                          data-index={index}
                          animate={isActive ? {
                            scale: [1, 1.15, 1],
                            textShadow: ['0 0 0px rgba(251, 191, 36, 0)', '0 0 20px rgba(251, 191, 36, 1)', '0 0 0px rgba(251, 191, 36, 0)'],
                          } : {}}
                          transition={{ duration: 0.3 }}
                          className={`inline-block mr-1 sm:mr-2 mb-1 sm:mb-2 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg border transition-all duration-200 ${getWordStyle(index)}`}
                        >
                          {word}
                        </motion.span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Kontrol Butonları */}
            <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4 mt-4 sm:mt-6 md:mt-8">
              {!isListening ? (
                <motion.button
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={startKaraoke}
                  disabled={isLoading}
                  className="relative w-full sm:w-auto px-8 sm:px-10 md:px-12 py-3 sm:py-3.5 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl sm:rounded-3xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 sm:gap-3 shadow-2xl shadow-purple-600/40 hover:shadow-purple-600/60 transition-all disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                  <span>{isLoading ? 'Yükleniyor...' : 'KARAOKE BAŞLAT'}</span>
                  {/* Pulse Effect */}
                  {!isLoading && (
                    <motion.div
                      animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl sm:rounded-3xl"
                      style={{ zIndex: -1 }}
                    />
                  )}
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={stopKaraoke}
                  className="relative w-full sm:w-auto px-8 sm:px-10 md:px-12 py-3 sm:py-3.5 md:py-4 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl sm:rounded-3xl font-bold text-base sm:text-lg flex items-center justify-center gap-2 sm:gap-3 shadow-2xl shadow-red-600/40"
                >
                  <MicOff className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span>DURDUR</span>
                </motion.button>
              )}
              
              <motion.button
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleReset}
                className="w-full sm:w-auto p-3 sm:p-4 bg-white/10 rounded-2xl sm:rounded-3xl border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center"
              >
                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Ayarlar Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-6"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="relative max-w-md w-full bg-gray-900/90 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-white/10 mx-4"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Ayarlar</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Ayarlar İçeriği */}
              <div className="space-y-6">
                {/* Mikrofon Hassasiyeti */}
                <div>
                  <label className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Mikrofon Hassasiyeti</span>
                    <span className="text-purple-400">{volume}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer slider"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

