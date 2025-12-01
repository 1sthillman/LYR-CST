import React, { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MicOff, RotateCcw, Settings, 
  Volume2, Heart, Share2, X,
  Target, Zap, Bug, Hand
} from 'lucide-react';
import speechRecognitionService from '../../services/SpeechRecognitionService';
import nativeSpeechRecognitionService from '../../services/NativeSpeechRecognitionService';
import { dummyRecorderService } from '../../services/DummyRecorderService';
import { audioContextService } from '../../services/AudioContextService';
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
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [modeSelected, setModeSelected] = useState<boolean>(false); // Mod seçildi mi?
  
  // Debug logları için
  const debugLogsRef = useRef<string[]>([]);
  const maxDebugLogs = 1000; // Maksimum 1000 log sakla
  
  const matcherRef = useRef<LyricsMatcher>(new LyricsMatcher());
  const lyricsRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);
  const [useVirtualDisplay, setUseVirtualDisplay] = useState<boolean>(false);
  
  // Mikrofon analizi için refs
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
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

  // Debug log ekle - ÖNCE TANIMLA (console override'tan önce)
  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    debugLogsRef.current.push(logEntry);
    
    // Maksimum log sayısını aşarsa eski logları sil
    if (debugLogsRef.current.length > maxDebugLogs) {
      debugLogsRef.current = debugLogsRef.current.slice(-maxDebugLogs);
    }
    
    // KRİTİK: Native Speech Recognition loglarını HER ZAMAN console'a da yaz (karaoke başlamadan önce de)
    if (message.includes('[NATIVE SPEECH]') || message.includes('[PLAYER]') || message.includes('[SPEECH]')) {
      const originalLog = (window as any).__originalConsoleLog || console.log;
      originalLog(logEntry);
    }
  }, []);

  // Console override'ı EN ERKEN BAŞLAT - Component mount olduğunda hemen
  useEffect(() => {
    // Orijinal console metodlarını sakla (sadece bir kez - global)
    if (!(window as any).__originalConsoleLog) {
      (window as any).__originalConsoleLog = console.log.bind(console);
      (window as any).__originalConsoleError = console.error.bind(console);
      (window as any).__originalConsoleWarn = console.warn.bind(console);
      (window as any).__originalConsoleInfo = console.info.bind(console);
      (window as any).__originalConsoleDebug = console.debug.bind(console);
      
      // İlk log - console override başladı
      (window as any).__originalConsoleLog('🔧 [DEBUG] Console override başlatıldı - Tüm loglar yakalanacak');
    }

    const originalLog = (window as any).__originalConsoleLog;
    const originalError = (window as any).__originalConsoleError;
    const originalWarn = (window as any).__originalConsoleWarn;
    const originalInfo = (window as any).__originalConsoleInfo;
    const originalDebug = (window as any).__originalConsoleDebug;

    // Helper function to format log message
    const formatLogMessage = (args: any[]): string => {
      return args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
          try {
            // Circular reference kontrolü
            const seen = new WeakSet();
            return JSON.stringify(arg, (_key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) {
                  return '[Circular]';
                }
                seen.add(value);
              }
              return value;
            }, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
    };

    // Console.log override - HER ZAMAN AKTİF (karaoke açık/kapalı fark etmez - TÜM LOGLARI YAKALA)
    console.log = (...args: any[]) => {
      originalLog.apply(console, args);
      const logMessage = formatLogMessage(args);
      // HER ZAMAN log ekle - isListening kontrolü yok
      addDebugLog(`[LOG] ${logMessage}`);
    };

    // Console.error override - HER ZAMAN AKTİF
    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      const logMessage = formatLogMessage(args);
      // HER ZAMAN log ekle - isListening kontrolü yok
      addDebugLog(`[ERROR] ${logMessage}`);
    };

    // Console.warn override - HER ZAMAN AKTİF
    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      const logMessage = formatLogMessage(args);
      // HER ZAMAN log ekle - isListening kontrolü yok
      addDebugLog(`[WARN] ${logMessage}`);
    };

    // Console.info override - HER ZAMAN AKTİF
    console.info = (...args: any[]) => {
      originalInfo.apply(console, args);
      const logMessage = formatLogMessage(args);
      // HER ZAMAN log ekle - isListening kontrolü yok
      addDebugLog(`[INFO] ${logMessage}`);
    };

    // Console.debug override - HER ZAMAN AKTİF
    console.debug = (...args: any[]) => {
      originalDebug.apply(console, args);
      const logMessage = formatLogMessage(args);
      // HER ZAMAN log ekle - isListening kontrolü yok
      addDebugLog(`[DEBUG] ${logMessage}`);
    };

    // İlk log - console override aktif
    originalLog('🔧 [DEBUG] Console override aktif - Tüm loglar yakalanıyor');
    // Test logu - console override'ın çalıştığını doğrula
    addDebugLog('[SYSTEM] Console override başlatıldı - Tüm loglar yakalanacak');

    // Cleanup yapma - console override kalıcı olmalı
    return () => {
      // Cleanup yapmıyoruz - console override kalıcı
    };
  }, [addDebugLog]);

  const words: string[] = lyrics.split(/\s+/).filter((w: string) => w.trim());

  // Debug loglarını kopyala
  const copyDebugLogs = useCallback(async () => {
    try {
      // BÖCEK BUTONUNA TIKLANDIĞINDA ANLIK TEST LOGU EKLE
      const testTimestamp = new Date().toISOString();
      addDebugLog(`[TEST] 🐛 Böcek butonuna tıklandı! Timestamp: ${testTimestamp}`);
      console.log('🐛 [TEST] Böcek butonuna tıklandı - Bu log görünüyorsa console override çalışıyor!');
      console.error('🐛 [TEST ERROR] Bu bir test error logu - görünüyorsa console.error override çalışıyor!');
      console.warn('🐛 [TEST WARN] Bu bir test warn logu - görünüyorsa console.warn override çalışıyor!');
      
      // Biraz bekle - logların eklenmesi için
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = debugLogsRef.current.join('\n');
      
      // Ek bilgiler
      const recognition = (speechRecognitionService as any).recognition;
      const recognitionLang = recognition?.lang || 'unknown';
      const recognitionState = recognition?.state || 'unknown';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const userAgent = navigator.userAgent;
      const platform = isMobile ? 'MOBİL' : 'PC';
      
      // Mikrofon stream durumu
      const stream = (window as any).__microphoneStream as MediaStream | undefined;
      const streamStatus = stream ? 'AKTİF' : 'YOK';
      const audioTracks = stream?.getAudioTracks() || [];
      
      const debugInfo = `=== KARAOKE DEBUG LOGS ===
Şarkı: ${songTitle}
Sanatçı: ${artist}
Dinleme Durumu: ${isListening ? 'AÇIK' : 'KAPALI'}
Pozisyon: ${currentWordIndex}/${words.length}
Doğruluk: ${accuracy}%
Platform: ${platform}
User Agent: ${userAgent}
Recognition Lang: ${recognitionLang}
Recognition State: ${recognitionState}
Mikrofon Stream: ${streamStatus}
Audio Tracks: ${audioTracks.length}
Toplam Log Sayısı: ${debugLogsRef.current.length}
Son Log Zamanı: ${testTimestamp}

=== CONSOLE LOGS ===
${logs || '(Henüz log yok)'}

=== SON ===`;
      
      // Clipboard API kullan
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(debugInfo);
        toast.success(`🐛 ${debugLogsRef.current.length} adet debug logu kopyalandı!`, { duration: 3000 });
      } else {
        // Fallback: Textarea kullan
        const textarea = document.createElement('textarea');
        textarea.value = debugInfo;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
          document.execCommand('copy');
          toast.success(`🐛 ${debugLogsRef.current.length} adet debug logu kopyalandı!`, { duration: 3000 });
        } catch (e) {
          toast.error('Debug logları kopyalanamadı. Lütfen manuel olarak kopyalayın.');
        }
        document.body.removeChild(textarea);
      }
    } catch (error) {
      console.error('Debug logları kopyalanamadı:', error);
      toast.error('Debug logları kopyalanamadı');
    }
  }, [songTitle, artist, isListening, currentWordIndex, words.length, accuracy]);

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

  // Debug loglarını topla - Component mount olduğunda başlat (karaoke başlamadan önce)
  useEffect(() => {
    // Orijinal console metodlarını sakla (sadece bir kez)
    if (!(window as any).__originalConsoleLog) {
      (window as any).__originalConsoleLog = console.log;
      (window as any).__originalConsoleError = console.error;
      (window as any).__originalConsoleWarn = console.warn;
      (window as any).__originalConsoleInfo = console.info;
      (window as any).__originalConsoleDebug = console.debug;
    }

    const originalLog = (window as any).__originalConsoleLog;
    const originalError = (window as any).__originalConsoleError;
    const originalWarn = (window as any).__originalConsoleWarn;
    const originalInfo = (window as any).__originalConsoleInfo;
    const originalDebug = (window as any).__originalConsoleDebug;

    // Helper function to format log message
    const formatLogMessage = (args: any[]): string => {
      return args.map(arg => {
        if (arg === null) return 'null';
        if (arg === undefined) return 'undefined';
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
    };

    // Console.log override - HER ZAMAN AKTİF (karaoke başlamadan önce de logla)
    console.log = (...args: any[]) => {
      originalLog.apply(console, args);
      const logMessage = formatLogMessage(args);
      // KRİTİK: Native Speech Recognition loglarını HER ZAMAN ekle (karaoke başlamadan önce de)
      if (logMessage.includes('[NATIVE SPEECH]') || logMessage.includes('[PLAYER]') || logMessage.includes('[SPEECH]') || logMessage.includes('[MATCHER]') || isListening) {
        addDebugLog(`[LOG] ${logMessage}`);
      }
    };

    // Console.error override - HER ZAMAN AKTİF (karaoke başlamadan önce de logla)
    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      const logMessage = formatLogMessage(args);
      // KRİTİK: Native Speech Recognition hatalarını HER ZAMAN ekle
      if (logMessage.includes('[NATIVE SPEECH]') || logMessage.includes('[PLAYER]') || logMessage.includes('[SPEECH]') || logMessage.includes('[MATCHER]') || isListening) {
        addDebugLog(`[ERROR] ${logMessage}`);
      }
    };

    // Console.warn override - HER ZAMAN AKTİF (karaoke başlamadan önce de logla)
    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      const logMessage = formatLogMessage(args);
      // KRİTİK: Native Speech Recognition uyarılarını HER ZAMAN ekle
      if (logMessage.includes('[NATIVE SPEECH]') || logMessage.includes('[PLAYER]') || logMessage.includes('[SPEECH]') || logMessage.includes('[MATCHER]') || isListening) {
        addDebugLog(`[WARN] ${logMessage}`);
      }
    };

    // Console.info override - HER ZAMAN AKTİF
    console.info = (...args: any[]) => {
      originalInfo.apply(console, args);
      if (isListening) {
        const logMessage = formatLogMessage(args);
        addDebugLog(`[INFO] ${logMessage}`);
      }
    };

    // Console.debug override - HER ZAMAN AKTİF
    console.debug = (...args: any[]) => {
      originalDebug.apply(console, args);
      if (isListening) {
        const logMessage = formatLogMessage(args);
        addDebugLog(`[DEBUG] ${logMessage}`);
      }
    };

    // Karaoke kapalıyken logları temizle
    if (!isListening) {
      debugLogsRef.current = [];
    }

    // Cleanup - component unmount olduğunda restore etme (diğer componentler de kullanabilir)
    return () => {
      // Sadece karaoke kapalıyken restore etme, çünkü diğer componentler de console kullanıyor olabilir
      // Restore işlemini component unmount'ta yapmıyoruz
    };
  }, [isListening, addDebugLog]);

  // Gerçek Zamanlı Mikrofon Analizi - Web Audio API ile
  useEffect(() => {
    if (!isListening) {
      // Mikrofon kapalıysa analizi durdur
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setWaveData(Array(50).fill(0));
      return;
    }

    // Mikrofon stream'ini al
    const stream = (window as any).__microphoneStream as MediaStream | undefined;
    if (!stream) {
      console.warn('⚠️ [PLAYER] Mikrofon stream bulunamadı, görselleştirme devre dışı');
      return;
    }

    try {
      // AudioContext oluştur (eğer yoksa)
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }

      const audioContext = audioContextRef.current;
      
      // AnalyserNode oluştur
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256; // Frekans çözünürlüğü (128 barlar için yeterli)
      analyser.smoothingTimeConstant = 0.8; // Yumuşak geçişler için
      analyserRef.current = analyser;

      // Mikrofon stream'ini AudioContext'e bağla
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Frekans verilerini almak için buffer
      const bufferLength = analyser.frequencyBinCount; // 128 (fftSize / 2)
      const dataArray = new Uint8Array(bufferLength);

      // Gerçek zamanlı analiz fonksiyonu
      const analyze = () => {
        if (!isListening || !analyserRef.current) {
          return;
        }

        // Frekans verilerini al
        analyserRef.current.getByteFrequencyData(dataArray);

        // 50 bar için verileri normalize et ve güncelle
        const bars = 50;
        const step = Math.floor(bufferLength / bars);
        const newWaveData: number[] = [];

        for (let i = 0; i < bars; i++) {
          const index = i * step;
          const value = dataArray[index] || 0;
          // 0-255 arası değeri 0-100 yüzdesine çevir
          const normalizedValue = (value / 255) * 100;
          // Minimum %5 yükseklik (görsel için)
          newWaveData.push(Math.max(normalizedValue, 5));
        }

        setWaveData(newWaveData);

        // Bir sonraki frame için tekrar çağır
        animationFrameRef.current = requestAnimationFrame(analyze);
      };

      // Analizi başlat
      animationFrameRef.current = requestAnimationFrame(analyze);

      // Cleanup
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        // Source'u disconnect et
        if (source) {
          try {
            source.disconnect();
          } catch (e) {
            // Ignore
          }
        }
        analyserRef.current = null;
      };
    } catch (error) {
      console.error('❌ [PLAYER] Mikrofon analizi hatası:', error);
      // Hata durumunda eski animasyonu kullan
      const interval = setInterval(() => {
        setWaveData(Array(50).fill(0).map(() => Math.random() * 30 + 10));
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
    // Manuel modda mikrofon dinlemesi çalışmamalı
    if (isManualMode) {
      return;
    }
    
    // Debug log ekle
    if (isListening) {
      addDebugLog(`[WORD DETECTED] Kelime: "${word}" | Confidence: ${confidence.toFixed(3)}`);
    }
    
    // Anında işle - gecikme yok
    const match = matcherRef.current.processWord(word, confidence);
    
    // HER ZAMAN match döner (yanlış olsa bile) - anlık işaretleme için
    if (match) {
      const newPosition = matcherRef.current.currentPosition;
      const newAccuracy = Math.round(matcherRef.current.getAccuracy() * 100);
      
      // Debug log ekle
      if (isListening) {
        addDebugLog(`[MATCH] Eşleşme: "${match.detected}" -> "${match.original}" | Doğru: ${match.isCorrect} | Confidence: ${match.confidence.toFixed(3)} | Pozisyon: ${newPosition}`);
      }
      
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
      
      // 1. Mikrofon izni kontrolü - SADECE KONUŞARAK MODUNDA
      if (!isManualMode) {
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
          console.log('📱 [PLAYER] Stream ID:', stream.id);
          console.log('📱 [PLAYER] Stream active:', stream.active);
          
          // Audio tracks detaylı bilgi
          const audioTracks = stream.getAudioTracks();
          console.log('📱 [PLAYER] Audio tracks sayısı:', audioTracks.length);
          audioTracks.forEach((track, index) => {
            console.log(`📱 [PLAYER] Audio track[${index}]:`, {
              id: track.id,
              kind: track.kind,
              label: track.label,
              enabled: track.enabled,
              readyState: track.readyState,
              muted: track.muted,
              settings: track.getSettings()
            });
          });
          
          // Stream'in aktif olduğunu kontrol et
          const streamAudioTracks = stream.getAudioTracks();
          if (streamAudioTracks.length === 0) {
            throw new Error('Mikrofon stream\'inde audio track bulunamadı');
          }
          
          // Track'in enabled olduğunu kontrol et
          const audioTrack = streamAudioTracks[0];
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

        // 2. AudioContext başlat (Android 10+ için kritik - suspended yönetimi)
        await audioContextService.initialize();
        console.log('✅ [PLAYER] AudioContext başlatıldı - suspended monitoring aktif');

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
      } else {
        console.log('👆 [PLAYER] Manuel işaretleme modu - Mikrofon izni istenmeyecek');
      }

      // 3. Veritabanını başlat
      await dbAdapter.initialize();

      // 5. Müzik varsa oynat
      if (audioFilePath) {
        try {
          await audioControlService.loadSong(audioFilePath);
          audioControlService.play();
        } catch (error) {
          console.warn('Müzik oynatılamadı:', error);
        }
      }

      // 6. Konuşma tanımayı başlat - SADECE KONUŞARAK MODUNDA
      if (!isManualMode) {
        console.log('🎤 [PLAYER] Speech Recognition başlatılıyor...');
        addDebugLog('[LOG] 🎤 [PLAYER] Speech Recognition başlatılıyor...');
        
        // Android WebView tespit et - Web Speech API çalışmıyor
        const isAndroidWebView = /Android.*wv/i.test(navigator.userAgent);
        const hasCapacitor = !!(window as any).Capacitor;
        const isNativeAndroid = hasCapacitor && (window as any).Capacitor.getPlatform() === 'android';
        const hasAndroidBridge = !!(window as any).AndroidSpeechBridge;
        
        // Web Speech API kontrolü - Android WebView'de de çalışabilir
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const hasWebSpeechAPI = !!SpeechRecognition;
        
        console.log('🔍 [PLAYER] Platform tespiti:');
        console.log('🔍 [PLAYER] User Agent:', navigator.userAgent);
        console.log('🔍 [PLAYER] isAndroidWebView:', isAndroidWebView);
        console.log('🔍 [PLAYER] hasCapacitor:', hasCapacitor);
        console.log('🔍 [PLAYER] isNativeAndroid:', isNativeAndroid);
        console.log('🔍 [PLAYER] AndroidSpeechBridge var mı:', hasAndroidBridge);
        console.log('🔍 [PLAYER] Web Speech API var mı:', hasWebSpeechAPI);
        console.log('🔍 [PLAYER] SpeechRecognition type:', typeof SpeechRecognition);
        console.log('🔍 [PLAYER] window.SpeechRecognition:', typeof (window as any).SpeechRecognition);
        console.log('🔍 [PLAYER] window.webkitSpeechRecognition:', typeof (window as any).webkitSpeechRecognition);
        addDebugLog(`[LOG] 🔍 [PLAYER] Platform tespiti: isAndroidWebView=${isAndroidWebView}, hasCapacitor=${hasCapacitor}, isNativeAndroid=${isNativeAndroid}, AndroidSpeechBridge=${hasAndroidBridge}, WebSpeechAPI=${hasWebSpeechAPI}`);
        
        // KRİTİK DEĞİŞİKLİK: ÖNCE Web Speech API'yi dene (Web'de çalışıyor, mobilde de çalışabilir)
        // Eğer çalışmazsa Native Android Speech Recognition'a geç
        const shouldTryWebSpeechFirst = hasWebSpeechAPI && (isAndroidWebView || isNativeAndroid);
        console.log('🔍 [PLAYER] shouldTryWebSpeechFirst:', shouldTryWebSpeechFirst, '| hasWebSpeechAPI:', hasWebSpeechAPI, '| isAndroidWebView:', isAndroidWebView, '| isNativeAndroid:', isNativeAndroid);
        addDebugLog(`[LOG] 🔍 [PLAYER] shouldTryWebSpeechFirst=${shouldTryWebSpeechFirst} | hasWebSpeechAPI=${hasWebSpeechAPI} | isAndroidWebView=${isAndroidWebView} | isNativeAndroid=${isNativeAndroid}`);
        
        if (shouldTryWebSpeechFirst) {
          // ANDROID WEBVIEW + Web Speech API VAR: Önce Web Speech API'yi dene
          console.log('🌐 [PLAYER] ⚡⚡⚡ Android WebView tespit edildi AMA Web Speech API var - ÖNCE Web Speech API deneniyor... ⚡⚡⚡');
          addDebugLog('[LOG] 🌐 [PLAYER] ⚡⚡⚡ Android WebView tespit edildi AMA Web Speech API var - ÖNCE Web Speech API deneniyor... ⚡⚡⚡');
          
          try {
            // 10 saniye içinde sonuç gelmezse Native'e geç
            let webSpeechWorked = false;
            const webSpeechTimeout = setTimeout(() => {
              if (!webSpeechWorked) {
                console.warn('⚠️ [PLAYER] Web Speech API 10 saniye içinde sonuç döndürmedi - Native Speech Recognition\'a geçiliyor...');
                addDebugLog('[WARN] ⚠️ [PLAYER] Web Speech API 10 saniye içinde sonuç döndürmedi - Native Speech Recognition\'a geçiliyor...');
              }
            }, 10000);
            
            // Geçici callback - sonuç gelirse webSpeechWorked = true
            const tempCallback = (word: string, confidence: number) => {
              webSpeechWorked = true;
              clearTimeout(webSpeechTimeout);
              handleWordDetected(word, confidence);
            };
            
            await speechRecognitionService.initialize(
              tempCallback,
              async (error: Error) => {
                clearTimeout(webSpeechTimeout);
                console.error('❌ [PLAYER] Web Speech API hatası:', error);
                addDebugLog(`[ERROR] ❌ [PLAYER] Web Speech API hatası: ${error.message}`);
                
                // Fallback: Native Android Speech Recognition'a geç
                console.warn('⚠️ [PLAYER] Web Speech API çalışmadı - Native Speech Recognition\'a geçiliyor...');
                addDebugLog('[WARN] ⚠️ [PLAYER] Web Speech API çalışmadı - Native Speech Recognition\'a geçiliyor...');
                
                if (hasAndroidBridge) {
                  try {
                    await nativeSpeechRecognitionService.initialize(
                      handleWordDetected,
                      (nativeError: Error) => {
                        console.error('❌ [PLAYER] Native Speech Recognition error callback:', nativeError);
                        addDebugLog(`[ERROR] ❌ [PLAYER] Native Speech Recognition error callback: ${nativeError.message}`);
                        toast.error(nativeError.message, { duration: 3000 });
                        setError(nativeError.message);
                      }
                    );
                    console.log('✅ [PLAYER] ⚡⚡⚡ Native Android Speech Recognition başlatıldı! ⚡⚡⚡');
                    addDebugLog('[LOG] ✅ [PLAYER] ⚡⚡⚡ Native Android Speech Recognition başlatıldı! ⚡⚡⚡');
                  } catch (nativeError) {
                    const errorMsg = nativeError instanceof Error ? nativeError.message : String(nativeError);
                    console.error('❌ [PLAYER] Native Speech Recognition başlatılamadı:', nativeError);
                    addDebugLog(`[ERROR] ❌ [PLAYER] Native Speech Recognition başlatılamadı: ${errorMsg}`);
                    toast.error('Speech Recognition başlatılamadı!', { duration: 5000 });
                    setError('Speech Recognition başlatılamadı!');
                  }
                } else {
                  toast.error('Speech Recognition başlatılamadı!', { duration: 5000 });
                  setError('Speech Recognition başlatılamadı!');
                }
              }
            );
            
            console.log('✅ [PLAYER] Web Speech API başlatıldı - 10 saniye içinde sonuç bekleniyor...');
            addDebugLog('[LOG] ✅ [PLAYER] Web Speech API başlatıldı - 10 saniye içinde sonuç bekleniyor...');
          } catch (webSpeechError) {
            console.error('❌ [PLAYER] Web Speech API başlatılamadı:', webSpeechError);
            addDebugLog(`[ERROR] ❌ [PLAYER] Web Speech API başlatılamadı: ${webSpeechError}`);
            
            // Fallback: Native Android Speech Recognition'a geç
            if (hasAndroidBridge) {
              try {
                await nativeSpeechRecognitionService.initialize(
                  handleWordDetected,
                  (error: Error) => {
                    toast.error(error.message, { duration: 3000 });
                    setError(error.message);
                  }
                );
              } catch (nativeError) {
                toast.error('Speech Recognition başlatılamadı!', { duration: 5000 });
                setError('Speech Recognition başlatılamadı!');
              }
            }
          }
        } else if (isAndroidWebView || isNativeAndroid) {
          // ANDROID WEBVIEW: Web Speech API yok, Native Android Speech Recognition kullan
          console.log('📱 [PLAYER] ⚡⚡⚡ Android WebView tespit edildi - Native Speech Recognition kullanılıyor... ⚡⚡⚡');
          addDebugLog('[LOG] 📱 [PLAYER] ⚡⚡⚡ Android WebView tespit edildi - Native Speech Recognition kullanılıyor... ⚡⚡⚡');
          
          if (!hasAndroidBridge) {
            const errorMsg = '❌ [PLAYER] AndroidSpeechBridge bulunamadı! Native Android app kullanmalısınız.';
            console.error(errorMsg);
            addDebugLog(`[ERROR] ${errorMsg}`);
            toast.error('Android Speech Bridge bulunamadı!', { duration: 5000 });
            setError('Android Speech Bridge bulunamadı!');
            throw new Error('Android Speech Bridge bulunamadı!');
          }
          
          try {
            await nativeSpeechRecognitionService.initialize(
              handleWordDetected,
              (error: Error) => {
                console.error('❌ [PLAYER] Native Speech Recognition error callback:', error);
                addDebugLog(`[ERROR] ❌ [PLAYER] Native Speech Recognition error callback: ${error.message}`);
                toast.error(error.message, { duration: 3000 });
                setError(error.message);
              }
            );
            
            console.log('✅ [PLAYER] ⚡⚡⚡ Native Android Speech Recognition başlatıldı! ⚡⚡⚡');
            addDebugLog('[LOG] ✅ [PLAYER] ⚡⚡⚡ Native Android Speech Recognition başlatıldı! ⚡⚡⚡');
          } catch (nativeError) {
            const errorMsg = nativeError instanceof Error ? nativeError.message : String(nativeError);
            console.error('❌ [PLAYER] Native Speech Recognition başlatılamadı:', nativeError);
            addDebugLog(`[ERROR] ❌ [PLAYER] Native Speech Recognition başlatılamadı: ${errorMsg}`);
            toast.error('Speech Recognition başlatılamadı!', { duration: 5000 });
            setError('Speech Recognition başlatılamadı!');
          }
        } else {
          // WEB: Web Speech API kullan
          console.log('🌐 [PLAYER] Web platformu tespit edildi - Web Speech API kullanılıyor...');
          addDebugLog('[LOG] 🌐 [PLAYER] Web platformu tespit edildi - Web Speech API kullanılıyor...');
          
          await speechRecognitionService.initialize(
            handleWordDetected,
            (error: Error) => {
              toast.error(error.message, { duration: 3000 });
              setError(error.message);
            }
          );
          
          console.log('✅ [PLAYER] Web Speech API başlatıldı - Mikrofon aktif!');
          addDebugLog('[LOG] ✅ [PLAYER] Web Speech API başlatıldı - Mikrofon aktif!');
        }
      } else {
        console.log('👆 [PLAYER] Manuel işaretleme modu - Mikrofon başlatılmayacak');
        addDebugLog('[LOG] 👆 [PLAYER] Manuel işaretleme modu - Mikrofon başlatılmayacak');
      }
      
      // Debug: Karaoke başladı
      addDebugLog(`[KARAOKE START] Şarkı: ${songTitle} | Sanatçı: ${artist} | Kelime Sayısı: ${words.length}`);
      
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
  }, [handleWordDetected, audioFilePath, isManualMode]);

  // Karaoke durdur
  const stopKaraoke = useCallback(async (): Promise<void> => {
    setIsListening(false);
    setModeSelected(false); // Mod seçimini sıfırla
    
    // 1. Önce Speech Recognition durdur (hem Web hem Native)
    speechRecognitionService.stop();
    
    // Android WebView'de Native Speech Recognition da durdur
    const isAndroidWebView = /Android.*wv/i.test(navigator.userAgent);
    const hasCapacitor = !!(window as any).Capacitor;
    const isNativeAndroid = hasCapacitor && (window as any).Capacitor.getPlatform() === 'android';
    if (isAndroidWebView || isNativeAndroid) {
      try {
        nativeSpeechRecognitionService.stop();
        console.log('✅ [PLAYER] Native Speech Recognition durduruldu');
      } catch (error) {
        console.error('❌ [PLAYER] Native Speech Recognition durdurulamadı:', error);
      }
    }
    
    // 2. Müziği durdur
    audioControlService.stop();

    // 3. AudioContext monitoring durdur
    audioContextService.stopMonitoring();
    
    // 4. Dummy recorder'ı durdur - SADECE ANDROID'DE
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

  // Kelime tıklama (manuel ilerleme) - İSTEDİĞİ KELİMEYE TIKLAYABİLME
  const handleWordClick = useCallback((index: number) => {
    if (!isManualMode || !isListening) {
      return;
    }

    // İleri git - tıklanan kelimeye kadar TÜM kelimeleri işaretle
    if (index > currentWordIndex) {
      // Mevcut pozisyondan tıklanan kelimeye kadar tüm kelimeleri işaretle
      for (let i = currentWordIndex; i < index; i++) {
        const word = words[i + 1]; // Bir sonraki kelimeyi al
        if (word) {
          matcherRef.current.processWord(word, 1.0);
        }
      }
      setCurrentWordIndex(index);
      setAccuracy(Math.round(matcherRef.current.getAccuracy() * 100));
      console.log(`👆 [MANUAL] Kelime tıklandı: "${words[index]}" (index: ${index}) - ${index - currentWordIndex} kelime işaretlendi`);
    } else if (index < currentWordIndex) {
      // Geri git - tıklanan kelimeye kadar geri al
      const stepsBack = currentWordIndex - index;
      for (let i = 0; i < stepsBack; i++) {
        matcherRef.current.undoLastWord();
      }
      setCurrentWordIndex(index);
      setAccuracy(Math.round(matcherRef.current.getAccuracy() * 100));
      console.log(`👆 [MANUAL] Geri alındı (index: ${index}) - ${stepsBack} kelime geri alındı`);
    }
    // index === currentWordIndex ise hiçbir şey yapma (aynı kelimeye tekrar tıklandı)
  }, [isManualMode, isListening, currentWordIndex, words]);

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

  // Ekran arkaya alındığında bile devam et (dummy.md'deki gibi)
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.hidden && isListening) {
        console.log('📱 [PLAYER] Ekran arkaya alındı ama mikrofon AÇIK kalacak');
        // Wake Lock sayesinde mikrofon açık kalacak
      } else if (!document.hidden && isListening) {
        // Geri geldiğinde kontrol et - dummy recorder hala aktif mi?
        if (isAndroid() && !dummyRecorderService.isActive()) {
          console.warn('⚠️ [PLAYER] Mikrofon düştü, tekrar bağlanıyor...');
          toast.error('⚠️ Mikrofon düştü, tekrar bağlanıyor...', { duration: 2000 });
          try {
            await dummyRecorderService.start();
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error('❌ [PLAYER] Mikrofon tekrar bağlanamadı:', error);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
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
              
              {/* Debug/Hata Ayıklama */}
              {isListening && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={copyDebugLogs}
                  className="p-2 sm:p-3 bg-white/5 rounded-xl border border-white/10 relative"
                  title="Debug loglarını kopyala"
                >
                  <Bug className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                  {debugLogsRef.current.length > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900"
                    />
                  )}
                </motion.button>
              )}
              
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
                    onWordClick={isManualMode && isListening ? handleWordClick : undefined}
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
                          onClick={() => handleWordClick(index)}
                          animate={isActive ? {
                            scale: [1, 1.15, 1],
                            textShadow: ['0 0 0px rgba(251, 191, 36, 0)', '0 0 20px rgba(251, 191, 36, 1)', '0 0 0px rgba(251, 191, 36, 0)'],
                          } : {}}
                          transition={{ duration: 0.3 }}
                          className={`inline-block mr-1 sm:mr-2 mb-1 sm:mb-2 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg border transition-all duration-200 ${getWordStyle(index)} ${isManualMode && isListening && (index === currentWordIndex + 1 || index < currentWordIndex) ? 'cursor-pointer hover:bg-white/10 hover:scale-105 active:scale-95' : ''}`}
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
            <div className="flex flex-col gap-3 sm:gap-4 mt-4 sm:mt-6 md:mt-8">
              {/* Mod Seçimi - KARAOKE BAŞLATMADAN ÖNCE - HER ZAMAN GÖSTER */}
              {!isListening && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3"
                >
                  <p className="text-center text-sm sm:text-base text-gray-300 mb-2">
                    Nasıl ilerlemek istersiniz?
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setIsManualMode(true);
                        setModeSelected(true);
                        toast.success('👆 İşaretleme modu seçildi - Kelimelere dokunarak ilerleyeceksiniz', { duration: 3000 });
                      }}
                      className="flex-1 px-6 py-4 bg-blue-600/20 border-2 border-blue-500/50 rounded-xl hover:bg-blue-600/30 transition-all flex items-center justify-center gap-3"
                    >
                      <Hand className="w-6 h-6 text-blue-400" />
                      <span className="font-semibold text-base sm:text-lg text-blue-400">İŞARETLEME</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setIsManualMode(false);
                        setModeSelected(true);
                        toast.success('🎤 Konuşarak modu seçildi - Mikrofon ile ilerleyeceksiniz', { duration: 3000 });
                      }}
                      className="flex-1 px-6 py-4 bg-purple-600/20 border-2 border-purple-500/50 rounded-xl hover:bg-purple-600/30 transition-all flex items-center justify-center gap-3"
                    >
                      <MicOff className="w-6 h-6 text-purple-400" />
                      <span className="font-semibold text-base sm:text-lg text-purple-400">KONUŞARAK</span>
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Karaoke Başlat/Durdur Butonları - MOD SEÇİLDİYSE GÖSTER */}
              {modeSelected && (
                <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4">
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
                    onClick={() => {
                      handleReset();
                      setModeSelected(false);
                      setIsManualMode(false);
                    }}
                    className="w-full sm:w-auto p-3 sm:p-4 bg-white/10 rounded-2xl sm:rounded-3xl border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center"
                  >
                    <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </motion.button>
                </div>
              )}

              {/* Seçilen Mod Göstergesi */}
              {modeSelected && !isListening && (
                <div className="text-center">
                  <span className="text-sm text-gray-400">
                    Seçilen mod: <span className="font-semibold text-white">
                      {isManualMode ? '👆 İşaretleme' : '🎤 Konuşarak'}
                    </span>
                  </span>
                </div>
              )}
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

