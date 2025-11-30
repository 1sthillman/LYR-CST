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
  private readonly STUCK_TIMEOUT = 15000; // 15 saniye takılı kalırsa ilerle (ms) - sadece gerçek takılma durumunda
  private lastDetectedWord: string = ''; // Son algılanan kelime (partial match kontrolü için)
  private lastWordDetectedTime: number = 0; // Son kelime algılanma zamanı (sessizlik tespiti için)
  private consecutiveNoMatchCount: number = 0; // Ardışık eşleşmeme sayısı
  
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
    this.lastWordDetectedTime = Date.now();
    this.lastDetectedWord = ''; // Temizle
    this.consecutiveNoMatchCount = 0;
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
   * KRİTİK: Sadece gerçekten takılı kalındığında ve hiç kelime algılanmadığında tetiklenir
   * Partial match durumunda timeout başlatılmaz
   * Sessizlik durumunda timeout başlatılmaz
   */
  private startStuckTimeout(detectedWord: string = ''): void {
    this.clearStuckTimeout();
    
    // Eğer partial match varsa timeout başlatma - kullanıcı hala kelimeyi söylüyor olabilir
    if (detectedWord && this.isPartialMatch(detectedWord)) {
      return;
    }
    
    // Sadece gerçekten kelime algılandıysa ve eşleşme olmadıysa timeout başlat
    // Eğer son kelime algılanmasından 15 saniye geçtiyse ve hala eşleşme yoksa timeout tetikle
    this.stuckTimeoutId = window.setTimeout(() => {
      const currentTime = Date.now();
      const timeSinceLastMatch = currentTime - this.lastMatchTime;
      const timeSinceLastWordDetected = currentTime - this.lastWordDetectedTime;
      const hasPartialMatch = this.lastDetectedWord && this.isPartialMatch(this.lastDetectedWord);
      
      // KRİTİK KOŞULLAR - Sadece gerçekten takılı kalındığında ilerlet:
      // 1. Son eşleşmeden 15 saniye geçmiş olmalı
      // 2. Son kelime algılanmasından 15 saniye geçmiş olmalı (sessizlik kontrolü)
      // 3. Partial match olmamalı
      // 4. Ardışık eşleşmeme sayısı 5'ten fazla olmalı (gerçekten takılı kalmış)
      if (timeSinceLastMatch >= this.STUCK_TIMEOUT && 
          timeSinceLastWordDetected >= this.STUCK_TIMEOUT &&
          this._currentPosition < this.lyrics.length && 
          !hasPartialMatch &&
          this.consecutiveNoMatchCount >= 5) {
        console.log('⏰ Timeout: Gerçek takılı kalma tespit edildi, pozisyon ilerletiliyor');
        
        const targetWord = this.lyrics[this._currentPosition];
        const match: MatchedWord = {
          original: targetWord,
          detected: '[TIMEOUT]',
          confidence: 0,
          isCorrect: false,
          timestamp: currentTime
        };
        
        this.matchedWords[this._currentPosition] = match;
        this._currentPosition = Math.min(this._currentPosition + 1, this.lyrics.length);
        this.lastMatchTime = currentTime;
        this.lastDetectedWord = '';
        this.consecutiveNoMatchCount = 0; // Reset
        
        if (this.onPositionChange) {
          this.onPositionChange(this._currentPosition);
        }
      }
    }, this.STUCK_TIMEOUT);
  }

  /**
   * Partial match kontrolü - algılanan kelime hedef kelimenin başlangıcı mı?
   * Örnek: "git" -> "gittim" ✅ (kullanıcı hala kelimeyi söylüyor)
   */
  private isPartialMatch(detectedWord: string): boolean {
    if (!detectedWord || detectedWord.length < 2) {
      return false;
    }

    const detectedWordClean = this.cleanWord(detectedWord);
    if (detectedWordClean.length < 2) {
      return false;
    }

    // Mevcut pozisyondaki kelimeyi kontrol et
    if (this._currentPosition < this.lyrics.length) {
      const targetWord = this.lyrics[this._currentPosition];
      const targetWordClean = this.cleanWord(targetWord);
      
      // Algılanan kelime hedef kelimenin başlangıcı mı?
      if (targetWordClean.toLowerCase().startsWith(detectedWordClean.toLowerCase())) {
        const matchRatio = detectedWordClean.length / targetWordClean.length;
        // En az %30 eşleşme varsa partial match (kullanıcı hala söylüyor)
        if (matchRatio >= 0.3 && matchRatio < 1.0) {
          return true;
        }
      }
    }

    // Lookahead range içinde de kontrol et (atlanan kelimeler için)
    const searchEnd = Math.min(
      this._currentPosition + this.LOOKAHEAD_RANGE,
      this.lyrics.length
    );
    
    for (let i = this._currentPosition; i < searchEnd; i++) {
      const targetWord = this.lyrics[i];
      const targetWordClean = this.cleanWord(targetWord);
      
      if (targetWordClean.toLowerCase().startsWith(detectedWordClean.toLowerCase())) {
        const matchRatio = detectedWordClean.length / targetWordClean.length;
        if (matchRatio >= 0.3 && matchRatio < 1.0) {
          return true;
        }
      }
    }

    return false;
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

    // Eşleşme bulundu mu? - ADAPTIVE THRESHOLD kullan - AKILLI EŞLEŞME
    // Interim results için daha düşük confidence (anlık algılama için)
    // Final results için daha yüksek confidence (kesin algılama için)
    // Confidence threshold optimize edildi - anlık algılama için interim results'ı kabul et
    const minConfidenceForMatch = confidence >= 0.7 ? 0.20 : 0.25; // Yüksek confidence interim results için 0.20, diğerleri için 0.25
    if (bestMatch && bestMatch.similarity >= dynamicThreshold && confidence >= minConfidenceForMatch) {
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
        this.lastDetectedWord = ''; // Temizle
        this.clearStuckTimeout();
        // Timeout başlatma - sadece gerçekten kelime algılandığında başlatılacak
        
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

      // Benzerlik yeterince yüksekse (0.6+) doğru say (yüksek doğruluk için)
      // Ayrıca partial match varsa da doğru say
      const finalIsCorrect = isCorrect || bestMatch.similarity >= 0.6;
      
      const match: MatchedWord = {
        original: this.lyrics[matchIndex],
        detected: detectedWordClean,
        confidence,
        isCorrect: finalIsCorrect, // Yüksek benzerlikli eşleşmeleri de doğru say
        timestamp: now
      };

      this.matchedWords[matchIndex] = match;
      
      // Pozisyonu güncelle
      this._currentPosition = matchIndex + 1;
      this.lastMatchTime = now;
      this.lastWordDetectedTime = now; // Kelime algılandı zamanını güncelle
      this.lastDetectedWord = ''; // Temizle
      this.consecutiveNoMatchCount = 0; // Eşleşme oldu, reset
      this.clearStuckTimeout();
      // Timeout başlatma - sadece gerçekten kelime algılandığında başlatılacak
      
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
    
    // Partial match kontrolü - eğer "git" -> "gittim" gibi bir durum varsa
    const isPartial = this.isPartialMatch(detectedWordClean);
    
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
    
    // Son algılanan kelimeyi sakla (partial match kontrolü için)
    this.lastDetectedWord = detectedWordClean;
    this.lastWordDetectedTime = now; // Kelime algılandı zamanını güncelle
    this.consecutiveNoMatchCount++; // Eşleşme olmadı, sayacı artır
    
    // Eğer partial match varsa - timeout başlatma, beklemeye devam et
    if (isPartial) {
      // Partial match var - kullanıcı hala kelimeyi söylüyor olabilir
      // Timeout başlatma, sadece lastMatchTime'ı güncelle
      this.lastMatchTime = now;
      this.consecutiveNoMatchCount = 0; // Partial match varsa reset (kullanıcı söylüyor)
      this.clearStuckTimeout(); // Mevcut timeout'u temizle
      return match; // Pozisyon ilerletme, beklemeye devam et
    }
    
    // KRİTİK: Sadece gerçekten kelime algılandıysa ve confidence yeterliyse timeout başlat
    // Sessizlik durumunda (çok düşük confidence) timeout başlatma
    const MIN_CONFIDENCE_FOR_TIMEOUT = 0.3; // Minimum confidence threshold
    
    // Eğer çok düşük benzerlik varsa (0.15'ten az) VE confidence yeterliyse (0.3+) VE 10 saniye geçtiyse pozisyonu ilerlet
    // DAHA AKILLI - sadece gerçekten takılı kalırsa ve gerçekten kelime algılandıysa ilerlet
    const timeSinceLastMatch = now - this.lastMatchTime;
    if (similarity < 0.15 && confidence >= MIN_CONFIDENCE_FOR_TIMEOUT && timeSinceLastMatch > 10000 && this.consecutiveNoMatchCount >= 3) {
      // Gerçekten kelime algılandı ama eşleşmedi ve uzun süre geçti (10 saniye)
      // Ve ardışık 3 eşleşmeme oldu
      console.log('⏩ Gerçek kelime algılandı ama eşleşmedi, uzun timeout: Pozisyon ilerletiliyor');
      this._currentPosition = Math.min(this._currentPosition + 1, this.lyrics.length);
      this.lastMatchTime = now;
      this.lastDetectedWord = ''; // Temizle
      this.consecutiveNoMatchCount = 0; // Reset
      this.clearStuckTimeout();
    } else if (confidence >= MIN_CONFIDENCE_FOR_TIMEOUT) {
      // Gerçekten kelime algılandı (confidence yeterli) - timeout başlat
      this.lastMatchTime = now;
      this.startStuckTimeout(detectedWordClean); // Partial match kontrolü ile
    } else {
      // Çok düşük confidence - sessizlik veya gürültü, timeout başlatma
      // Sadece lastMatchTime'ı güncelleme (sessizlik durumunda ilerleme yok)
      this.consecutiveNoMatchCount = 0; // Sessizlik durumunda reset
      this.clearStuckTimeout();
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
   * Doğruluk oranını döndürür (0-1 arası) - İYİLEŞTİRİLMİŞ
   * Sadece isCorrect değil, yüksek benzerlikli eşleşmeleri de sayar
   */
  getAccuracy(): number {
    if (this.lyrics.length === 0) return 0;
    
    let correctCount = 0;
    let totalProcessed = 0;
    
    for (let i = 0; i < this.lyrics.length; i++) {
      const match = this.matchedWords[i];
      
      if (match) {
        totalProcessed++;
        
        // Doğru olarak işaretlenmişse
        if (match.isCorrect) {
          correctCount++;
        } 
        // Eğer yüksek benzerlik varsa (0.6+) ve confidence yeterliyse (0.3+) doğru say
        else if (match.detected && match.detected !== '[TIMEOUT]' && match.detected !== '') {
          const similarity = calculateSimilarity(this.lyrics[i], match.detected);
          if (similarity >= 0.6 && match.confidence >= 0.3) {
            correctCount++;
          }
        }
      }
    }
    
    // Eğer hiç işlenmemişse 0 döndür
    if (totalProcessed === 0) return 0;
    
    // İşlenen kelimelere göre doğruluk hesapla (daha adil)
    return correctCount / totalProcessed;
  }

  /**
   * Eşleştirmeyi sıfırlar
   */
  reset(): void {
    this._currentPosition = 0;
    this.matchedWords = new Array(this.lyrics.length).fill(null);
    this.lastMatchTime = Date.now();
    this.lastWordDetectedTime = Date.now();
    this.lastDetectedWord = ''; // Temizle
    this.consecutiveNoMatchCount = 0;
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
