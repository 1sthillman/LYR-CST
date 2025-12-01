import { MatchedWord } from '../types';
import { calculateSimilarity } from '../utils/stringUtils';
import { AdaptiveThreshold } from './AdaptiveThreshold';
import { isMobileBrowser } from '../utils/platform';

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

  // Performance cache (speed.md'den)
  private phoneticCache: Map<string, string> = new Map();
  private normalizedCache: Map<string, string> = new Map();
  
  // Türkçe özel karakterler için normalizasyon (speed.md'den)
  private readonly TR_CHARS: Record<string, string> = {
    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'İ': 'i', 'ö': 'o', 
    'ş': 's', 'ü': 'u', 'Ç': 'c', 'Ğ': 'g', 'Ö': 'o', 
    'Ş': 's', 'Ü': 'u'
  };

  // Yaygın ses benzerlikler (Türkçe fonetik) (speed.md'den)
  private readonly PHONETIC_SIMILAR: Record<string, string[]> = {
    'c': ['ç', 'j'],
    'ç': ['c', 'j'],
    's': ['ş', 'z'],
    'ş': ['s', 'z'],
    'i': ['ı', 'e'],
    'ı': ['i', 'e'],
    'o': ['ö', 'u'],
    'ö': ['o', 'u'],
    'u': ['ü', 'o'],
    'ü': ['u', 'o'],
    'k': ['g'],
    'g': ['k'],
    't': ['d'],
    'd': ['t'],
    'p': ['b'],
    'b': ['p']
  };

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
    
    // Cache'leri temizle (speed.md'den)
    this.phoneticCache.clear();
    this.normalizedCache.clear();
    
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
        console.log(`⏰ [MATCHER] Timeout: Gerçek takılı kalma tespit edildi, pozisyon ilerletiliyor | TimeSinceLastMatch: ${timeSinceLastMatch}ms | TimeSinceLastWord: ${timeSinceLastWordDetected}ms | ConsecutiveNoMatch: ${this.consecutiveNoMatchCount} | Pozisyon: ${this._currentPosition} -> ${this._currentPosition + 1}`);
        
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
  private isPartialMatchForWord(detectedWord: string, targetWord: string): boolean {
    if (!detectedWord || detectedWord.length < 2) {
      return false;
    }

    const detectedWordClean = this.cleanWord(detectedWord);
    const targetWordClean = this.cleanWord(targetWord);
    
    if (detectedWordClean.length < 2 || targetWordClean.length < 2) {
      return false;
    }

    // Algılanan kelime hedef kelimenin başlangıcı mı?
    if (targetWordClean.toLowerCase().startsWith(detectedWordClean.toLowerCase())) {
      const matchRatio = detectedWordClean.length / targetWordClean.length;
      // En az %30 eşleşme varsa partial match (kullanıcı hala söylüyor)
      if (matchRatio >= 0.3 && matchRatio < 1.0) {
        return true;
      }
    }

    return false;
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

    // 6 KATMANLI EŞLEŞTİRME (speed.md'den) - Önce exact match'i dene (en hızlı)
    // 1. EXACT MATCH (en hızlı) - speed.md'den
    for (let i = searchStart; i < searchEnd; i++) {
      const targetWord = this.lyrics[i];
      if (this.exactMatch(detectedWordClean, targetWord)) {
        bestMatch = { index: i, similarity: 1.0 };
        break; // En hızlı eşleşme bulundu, döngüden çık
      }
    }

    // 2. NORMALIZED MATCH - speed.md'den
    if (!bestMatch) {
      for (let i = searchStart; i < searchEnd; i++) {
        const targetWord = this.lyrics[i];
        if (this.normalizedMatch(detectedWordClean, targetWord)) {
          bestMatch = { index: i, similarity: 0.95 };
          break;
        }
      }
    }

    // 3. PHONETIC MATCH - speed.md'den
    if (!bestMatch) {
      for (let i = searchStart; i < searchEnd; i++) {
        const targetWord = this.lyrics[i];
        const phoneticScore = this.phoneticMatch(detectedWordClean, targetWord);
        if (phoneticScore > 0.8) {
          bestMatch = { index: i, similarity: phoneticScore };
          break;
        }
      }
    }

    // 4. FUZZY MATCH (Levenshtein) - speed.md'den
    if (!bestMatch) {
      for (let i = searchStart; i < searchEnd; i++) {
        const targetWord = this.lyrics[i];
        const fuzzyScore = this.fuzzyMatch(detectedWordClean, targetWord);
        if (fuzzyScore > 0.7) {
          if (!bestMatch || fuzzyScore > bestMatch.similarity) {
            bestMatch = { index: i, similarity: fuzzyScore };
          }
        }
      }
    }

    // 5. PARTIAL MATCH - speed.md'den
    if (!bestMatch) {
      for (let i = searchStart; i < searchEnd; i++) {
        const targetWord = this.lyrics[i];
        if (this.partialMatch(detectedWordClean, targetWord)) {
          bestMatch = { index: i, similarity: 0.6 };
          break;
        }
      }
    }

    // 6. PREDICTIVE MATCH (sonraki kelimeler) - speed.md'den
    if (!bestMatch) {
      const predictiveMatch = this.predictiveMatch(detectedWordClean, searchStart, searchEnd);
      if (predictiveMatch) {
        bestMatch = { index: predictiveMatch.index, similarity: predictiveMatch.similarity };
      }
    }

    // Fallback: Eğer hiçbir katman eşleşmediyse, eski calculateSimilarity kullan
    if (!bestMatch) {
      for (let i = searchStart; i < searchEnd; i++) {
        const targetWord = this.lyrics[i];
        const similarity = calculateSimilarity(targetWord, detectedWordClean);
        
        // En iyi eşleşmeyi bul
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { index: i, similarity };
        }
      }
    }

    // Eşleşme bulundu mu? - ADAPTIVE THRESHOLD kullan - AKILLI VE HIZLI EŞLEŞME
    // MOBİL İÇİN ÇOK AGRESİF AYARLAR: Mobilde Türkçe algılama için çok esnek threshold'lar
    const isMobile = isMobileBrowser();
    
    // Confidence threshold - mobilde HİÇBİR THRESHOLD YOK (TÜM KELİMELERİ KABUL ET)
    const minConfidenceForMatch = isMobile ? 0.01 : 0.45; // Mobil: 0.01 (neredeyse hiç threshold yok), PC: 0.45
    
    // Partial match kontrolü - eğer partial match varsa daha esnek similarity
    const isPartialMatchForBest = bestMatch && this.isPartialMatchForWord(detectedWordClean, this.lyrics[bestMatch.index]);
    
    // Similarity threshold - mobilde ÇOK daha esnek (Türkçe algılama için kritik)
    let minSimilarityForMatch: number;
    if (isPartialMatchForBest) {
      minSimilarityForMatch = isMobile ? 0.50 : 0.70; // Partial match: Mobil 0.50 (çok agresif), PC 0.70
    } else {
      minSimilarityForMatch = isMobile ? 0.55 : 0.75; // Normal: Mobil 0.55 (çok agresif), PC 0.75
    }
    
    // MOBİLDE TÜM EŞLEŞME DENEMELERİNİ LOGLA (DEBUG İÇİN)
    if (isMobile && bestMatch) {
      console.log(`📱 [MOBİL MATCHER DEBUG] Kelime: "${detectedWordClean}" | Confidence: ${confidence.toFixed(3)} | Similarity: ${bestMatch.similarity.toFixed(3)} | MinSimilarity: ${minSimilarityForMatch.toFixed(3)} | MinConfidence: ${minConfidenceForMatch.toFixed(3)} | Geçti: ${bestMatch.similarity >= minSimilarityForMatch && confidence >= minConfidenceForMatch}`);
    }
    
    // DETAYLI LOG - Eşleştirme sürecini logla
    if (bestMatch) {
      console.log(`🔍 [MATCHER] Eşleştirme kontrolü: "${detectedWordClean}" | Mevcut pozisyon: ${this._currentPosition}/${this.lyrics.length} | Hedef kelime: "${this.lyrics[this._currentPosition]}" | Similarity: ${bestMatch.similarity.toFixed(2)} | Threshold: ${dynamicThreshold.toFixed(2)} | MinSimilarity: ${minSimilarityForMatch.toFixed(2)} | Confidence: ${confidence.toFixed(2)} | MinConfidence: ${minConfidenceForMatch.toFixed(2)} | PartialMatch: ${isPartialMatchForBest}`);
    }
    
    // KRİTİK: Hem similarity hem confidence yeterli olmalı
    // Partial match'ler için daha esnek similarity threshold
    if (bestMatch && 
        bestMatch.similarity >= Math.max(dynamicThreshold, minSimilarityForMatch) && 
        confidence >= minConfidenceForMatch) {
      const matchIndex = bestMatch.index;
      
      // POZİSYON ATLAMASINI SINIRLA - AKILLI VE HIZLI KONTROL
      const positionJump = matchIndex - this._currentPosition;
      
      // KRİTİK: Pozisyon atlaması için similarity kontrolü - partial match'ler için esnek
      // MOBİL İÇİN ÇOK AGRESİF: Mobilde pozisyon atlaması için çok esnek threshold
      const isPartialMatchForJump = this.isPartialMatchForWord(detectedWordClean, this.lyrics[matchIndex]);
      let minSimilarityForJump: number;
      if (positionJump > 0) {
        if (isPartialMatchForJump) {
          minSimilarityForJump = isMobile ? 0.50 : 0.75; // Partial match atlaması: Mobil 0.50 (çok agresif), PC 0.75
        } else {
          minSimilarityForJump = isMobile ? 0.55 : 0.80; // Normal atlama: Mobil 0.55 (çok agresif), PC 0.80
        }
      } else {
        minSimilarityForJump = minSimilarityForMatch;
      }
      
      if (positionJump > this.MAX_POSITION_JUMP) {
        // Çok büyük atlama - eşleşmeyi reddet
        console.log(`⚠️ [MATCHER] Çok büyük atlama reddedildi: ${positionJump} kelime | Pozisyon: ${this._currentPosition} -> ${matchIndex} | Similarity: ${bestMatch.similarity.toFixed(2)}`);
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
        
        // Adaptive threshold'u güncelle
        this.adaptiveThreshold.adjustThreshold(confidence, false);
        
        if (this.onPositionChange) {
          this.onPositionChange(this._currentPosition);
        }
        
        return match;
      }
      
      // Pozisyon atlaması için similarity kontrolü - partial match'ler için esnek
      if (positionJump > 0 && bestMatch.similarity < minSimilarityForJump) {
        // Pozisyon atlanıyor ama similarity yeterli değil - reddet
        console.log(`⚠️ [MATCHER] Pozisyon atlaması reddedildi: Similarity yetersiz | Pozisyon: ${this._currentPosition} -> ${matchIndex} | Similarity: ${bestMatch.similarity.toFixed(2)} | MinSimilarity: ${minSimilarityForJump.toFixed(2)} | PartialMatch: ${isPartialMatchForJump}`);
        // Eşleşmeyi reddet, mevcut pozisyonda kal
        const targetWord = this.lyrics[this._currentPosition];
        const match: MatchedWord = {
          original: targetWord,
          detected: detectedWordClean,
          confidence,
          isCorrect: false,
          timestamp: now
        };
        this.matchedWords[this._currentPosition] = match;
        this.adaptiveThreshold.adjustThreshold(confidence, false);
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
      const oldPosition = this._currentPosition;
      this._currentPosition = matchIndex + 1;
      this.lastMatchTime = now;
      this.lastWordDetectedTime = now; // Kelime algılandı zamanını güncelle
      this.lastDetectedWord = ''; // Temizle
      this.consecutiveNoMatchCount = 0; // Eşleşme oldu, reset
      this.clearStuckTimeout();
      
      // DETAYLI LOG - Eşleşme başarılı
      console.log(`✅ [MATCHER] EŞLEŞME BAŞARILI! "${detectedWordClean}" -> "${this.lyrics[matchIndex]}" | Pozisyon: ${oldPosition} -> ${this._currentPosition} | Similarity: ${bestMatch.similarity.toFixed(2)} | Confidence: ${confidence.toFixed(2)} | Doğru: ${finalIsCorrect}`);
      
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
    
    // DETAYLI LOG - Eşleşme bulunamadı
    console.log(`❌ [MATCHER] Eşleşme bulunamadı: "${detectedWordClean}" | Mevcut pozisyon: ${this._currentPosition}/${this.lyrics.length} | Hedef: "${targetWord}" | Similarity: ${similarity.toFixed(2)} | Threshold: ${dynamicThreshold.toFixed(2)} | Confidence: ${confidence.toFixed(2)} | BestMatch: ${bestMatch ? `${bestMatch.similarity.toFixed(2)} (index: ${bestMatch.index})` : 'yok'}`);
    
    // Partial match kontrolü - eğer "git" -> "gittim" gibi bir durum varsa
    const isPartial = this.isPartialMatch(detectedWordClean);
    
    if (isPartial) {
      console.log(`🔄 [MATCHER] Partial match tespit edildi: "${detectedWordClean}" -> "${targetWord}" | Bekleniyor...`);
    }
    
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
        this.lastWordDetectedTime = now; // Kelime algılandı zamanını güncelle
        this.consecutiveNoMatchCount = 0; // Partial match varsa reset (kullanıcı söylüyor)
        this.clearStuckTimeout(); // Mevcut timeout'u temizle
        return match; // Pozisyon ilerletme, beklemeye devam et
      }
    
    // KRİTİK: Sadece gerçekten kelime algılandıysa ve confidence yeterliyse timeout başlat
    // Sessizlik durumunda (çok düşük confidence) timeout başlatma
    // Partial match varsa timeout başlatma - kullanıcı hala kelimeyi söylüyor
    // MOBİL İÇİN ÇOK AGRESİF: Mobilde timeout için çok düşük confidence
    const MIN_CONFIDENCE_FOR_TIMEOUT = isMobile ? 0.01 : 0.45; // Mobil: 0.01 (neredeyse hiç threshold yok), PC: 0.45
    
    // Eğer çok düşük benzerlik varsa (0.15'ten az) VE confidence yeterliyse (0.3+) VE 10 saniye geçtiyse pozisyonu ilerlet
    // DAHA AKILLI - sadece gerçekten takılı kalırsa ve gerçekten kelime algılandıysa ilerlet
    const timeSinceLastMatch = now - this.lastMatchTime;
    if (similarity < 0.15 && confidence >= MIN_CONFIDENCE_FOR_TIMEOUT && timeSinceLastMatch > 10000 && this.consecutiveNoMatchCount >= 3) {
      // Gerçekten kelime algılandı ama eşleşmedi ve uzun süre geçti (10 saniye)
      // Ve ardışık 3 eşleşmeme oldu
      console.log(`⏩ [MATCHER] Gerçek kelime algılandı ama eşleşmedi, uzun timeout: Pozisyon ilerletiliyor | TimeSinceLastMatch: ${timeSinceLastMatch}ms | ConsecutiveNoMatch: ${this.consecutiveNoMatchCount}`);
      this._currentPosition = Math.min(this._currentPosition + 1, this.lyrics.length);
      this.lastMatchTime = now;
      this.lastDetectedWord = ''; // Temizle
      this.consecutiveNoMatchCount = 0; // Reset
      this.clearStuckTimeout();
    } else if (confidence >= MIN_CONFIDENCE_FOR_TIMEOUT) {
      // Gerçekten kelime algılandı (confidence yeterli) - timeout başlat
      console.log(`⏳ [MATCHER] Timeout başlatılıyor: "${detectedWordClean}" | Confidence: ${confidence.toFixed(2)} | ConsecutiveNoMatch: ${this.consecutiveNoMatchCount}`);
      this.lastMatchTime = now;
      this.startStuckTimeout(detectedWordClean); // Partial match kontrolü ile
    } else {
      // Çok düşük confidence - sessizlik veya gürültü, timeout başlatma
      // Sadece lastMatchTime'ı güncelleme (sessizlik durumunda ilerleme yok)
      console.log(`🔇 [MATCHER] Düşük confidence - sessizlik/gürültü: "${detectedWordClean}" | Confidence: ${confidence.toFixed(2)} | Timeout başlatılmıyor`);
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
   * Son kelimeyi geri al (undo)
   */
  undoLastWord(): void {
    if (this._currentPosition > 0) {
      // Son kelimeyi temizle
      const lastIndex = this._currentPosition - 1;
      this.matchedWords[lastIndex] = null;
      this._currentPosition = lastIndex;
      this.lastMatchTime = Date.now();
      this.lastWordDetectedTime = Date.now();
      this.lastDetectedWord = '';
      this.consecutiveNoMatchCount = 0;
      this.clearStuckTimeout();
      
      if (this.onPositionChange) {
        this.onPositionChange(this._currentPosition);
      }
      
      console.log(`↩️ [MATCHER] Son kelime geri alındı, pozisyon: ${this._currentPosition}`);
    }
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

  /**
   * 6 KATMANLI EŞLEŞTİRME YARDIMCI FONKSİYONLARI (speed.md'den)
   */

  // 1. EXACT MATCH
  private exactMatch(spoken: string, target: string): boolean {
    return this.normalizeWithCache(spoken) === this.normalizeWithCache(target);
  }

  // 2. NORMALIZED MATCH
  private normalizedMatch(spoken: string, target: string): boolean {
    const normalizedSpoken = this.normalizeWithCache(spoken);
    const normalizedTarget = this.normalizeWithCache(target);
    return normalizedSpoken === normalizedTarget;
  }

  // 3. PHONETIC MATCH
  private phoneticMatch(spoken: string, target: string): number {
    const phoneticSpoken = this.toPhonetic(spoken);
    const phoneticTarget = this.toPhonetic(target);
    
    if (phoneticSpoken === phoneticTarget) {
      return 1.0;
    }

    // Levenshtein distance ile benzerlik hesapla
    const distance = this.levenshteinDistance(phoneticSpoken, phoneticTarget);
    const maxLen = Math.max(phoneticSpoken.length, phoneticTarget.length);
    return 1 - (distance / maxLen);
  }

  // 4. FUZZY MATCH (Levenshtein)
  private fuzzyMatch(spoken: string, target: string): number {
    const normalized1 = this.normalizeWithCache(spoken);
    const normalized2 = this.normalizeWithCache(target);
    
    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLen = Math.max(normalized1.length, normalized2.length);
    
    return 1 - (distance / maxLen);
  }

  // 5. PARTIAL MATCH
  private partialMatch(spoken: string, target: string): boolean {
    const normalizedSpoken = this.normalizeWithCache(spoken);
    const normalizedTarget = this.normalizeWithCache(target);
    
    return normalizedTarget.includes(normalizedSpoken) || 
           normalizedSpoken.includes(normalizedTarget);
  }

  // 6. PREDICTIVE MATCH
  private predictiveMatch(spokenWord: string, searchStart: number, _searchEnd: number): { index: number; similarity: number } | null {
    const lookAhead = 3; // Sonraki 3 kelimeye bak
    
    for (let i = 1; i <= lookAhead && searchStart + i < this.lyrics.length; i++) {
      const futureWord = this.lyrics[searchStart + i];
      
      if (this.exactMatch(spokenWord, futureWord)) {
        // İlerideki bir kelime eşleşti
        console.log(`⏭️ [MATCHER] ${i} kelime atlanıyor (predictive match)`);
        return { index: searchStart + i, similarity: 0.8 };
      }
    }
    
    return null;
  }

  // Cache'li normalizasyon (speed.md'den)
  private normalizeWithCache(word: string): string {
    if (this.normalizedCache.has(word)) {
      return this.normalizedCache.get(word)!;
    }
    
    let normalized = this.cleanWord(word);
    
    // Türkçe karakterleri değiştir
    for (const [tr, en] of Object.entries(this.TR_CHARS)) {
      normalized = normalized.replace(new RegExp(tr, 'g'), en);
    }
    
    this.normalizedCache.set(word, normalized);
    return normalized;
  }

  // Fonetik dönüşüm (speed.md'den)
  private toPhonetic(word: string): string {
    if (this.phoneticCache.has(word)) {
      return this.phoneticCache.get(word)!;
    }
    
    let phonetic = this.normalizeWithCache(word);
    
    // Çift harfleri tekle indir
    phonetic = phonetic.replace(/(.)\1+/g, '$1');
    
    // Sessiz harfleri grupla
    for (const [base, similars] of Object.entries(this.PHONETIC_SIMILAR)) {
      for (const similar of similars) {
        phonetic = phonetic.replace(new RegExp(similar, 'g'), base);
      }
    }
    
    this.phoneticCache.set(word, phonetic);
    return phonetic;
  }

  // Levenshtein Distance (optimized) - speed.md'den
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Optimize edilmiş versiyon (sadece iki satır kullan)
    let prev = Array.from({ length: len2 + 1 }, (_, i) => i);
    let curr = new Array(len2 + 1);
    
    for (let i = 1; i <= len1; i++) {
      curr[0] = i;
      
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          curr[j - 1] + 1,      // insertion
          prev[j] + 1,          // deletion
          prev[j - 1] + cost    // substitution
        );
      }
      
      [prev, curr] = [curr, prev];
    }
    
    return prev[len2];
  }
}
