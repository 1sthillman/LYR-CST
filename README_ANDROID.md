# 📱 LYRİC-ST Android Uygulaması

LYRİC-ST, profesyonel karaoke deneyimi sunan Android uygulamasıdır.

## 🚀 Hızlı Başlangıç

### 1. Build Al

```bash
npm run build
```

### 2. Android'e Sync Et

```bash
npm run android:sync
```

### 3. Android Studio'da Aç

```bash
npm run android:open
```

## 📋 Kurulum Adımları

### Ön Gereksinimler

- Node.js 18+
- Android Studio (Arctic Fox veya üzeri)
- Java JDK 11+
- Android SDK (API 33+)

### Adım Adım

1. **Bağımlılıkları Yükle**
   ```bash
   npm install
   ```

2. **Logo Hazırla** (İlk kez)
   ```bash
   npm run android:prepare
   ```

3. **Web Build**
   ```bash
   npm run build
   ```

4. **Android Sync**
   ```bash
   npx cap sync android
   ```

5. **Android Studio'da Aç**
   ```bash
   npx cap open android
   ```

## 🎨 Logo

Logo dosyası `logo.jpeg` otomatik olarak Android için gerekli tüm boyutlara dönüştürülür:

- mipmap-mdpi: 48x48
- mipmap-hdpi: 72x72
- mipmap-xhdpi: 96x96
- mipmap-xxhdpi: 144x144
- mipmap-xxxhdpi: 192x192

## 🔐 İzinler

Uygulama şu izinleri gerektirir:

- **RECORD_AUDIO**: Mikrofon erişimi
- **READ_EXTERNAL_STORAGE**: Müzik dosyalarını okuma
- **WRITE_EXTERNAL_STORAGE**: Müzik dosyalarını kaydetme
- **READ_MEDIA_AUDIO**: Android 13+ medya erişimi
- **MODIFY_AUDIO_SETTINGS**: Ses ayarları

## 📦 Build

### Debug Build

Android Studio'da **Run** butonuna basın.

### Release Build

1. **Keystore Oluştur** (ilk kez):
   ```bash
   keytool -genkey -v -keystore lyricst-release.keystore -alias lyricst -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Android Studio'da**:
   - Build > Generate Signed Bundle / APK
   - APK veya AAB seç
   - Keystore seç
   - Build al

## ✅ Kontrol Listesi

Build öncesi kontrol edin:

- [x] Uygulama adı: LYRİC-ST
- [x] Package name: com.lyricst.app
- [x] Logo dosyaları mevcut
- [x] İzinler tanımlı
- [x] Capacitor sync başarılı

Detaylı kontrol listesi için `BUILD_CHECKLIST.md` dosyasına bakın.

## 🐛 Sorun Giderme

### Logo görünmüyor
```bash
npm run android:prepare
npx cap sync android
```

### Build hatası
- Android Studio'da File > Invalidate Caches / Restart
- `cd android && ./gradlew clean`

### İzin hatası
- AndroidManifest.xml'i kontrol et
- Runtime izinleri için kod kontrolü yap

## 📚 Daha Fazla Bilgi

- [ANDROID_SETUP.md](./ANDROID_SETUP.md) - Detaylı kurulum rehberi
- [BUILD_CHECKLIST.md](./BUILD_CHECKLIST.md) - Build kontrol listesi
- [new.md](./new.md) - Teknik dokümantasyon


