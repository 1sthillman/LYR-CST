import { MatchedWord } from '../types';
import { calculateSimilarity } from '../utils/stringUtils';
import { AdaptiveThreshold } from './AdaptiveThreshold';

/**
 * Şarkı sözleri eşleştirme motoru - AKILLI VE HIZLI (AKIŞI BOZMAZ)
 * Gerçek zamanlı kelime tanıma ve eşleştirme yapar
 * Noktalama işaretlerini önemsiz kılar
 * Timeout mekanizması ile takılı kalmayı önler
 * Adaptive threshold ile akıllı hassasiyet
 */
export class LyricsMatcher {
  private lyrics: string[] = [];
  private matchedWords: (MatchedWord | null)[] = [];
  private _currentPosition: number = 0;
  private readonly LOOKAHEAD_RANGE = 8; // 8 kelime ileriye bak (atlanan kelimeleri bul)
  private readonly MAX_POSITION_JUMP = 4; // Maksimum 4 kelime ileriye atla
  private readonly STUCK_TIMEOUT = 5000; // 5 saniye takılı kalırsa ilerle (ms) - sadece gerçek takılma durumunda
  
  private adaptiveThreshold: AdaptiveThreshold;
  private lastMatchTime: number = 0;
  private stuckTimeoutId: number | null = null;
  private onPositionChange: ((newPosition: number) => void) | null = null;

  constructor() {
    this.adaptiveThreshold = new AdaptiveThreshold();
  }

  /**
   * Pozisyon değişikliği callback'i ayarla
   */
  setOnPositionChange(callback: (newPosition: number) => void): void {
    this.onPositionChange = callback;
  }

