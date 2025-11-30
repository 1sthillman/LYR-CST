/**
 * Levenshtein mesafesi hesaplama - OPTİMİZE EDİLMİŞ
 * İki string arasındaki benzerlik oranını hesaplar
 * Performans için hızlı çıkışlar ve optimizasyonlar içerir
 */
export const levenshteinDistance = (str1: string, str2: string): number => {
  // Hızlı çıkışlar - performans için kritik
  if (str1 === str2) return 0;
  if (str1.length === 0) return str2.length;
  if (str2.length === 0) return str1.length;
  
  // Kısa stringler için optimize edilmiş karşılaştırma
  if (str1.length <= 3 && str2.length <= 3) {
    if (str1 === str2) return 0;
    let diff = 0;
    const minLen = Math.min(str1.length, str2.length);
    for (let i = 0; i < minLen; i++) {
      if (str1[i] !== str2[i]) diff++;
    }
    return diff + Math.abs(str1.length - str2.length);
  }

  const matrix: number[][] = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  // İlk satır ve sütunu doldur
  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  // Matrisi doldur
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,      // Deletion
        matrix[j - 1][i] + 1,      // Insertion
        matrix[j - 1][i - 1] + indicator // Substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
};

/**
 * İki string arasındaki benzerlik oranını hesaplar (0-1 arası) - RAP İÇİN OPTİMİZE EDİLMİŞ
 * Hızlı konuşma ve kısmi kelimeler için partial match desteği
 */
export const calculateSimilarity = (str1: string, str2: string): number => {
  // Hızlı çıkışlar
  if (str1 === str2) return 1;
  if (str1.length === 0 && str2.length === 0) return 1;
  
  const str1Lower = str1.toLowerCase();
  const str2Lower = str2.toLowerCase();
  
  // Tam eşleşme kontrolü
  if (str1Lower === str2Lower) return 1;
  
  // PARTIAL MATCH (KISMI EŞLEŞME) - RAP İÇİN KRİTİK - ÇOK ESNEK
  // Eğer algılanan kelime, hedef kelimenin başlangıcı ise (hızlı konuşma için)
  // Örnek: "gece" -> "gecelik", "rit" -> "ritimlerle" ✅
  if (str2Lower.startsWith(str1Lower) && str1Lower.length >= 2) {
    // Başlangıç eşleşmesi - en az 2 karakter eşleşmeli (rap için çok esnek)
    const matchRatio = str1Lower.length / str2Lower.length;
    // Eğer algılanan kelime hedef kelimenin en az %50'si ise yüksek benzerlik
    if (matchRatio >= 0.5) {
      return 0.80; // Yüksek benzerlik (partial match)
    }
    // Eğer en az %30'u ise orta benzerlik
    if (matchRatio >= 0.3) {
      return 0.70; // Orta benzerlik (partial match)
    }
    // Eğer en az %20'si ise düşük ama kabul edilebilir
    if (matchRatio >= 0.2) {
      return 0.65; // Düşük ama kabul edilebilir (rap için)
    }
  }
  
  // Ters partial match - hedef kelime algılanan kelimenin başlangıcı ise
  // Örnek: "gecelik" -> "gece" (nadir ama olabilir)
  if (str1Lower.startsWith(str2Lower) && str2Lower.length >= 3) {
    const matchRatio = str2Lower.length / str1Lower.length;
    if (matchRatio >= 0.6) {
      return 0.85;
    }
    if (matchRatio >= 0.4) {
      return 0.70;
    }
  }
  
  // İçerik kontrolü - algılanan kelime hedef kelimenin içinde geçiyor mu?
  // Örnek: "gece" -> "gecelik", "rit" -> "ritimlerle" (rap için kritik)
  if (str2Lower.includes(str1Lower) && str1Lower.length >= 2) {
    const matchRatio = str1Lower.length / str2Lower.length;
    if (matchRatio >= 0.5) {
      return 0.75; // İçerik eşleşmesi (yüksek)
    }
    if (matchRatio >= 0.3) {
      return 0.68; // İçerik eşleşmesi (orta)
    }
    if (matchRatio >= 0.2) {
      return 0.65; // İçerik eşleşmesi (düşük ama kabul edilebilir)
    }
  }
  
  const distance = levenshteinDistance(str1Lower, str2Lower);
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  
  // Benzerlik hesaplama - daha esnek formül
  const similarity = 1 - (distance / maxLength);
  
  // Kısa kelimeler için daha esnek eşleştirme
  if (maxLength <= 4 && distance <= 1) {
    return Math.max(similarity, 0.75); // Minimum %75 benzerlik
  }
  
  return similarity;
};

