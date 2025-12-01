# 📱 Android WebView - GitHub Pages Entegrasyonu

## ✅ Yapılan Değişiklikler

### 1. Capacitor Config Güncellendi

`capacitor.config.ts` dosyasına GitHub Pages URL'i eklendi:

```typescript
server: {
  androidScheme: 'https',
  url: 'https://1sthillman.github.io/LYR-CST/',
  cleartext: false, // HTTPS kullan
}
```

### 2. AndroidManifest Kontrolü

✅ **INTERNET izni mevcut** - WebView'ın internet'e erişmesi için gerekli
✅ **RECORD_AUDIO izni mevcut** - Mikrofon erişimi için gerekli
✅ **MODIFY_AUDIO_SETTINGS izni mevcut** - Ses ayarları için gerekli

## 🎯 Nasıl Çalışır?

1. **Android uygulaması açıldığında:**
   - Capacitor, `server.url` ayarını kullanır
   - WebView, GitHub Pages sitesini (`https://1sthillman.github.io/LYR-CST/`) yükler
   - Web versiyonu Android'de çalışır

2. **Avantajlar:**
   - ✅ Web versiyonu çalışır (mikrofon sorunları yok)
   - ✅ Tüm özellikler web'deki gibi çalışır
   - ✅ Güncellemeler otomatik (GitHub Pages'de güncellendiğinde)
   - ✅ Mikrofon düzgün çalışır (web versiyonu)

3. **Dikkat Edilmesi Gerekenler:**
   - ⚠️ İnternet bağlantısı gerekli
   - ⚠️ Capacitor plugin'leri (SQLite, Filesystem) remote URL'de çalışmayabilir
   - ⚠️ Offline çalışmaz

## 🚀 Build ve Test

### 1. Sync
```bash
npx cap sync android
```

### 2. Android Studio'da Aç
```bash
npx cap open android
```

### 3. Build ve Run
- Android Studio'da **Run** butonuna tıklayın
- Uygulama açıldığında GitHub Pages sitesi yüklenecek

## 🔧 Sorun Giderme

### WebView Siteyi Yüklemiyor
1. **İnternet bağlantısını kontrol edin**
2. **AndroidManifest'te INTERNET izninin olduğundan emin olun**
3. **Logcat'te hata mesajlarını kontrol edin**

### Mikrofon Çalışmıyor
1. **Uygulama izinlerini kontrol edin** (Ayarlar > Uygulamalar > LYRİC-ST > İzinler)
2. **RECORD_AUDIO izninin verildiğinden emin olun**
3. **WebView'ın mikrofon erişimine izin verdiğinden emin olun**

### Site Yavaş Yükleniyor
1. **İnternet hızını kontrol edin**
2. **GitHub Pages'in erişilebilir olduğundan emin olun**
3. **Cache'i temizleyin**

---

**Durum**: ✅ WebView entegrasyonu tamamlandı!


