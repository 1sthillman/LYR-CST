/**
 * Adaptive Speech Recognition Model
 * Kullanıcı düzeltmelerini öğrenir ve tanıma kalitesini artırır
 */

interface Correction {
  wrongWord: string;
  correctWord: string;
  count: number;
  lastUsed: number;
}

export class AdaptiveSpeechModel {
  private corrections: Map<string, Correction> = new Map();
  private readonly STORAGE_KEY = 'lyricst_speech_corrections';
  private readonly MAX_CORRECTIONS = 100;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Kullanıcı düzeltmesi kaydet
   */
  onUserCorrection(recognized: string, correct: string): void {
    const key = recognized.toLowerCase().trim();
    
    if (key === correct.toLowerCase().trim()) {
      return; // Aynıysa kaydetme
    }

    const existing = this.corrections.get(key);
    
    if (existing) {
      existing.count++;
      existing.lastUsed = Date.now();
    } else {
      this.corrections.set(key, {
        wrongWord: key,
        correctWord: correct.toLowerCase().trim(),
        count: 1,
        lastUsed: Date.now()
      });
    }

    // Limit kontrolü
    if (this.corrections.size > this.MAX_CORRECTIONS) {
      this.cleanupOldCorrections();
    }

    this.saveToStorage();
  }

  /**
   * Tanınan metni düzelt
   */
  correctTranscript(raw: string): string {
    let corrected = raw;
    const words = raw.toLowerCase().split(/\s+/);

    words.forEach((word) => {
      const cleanWord = word.replace(/[.,!?;:'"()\[\]{}…–—]/g, '').trim();
      const correction = this.corrections.get(cleanWord);
      
      if (correction && correction.count >= 2) {
        // En az 2 kez düzeltilmişse kullan
        const regex = new RegExp(`\\b${this.escapeRegex(cleanWord)}\\b`, 'gi');
        corrected = corrected.replace(regex, correction.correctWord);
      }
    });

    return corrected;
  }

  /**
   * Regex özel karakterlerini escape et
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Eski düzeltmeleri temizle
   */
  private cleanupOldCorrections(): void {
    const sorted = Array.from(this.corrections.entries())
      .sort((a, b) => b[1].lastUsed - a[1].lastUsed);
    
    // En eski %20'yi sil
    const toRemove = Math.floor(this.corrections.size * 0.2);
    for (let i = sorted.length - 1; i >= sorted.length - toRemove; i--) {
      this.corrections.delete(sorted[i][0]);
    }
  }

  /**
   * LocalStorage'a kaydet
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.corrections.entries()).map(([key, value]) => ({
        key,
        ...value
      }));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Adaptive model kaydetme hatası:', error);
    }
  }

  /**
   * LocalStorage'dan yükle
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data) as Array<{ key: string } & Correction>;
        parsed.forEach(item => {
          const { key, ...correction } = item;
          this.corrections.set(key, correction);
        });
      }
    } catch (error) {
      console.error('Adaptive model yükleme hatası:', error);
    }
  }

  /**
   * Tüm düzeltmeleri temizle
   */
  clearCorrections(): void {
    this.corrections.clear();
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * Düzeltme istatistikleri
   */
  getStats(): { total: number; mostUsed: Correction[] } {
    const sorted = Array.from(this.corrections.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      total: this.corrections.size,
      mostUsed: sorted
    };
  }
}

export default new AdaptiveSpeechModel();