  /**
   * Noktalama işaretlerini temizler
   */
  private cleanWord(word: string): string {
    return word
      .toLowerCase()
      .replace(/[.,!?;:'"()\[\]{}…–—]/g, '') // Tüm noktalama işaretleri
      .replace(/[^\wçğıöşüÇĞIİÖŞÜ]/g, '') // Sadece harf ve Türkçe karakterler
      .trim();
  }

  /**
   * Şarkı sözlerini ayarlar
   */
  setLyrics(lyrics: string): void {
    // Noktalama işaretlerini temizle ve kelimelere ayır
    this.lyrics = lyrics
      .toLowerCase()
      .replace(/[.,!?;:'"()\[\]{}…–—]/g, ' ') // Noktalama işaretlerini boşlukla değiştir
      .split(/\s+/) // Boşluklara göre ayır
      .map((word: string) => this.cleanWord(word)) // Her kelimeyi temizle
      .filter((word: string) => word.length > 0); // Boş kelimeleri filtrele
    
    this.matchedWords = new Array(this.lyrics.length).fill(null);
    this._currentPosition = 0;
    this.lastMatchTime = Date.now();
    this.adaptiveThreshold.reset();
    this.clearStuckTimeout();
    console.log('Şarkı sözleri ayarlandı, toplam kelime:', this.lyrics.length);
  }

  /**
   * Takılı kalma timeout'unu temizle
   */
  private clearStuckTimeout(): void {
    if (this.stuckTimeoutId !== null) {
      clearTimeout(this.stuckTimeoutId);
      this.stuckTimeoutId = null;
    }
  }

  /**
   * Takılı kalma timeout'unu başlat
   * SADECE gerçekten kelime algılandığında ve eşleşme olmadığında başlatılır
   * Sessizlik durumunda timeout başlatılmaz
   */
  private startStuckTimeout(): void {
    this.clearStuckTimeout();
    
    this.stuckTimeoutId = window.setTimeout(() => {
      // 5 saniye boyunca eşleşme yoksa ve gerçekten takılı kalmışsa, pozisyonu 1 ilerlet
      // Ama sadece son eşleşmeden bu yana 5 saniye geçtiyse
      const timeSinceLastMatch = Date.now() - this.lastMatchTime;
      if (timeSinceLastMatch >= this.STUCK_TIMEOUT && this._currentPosition < this.lyrics.length) {
        console.log('⏰ Timeout: Takılı kalma tespit edildi, pozisyon ilerletiliyor');
        
        const targetWord = this.lyrics[this._currentPosition];
        const match: MatchedWord = {
          original: targetWord,
          detected: '[TIMEOUT]',
          confidence: 0,
          isCorrect: false,
          timestamp: Date.now()
        };
        
        this.matchedWords[this._currentPosition] = match;
        this._currentPosition = Math.min(this._currentPosition + 1, this.lyrics.length);
        this.lastMatchTime = Date.now();
        
        // Callback'i çağır
        if (this.onPositionChange) {
          this.onPositionChange(this._currentPosition);
        }
        
        // Yeni timeout başlat (eğer hala takılı kalırsa)
        this.startStuckTimeout();
      }
    }, this.STUCK_TIMEOUT);
  }

  /**
   * Algılanan kelimeyi işler ve eşleştirir - AKILLI VE HIZLI
   */
  processWord(detectedWord: string, confidence: number): MatchedWord | null {
    if (this._currentPosition >= this.lyrics.length) {
      this.clearStuckTimeout();
      return null;
    }

    const now = Date.now();
    const detectedWordClean = this.cleanWord(detectedWord);

    if (detectedWordClean.length === 0) {
      return null;
    }

    // Adaptive threshold'u al
    const dynamicThreshold = this.adaptiveThreshold.getThreshold();
    
    // Önce mevcut pozisyondaki kelimeyi kontrol et
    let bestMatch: { index: number; similarity: number } | null = null;
    
    // Lookahead: Mevcut pozisyondan başlayarak ileriye bak (atlanan kelimeleri bul)
    const searchStart = this._currentPosition;
    const searchEnd = Math.min(
      this._currentPosition + this.LOOKAHEAD_RANGE,
      this.lyrics.length
    );

    for (let i = searchStart; i < searchEnd; i++) {
      const targetWord = this.lyrics[i];
      const similarity = calculateSimilarity(targetWord, detectedWordClean);
      
      // En iyi eşleşmeyi bul
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { index: i, similarity };
      }
    }

    // Eşleşme bulundu mu? - ADAPTIVE THRESHOLD kullan - DAHA ESNEK (HIZLI ALGILAMA)
    if (bestMatch && bestMatch.similarity >= dynamicThreshold && confidence >= 0.2) { // 0.3 -> 0.2 (daha esnek)
      const matchIndex = bestMatch.index;
      
      // POZİSYON ATLAMASINI SINIRLA
      const positionJump = matchIndex - this._currentPosition;
      if (positionJump > this.MAX_POSITION_JUMP) {
        // Çok büyük atlama - eşleşmeyi reddet, sadece mevcut pozisyondaki kelimeyi işaretle
        const targetWord = this.lyrics[this._currentPosition];
        const match: MatchedWord = {
          original: targetWord,
          detected: detectedWordClean,
          confidence,
          isCorrect: false,
          timestamp: now
        };
        this.matchedWords[this._currentPosition] = match;
        
        // Pozisyonu sadece 1 ilerlet
        this._currentPosition = Math.min(this._currentPosition + 1, this.lyrics.length);
        this.lastMatchTime = now;
        this.clearStuckTimeout();
        this.startStuckTimeout(); // Yeni timeout başlat
        
        // Adaptive threshold'u güncelle
        this.adaptiveThreshold.adjustThreshold(confidence, false);
        
        if (this.onPositionChange) {
          this.onPositionChange(this._currentPosition);
        }
        
        return match;
      }
      
      const isCorrect = true;

      // Eğer mevcut pozisyondan ilerideyse, aradaki kelimeleri atla (atlanmış olarak işaretle)
      if (matchIndex > this._currentPosition) {
        for (let i = this._currentPosition; i < matchIndex; i++) {
          if (!this.matchedWords[i]) {
            this.matchedWords[i] = {
              original: this.lyrics[i],
              detected: '',
              confidence: 0,
              isCorrect: false,
              timestamp: now
            };
          }
        }
      }

      const match: MatchedWord = {
        original: this.lyrics[matchIndex],
        detected: detectedWordClean,
        confidence,
        isCorrect,
        timestamp: now
      };

      this.matchedWords[matchIndex] = match;
      
      // Pozisyonu güncelle
      this._currentPosition = matchIndex + 1;
      this.lastMatchTime = now;
      this.clearStuckTimeout();
      this.startStuckTimeout(); // Yeni timeout başlat
      
      // Adaptive threshold'u güncelle
      this.adaptiveThreshold.adjustThreshold(confidence, true);
      
      if (this.onPositionChange) {
        this.onPositionChange(this._currentPosition);
      }
      
      return match;
    }

    // Eşleşme bulunamadı - mevcut pozisyondaki kelimeyi yanlış olarak işaretle
    const targetWord = this.lyrics[this._currentPosition];
    const similarity = calculateSimilarity(targetWord, detectedWordClean);
    
    const match: MatchedWord = {
      original: targetWord,
      detected: detectedWordClean,
      confidence,
      isCorrect: false,
      timestamp: now
    };

    this.matchedWords[this._currentPosition] = match;
    
    // Adaptive threshold'u güncelle
    this.adaptiveThreshold.adjustThreshold(confidence, false);
    
    // Eğer çok düşük benzerlik varsa (0.20'den az) ve 1.5 saniye geçtiyse pozisyonu ilerlet
    // DAHA HIZLI İLERLEME - akışı koru ama daha hızlı
    const timeSinceLastMatch = now - this.lastMatchTime;
    if (similarity < 0.20 && timeSinceLastMatch > 1500) { // 0.15 -> 0.20, 2000 -> 1500 (daha hızlı)
      console.log('⏩ Düşük benzerlik + timeout: Pozisyon ilerletiliyor (akış korunuyor)');
      this._currentPosition = Math.min(this._currentPosition + 1, this.lyrics.length);
      this.lastMatchTime = now;
      this.clearStuckTimeout();
      // Timeout'u başlatma - sadece gerçekten takılı kalırsa başlat
    } else {
      // Timeout'u başlat (takılı kalma kontrolü) - sadece gerçekten kelime algılandığında
      // lastMatchTime'ı güncelle (kelime algılandı ama eşleşmedi)
      this.lastMatchTime = now;
      this.startStuckTimeout();
    }
    
    return match;
  }

  /**
   * İlerleme yüzdesini döndürür (0-1 arası)
   */
  getProgress(): number {
    if (this.lyrics.length === 0) return 0;
    return this._currentPosition / this.lyrics.length;
  }

  /**
   * Doğruluk oranını döndürür (0-1 arası)
   */
  getAccuracy(): number {
    if (this.lyrics.length === 0) return 0;
    const correct = this.matchedWords.filter((m: MatchedWord | null) => m && m.isCorrect).length;
    return correct / this.lyrics.length;
  }

  /**
   * Eşleştirmeyi sıfırlar
   */
  reset(): void {
    this._currentPosition = 0;
    this.matchedWords = new Array(this.lyrics.length).fill(null);
    this.lastMatchTime = Date.now();
    this.adaptiveThreshold.reset();
    this.clearStuckTimeout();
    console.log('Eşleştirme sıfırlandı');
  }

  /**
   * Mevcut pozisyonu döndürür
   */
  get currentPosition(): number {
    return this._currentPosition;
  }

  /**
   * Eşleşen kelimeleri döndürür
   */
  get matchedWordsList(): (MatchedWord | null)[] {
    return this.matchedWords;
  }

  /**
   * Adaptive threshold'u döndürür
   */
  get currentThreshold(): number {
    return this.adaptiveThreshold.getThreshold();
  }
}
