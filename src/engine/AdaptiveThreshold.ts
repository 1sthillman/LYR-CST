/**
 * Adaptive Threshold - Akıllı Hassasiyet Ayarı
 * Kullanıcının performansına göre otomatik olarak threshold'u ayarlar
 * Hata yaparsa düşürür, doğru yaparsa yükseltir
 */
export class AdaptiveThreshold {
  private baseThreshold: number = 0.65;
  private currentThreshold: number = 0.65;
  private history: { confidence: number; isCorrect: boolean; timestamp: number }[] = [];
  private readonly WINDOW_SIZE = 10; // Son 10 eşleşmeyi takip et
  private readonly MIN_THRESHOLD = 0.50; // Minimum threshold (çok esnek)
  private readonly MAX_THRESHOLD = 0.75; // Maksimum threshold (çok katı)

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
      
      // Eğer çok hata yapıyorsa threshold'u düşür (daha esnek)
      if (recentAccuracy < 0.4) {
        this.currentThreshold = Math.max(this.MIN_THRESHOLD, this.currentThreshold - 0.05);
        console.log('📉 Threshold düşürüldü (çok hata):', this.currentThreshold);
      }
      // Eğer çok doğru yapıyorsa threshold'u yükselt (daha katı)
      else if (recentAccuracy > 0.8) {
        this.currentThreshold = Math.min(this.MAX_THRESHOLD, this.currentThreshold + 0.02);
        console.log('📈 Threshold yükseltildi (çok doğru):', this.currentThreshold);
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


