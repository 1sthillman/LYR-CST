/**
 * Platform Detection Utility
 * Web ve Android platformlarını ayırt eder
 */
export const isAndroid = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Capacitor platform kontrolü
  if ((window as any).Capacitor) {
    return (window as any).Capacitor.getPlatform() === 'android';
  }
  
  // Fallback: User agent kontrolü
  return navigator.userAgent.toLowerCase().indexOf('android') > -1;
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


