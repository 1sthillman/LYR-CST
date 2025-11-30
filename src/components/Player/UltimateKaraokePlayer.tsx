import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { UltimateLyricsMatcher, MatchResult } from '../../engine/UltimateLyricsMatcher';
import speechRecognitionService from '../../services/SpeechRecognitionService';
import { VirtualLyricsDisplay } from './VirtualLyricsDisplay';
import { lyricsCache } from '../../cache/LyricsCache';
import { AdaptiveThreshold } from '../../engine/AdaptiveThreshold';
import { dbAdapter } from '../../database/DatabaseAdapter';
import toast from 'react-hot-toast';
import { Mic, MicOff } from 'lucide-react';

/**
 * Debounce utility
 */
const debounce = <T extends (...args: any[]) => void>(func: T, wait: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

interface Props {
  lyrics: string;
  songId: number;
  title: string;
  artist?: string;
}

/**
 * Ultimate Karaoke Player - 10.000 Satır Destekli
 * Virtual scrolling, cache, adaptive threshold ile optimize edilmiş
 */
export const UltimateKaraokePlayer: React.FC<Props> = ({ lyrics, songId, title, artist }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [matchedWords, setMatchedWords] = useState<(MatchResult | null)[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [progress, setProgress] = useState(0);
  const [adaptiveThreshold, setAdaptiveThreshold] = useState(0.75);
  
  const matcherRef = useRef<UltimateLyricsMatcher>(new UltimateLyricsMatcher());
  const thresholdRef = useRef<AdaptiveThreshold>(new AdaptiveThreshold());
  const words = lyrics.split(/\s+/).filter((w: string) => w.trim());

  // Debounced kelime işleme
  const processWord = useCallback(
    debounce((word: string, confidence: number) => {
      const match = matcherRef.current.processWord(word, confidence);
      
      if (match) {
        const adjustedThreshold = thresholdRef.current.adjustThreshold(confidence, match.isCorrect);
        setAdaptiveThreshold(adjustedThreshold);
        
        setCurrentIndex(matcherRef.current.currentIndex);
        setMatchedWords([...matcherRef.current.matchedWords]);
        setAccuracy(Math.round(matcherRef.current.getAccuracy() * 100));
        setProgress(Math.round(matcherRef.current.getProgress() * 100));
      }
    }, 50),
    []
  );

  // Cache'den yükle veya yeni oluştur
  useEffect(() => {
    const loadLyrics = async () => {
      try {
        await lyricsCache.initialize();
        const cached = await lyricsCache.get<string[]>(`lyrics_${songId}`);
        
        if (cached) {
          matcherRef.current.setLyrics(lyrics);
          toast.success('📦 Şarkı sözleri önbellekten yüklendi');
        } else {
          matcherRef.current.setLyrics(lyrics);
          await lyricsCache.set(`lyrics_${songId}`, words);
        }
      } catch (error) {
        console.error('Cache hatası:', error);
        matcherRef.current.setLyrics(lyrics);
      }
    };
    
    loadLyrics();
  }, [lyrics, songId, words]);

  // Başlat
  const start = useCallback(async () => {
    try {
      await dbAdapter.initialize();
      await speechRecognitionService.initialize(processWord);

      thresholdRef.current.reset();
      setIsListening(true);
      toast.success('🎤 Karaoke başladı!');
    } catch (error) {
      toast.error('❌ Hata: ' + (error as Error).message);
      console.error('Başlatma hatası:', error);
    }
  }, [processWord]);

  // Durdur
  const stop = useCallback(() => {
    speechRecognitionService.stop();
    setIsListening(false);
    toast.success('✅ Karaoke durduruldu');
  }, []);

  // Kelime tıklama (manuel ilerleme)
  const handleWordClick = useCallback((index: number) => {
    if (index === currentIndex + 1) {
      matcherRef.current.processWord(words[index], 1.0);
      setCurrentIndex(index);
    } else if (index < currentIndex) {
      matcherRef.current.undoLastWord();
      setCurrentIndex(prev => Math.max(0, prev - 1));
    }
  }, [currentIndex, words]);

  // Cleanup
  useEffect(() => {
    return () => {
      speechRecognitionService.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="p-4 sm:p-6 border-b border-white/10 bg-white/5 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              {title}
            </h1>
            {artist && (
              <p className="text-xs sm:text-sm text-gray-400">{artist}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Doğruluk: {accuracy}% | Adaptive Threshold: {Math.round(adaptiveThreshold * 100)}%
            </p>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={isListening ? stop : start}
            className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-bold flex items-center gap-2 ${
              isListening 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
            } transition-all text-sm sm:text-base`}
          >
            {isListening ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
            {isListening ? 'DURDUR' : 'BAŞLAT'}
          </motion.button>
        </div>
      </motion.div>

      {/* Progress Bar */}
      <motion.div
        className="h-1 sm:h-2 bg-gray-800"
        animate={{ width: `${progress}%` }}
        transition={{ type: 'spring', stiffness: 100 }}
      >
        <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" />
      </motion.div>

      {/* Virtual Lyrics Display */}
      <div className="flex-1 p-4 sm:p-6 overflow-hidden">
        <VirtualLyricsDisplay
          words={words}
          currentIndex={currentIndex}
          matchedWords={matchedWords}
          onWordClick={handleWordClick}
        />
      </div>

      {/* Stats */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1, transition: { delay: 0.2 } }}
        className="p-4 sm:p-6 border-t border-white/10 bg-white/5 backdrop-blur-xl"
      >
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl sm:text-2xl font-bold text-white">{currentIndex}</p>
            <p className="text-xs text-gray-400">Kelime</p>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-bold text-green-400">{accuracy}%</p>
            <p className="text-xs text-gray-400">Doğruluk</p>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-bold text-purple-400">{words.length}</p>
            <p className="text-xs text-gray-400">Toplam</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

