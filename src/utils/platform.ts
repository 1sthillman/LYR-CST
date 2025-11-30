/**
 * Platform Detection Utility
 * Web ve Android platformlarını ayırt eder
 * 
 * ÖNEMLİ: Sadece native Android app için true döner
 * Web sitesinden (GitHub Pages) çalışıyorsa her zaman false döner
 */
export const isAndroid = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Capacitor platform kontrolü - SADECE native app için
  // Web sitesinden çalışıyorsa Capacitor yok, bu yüzden false döner
  if ((window as any).Capacitor) {
    return (window as any).Capacitor.getPlatform() === 'android';
  }
  
  // Web sitesinden çalışıyorsa (GitHub Pages) her zaman false
  // User agent kontrolü yapma - web sitesi her zaman web olarak çalışmalı
  return false;
};

export const isWeb = (): boolean => {
  if (typeof window === 'undefined') return true;
  
  if ((window as any).Capacitor) {
    return (window as any).Capacitor.getPlatform() === 'web';
  }
  
  return !isAndroid();
};

export const getPlatform = (): 'web' | 'android' | 'ios' => {
  if (typeof window === 'undefined') return 'web';
  
  if ((window as any).Capacitor) {
    return (window as any).Capacitor.getPlatform() as 'web' | 'android' | 'ios';
  }
  
  return isAndroid() ? 'android' : 'web';
};


