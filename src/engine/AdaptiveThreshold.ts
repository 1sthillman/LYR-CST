/**
 * Adaptive Threshold - Akıllı Hassasiyet Ayarı
 * Kullanıcının performansına göre otomatik olarak threshold'u ayarlar
 * Hata yaparsa düşürür, doğru yaparsa yükseltir
 */
export class AdaptiveThreshold {
  private baseThreshold: number = 0.45; // Daha düşük başlangıç (daha hızlı algılama ve daha yüksek doğruluk)
  private currentThreshold: number = 0.45;
  private history: { confidence: number; isCorrect: boolean; timestamp: number }[] = [];
  private readonly WINDOW_SIZE = 10; // Son 10 eşleşmeyi takip et
  private readonly MIN_THRESHOLD = 0.35; // Minimum threshold (çok esnek - yüksek doğruluk için)
  private readonly MAX_THRESHOLD = 0.65; // Maksimum threshold (daha esnek)

  /**
   * Threshold'u ayarla - son eşleşmeye göre
   */
  adjustThreshold(lastConfidence: number, wasCorrect: boolean): number {
    const now = Date.now();
    
    // Geçmişe ekle
    this.history.push({ confidence: lastConfidence, isCorrect: wasCorrect, timestamp: now });
    
    // Eski kayıtları temizle (30 saniyeden eski)
    this.history = this.history.filter(h => now - h.timestamp < 30000);
    
    // Window size'ı aşarsa eski olanları sil
    if (this.history.length > this.WINDOW_SIZE) {
      this.history = this.history.slice(-this.WINDOW_SIZE);
    }

    // Son 5 eşleşmenin doğruluğunu hesapla
    const recentHistory = this.history.slice(-5);
    if (recentHistory.length >= 3) {
      const recentAccuracy = recentHistory.filter(h => h.isCorrect).length / recentHistory.length;
      
      // Eğer çok hata yapıyorsa threshold'u düşür (daha esnek) - DAHA YAVAŞ
      if (recentAccuracy < 0.4) {
        this.currentThreshold = Math.max(this.MIN_THRESHOLD, this.currentThreshold - 0.02); // 0.05 -> 0.02 (daha yavaş)
        // Log azaltıldı - performans için
        if (this.currentThreshold <= this.MIN_THRESHOLD) {
          // Minimum'a ulaştıysa log yok
        }
      }
      // Eğer çok doğru yapıyorsa threshold'u yükselt (daha katı)
      else if (recentAccuracy > 0.8) {
        this.currentThreshold = Math.min(this.MAX_THRESHOLD, this.currentThreshold + 0.01); // 0.02 -> 0.01 (daha yavaş)
        // Log azaltıldı - performans için
      }
      // Orta seviyede sabit tut
      else {
        this.currentThreshold = this.baseThreshold;
      }
    }

    return this.currentThreshold;
  }

  /**
   * Mevcut threshold'u döndür
   */
  getThreshold(): number {
    return this.currentThreshold;
  }

  /**
   * Threshold'u sıfırla
   */
  reset(): void {
    this.history = [];
    this.currentThreshold = this.baseThreshold;
    console.log('🔄 Adaptive threshold sıfırlandı');
  }
}


