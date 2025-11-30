import { calculateSimilarity } from '../utils/stringUtils';

/**
 * Match Result Interface
 */
export interface MatchResult {
  original: string;
  detected: string;
  confidence: number;
  isCorrect: boolean;
  isSkipped: boolean;
  timestamp: number;
  index: number;
}

/**
 * Ultimate Lyrics Matcher - 10.000 Satır Destekli
 * Context-aware, fuzzy matching, skip detection
 */
export class UltimateLyricsMatcher {
  private lyrics: string[] = [];
  private _matchedWords: (MatchResult | null)[] = [];
  private _currentIndex = 0;
  private readonly SIMILARITY_THRESHOLD = 0.65;
  private readonly SKIP_DETECTION_RANGE = 5;
  
  // Cache for fuzzy matching
  private fuzzyCache = new Map<string, { word: string; similarity: number }[]>();

  /**
   * Şarkı sözlerini ayarla
   */
  setLyrics(lyrics: string): void {
    // Kelimeleri ayır ve temizle
    this.lyrics = lyrics
      .toLowerCase()
      .replace(/[.,!?;:'"()\[\]{}…–—]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);

    this._matchedWords = new Array(this.lyrics.length).fill(null);
    this._currentIndex = 0;
    this.fuzzyCache.clear();
    
    console.log(`📊 Toplam kelime: ${this.lyrics.length}`);
  }

  /**
   * Kelimeyi işle ve eşleştir
   */
  processWord(detectedWord: string, confidence: number): MatchResult | null {
    if (this._currentIndex >= this.lyrics.length) return null;

    const targetWord = this.lyrics[this._currentIndex];
    const detectedWordClean = detectedWord.toLowerCase().trim();
    
    // Fuzzy match
    const similarity = calculateSimilarity(targetWord, detectedWordClean);
    const isCorrect = similarity >= this.SIMILARITY_THRESHOLD && confidence >= 0.3;

    // Eğer çok düşük benzerlik varsa, skip detection'a bak
    if (!isCorrect && confidence > 0.7) {
      const skipResult = this.checkForSkip(detectedWordClean);
      if (skipResult) return skipResult;
    }

    const match: MatchResult = {
      original: targetWord,
      detected: detectedWordClean,
      confidence,
      isCorrect,
      isSkipped: false,
      timestamp: Date.now(),
      index: this._currentIndex,
    };

    this._matchedWords[this._currentIndex] = match;
    
    if (isCorrect) {
      this._currentIndex++;
      this.preloadNextWords();
    }

    return match;
  }

  /**
   * Skip detection - atlanan kelimeleri bul
   */
  private checkForSkip(detectedWord: string): MatchResult | null {
    const checkWindow = Math.min(this.SKIP_DETECTION_RANGE, this.lyrics.length - this._currentIndex);
    
    for (let i = 1; i < checkWindow; i++) {
      const nextWord = this.lyrics[this._currentIndex + i];
      const similarity = calculateSimilarity(nextWord, detectedWord);
      
      if (similarity >= this.SIMILARITY_THRESHOLD) {
        console.log(`⏭️ Skip tespit edildi: ${i} kelime atlandı`);
        
        // Atlanan kelimeleri işaretle
        for (let j = 0; j < i; j++) {
          this._matchedWords[this._currentIndex + j] = {
            original: this.lyrics[this._currentIndex + j],
            detected: '[SKIPPED]',
            confidence: 0,
            isCorrect: false,
            isSkipped: true,
            timestamp: Date.now(),
            index: this._currentIndex + j,
          };
        }

        this._currentIndex += i;
        return this._matchedWords[this._currentIndex - 1];
      }
    }

    return null;
  }

  /**
   * Sonraki kelimeleri önceden yükle (optimizasyon)
   */
  private preloadNextWords(): void {
    const preloadCount = Math.min(10, this.lyrics.length - this._currentIndex);
    for (let i = 0; i < preloadCount; i++) {
      const word = this.lyrics[this._currentIndex + i];
      // Phonetic sound hesapla (cache için)
      this.getPhoneticSound(word);
    }
  }

  /**
   * Phonetic sound hesapla (benzer sesli kelimeler için)
   */
  private getPhoneticSound(word: string): string {
    return word
      .replace(/[aeiou]/g, 'A')
      .replace(/[bcdfgjklmnpqrstvwxyz]/g, 'C')
      .substring(0, 4);
  }

  /**
   * Son kelimeyi geri al
   */
  undoLastWord(): void {
    if (this._currentIndex > 0) {
      this._currentIndex--;
      this._matchedWords[this._currentIndex] = null;
    }
  }

  /**
   * İlerleme yüzdesini döndür
   */
  getProgress(): number {
    if (this.lyrics.length === 0) return 0;
    return this._currentIndex / this.lyrics.length;
  }

  /**
   * Doğruluk oranını döndür
   */
  getAccuracy(): number {
    const correctCount = this._matchedWords.filter(
      m => m && !m.isSkipped && m.isCorrect
    ).length;
    const totalChecked = this._matchedWords.filter(m => m && !m.isSkipped).length;
    
    return totalChecked > 0 ? correctCount / totalChecked : 0;
  }

  /**
   * Skip oranını döndür
   */
  getSkipRate(): number {
    const skipped = this._matchedWords.filter(m => m?.isSkipped).length;
    return this._currentIndex > 0 ? skipped / this._currentIndex : 0;
  }

  /**
   * Sıfırla
   */
  reset(): void {
    this._currentIndex = 0;
    this._matchedWords = new Array(this.lyrics.length).fill(null);
    this.fuzzyCache.clear();
  }

  /**
   * Mevcut index'i döndür
   */
  get currentIndex(): number {
    return this._currentIndex;
  }

  /**
   * Eşleşen kelimeleri döndür
   */
  get matchedWords(): (MatchResult | null)[] {
    return this._matchedWords;
  }
}

