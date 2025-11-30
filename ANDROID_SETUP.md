# 📱 LYRİC-ST Android Kurulum Rehberi

Bu rehber Android uygulamasını build etmek için gerekli tüm adımları içerir.

## 🔧 Ön Gereksinimler

1. **Node.js** (v18+)
2. **Android Studio** (Arctic Fox veya üzeri)
3. **Java JDK** (11 veya üzeri)
4. **Android SDK** (API 33+)

## 📦 1. Bağımlılıkları Yükle

```bash
npm install
```

## 🎨 2. Android Logolarını Hazırla

Logo dosyasını Android için hazırlamak için:

```bash
# Sharp kütüphanesini yükle (ilk kez)
npm install sharp --save-dev

# Logoları oluştur
node scripts/prepare-android-logo.js
```

Bu script `logo.jpeg` dosyasını Android için gerekli tüm boyutlara (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi) dönüştürür ve `android/app/src/main/res/` klasörüne yerleştirir.

## 🏗️ 3. Web Build Al

```bash
npm run build
```

## 📱 4. Android Projesini Oluştur/Sync Et

```bash
# Android platform ekle (ilk kez)
npx cap add android

# Sync (her build sonrası)
npx cap sync android
```

## 🎯 5. Android Studio'da Aç

```bash
npx cap open android
```

Android Studio açıldıktan sonra:

1. **Gradle Sync** yapın (otomatik olabilir)
2. **Build > Make Project** ile projeyi derleyin
3. **Run** butonu ile emülatör veya gerçek cihazda çalıştırın

## 📋 6. Android Manifest Kontrolü

`android/app/src/main/AndroidManifest.xml` dosyasında şunlar olmalı:

- ✅ Uygulama adı: `LYRİC-ST`
- ✅ Package name: `com.lyricst.app`
- ✅ İzinler: RECORD_AUDIO, READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE
- ✅ FileProvider yapılandırması

## 🎨 7. Logo Kontrolü

Aşağıdaki klasörlerde logo dosyaları olmalı:

```
android/app/src/main/res/
├── mipmap-mdpi/
│   ├── ic_launcher.png (48x48)
│   └── ic_launcher_round.png (48x48)
├── mipmap-hdpi/
│   ├── ic_launcher.png (72x72)
│   └── ic_launcher_round.png (72x72)
├── mipmap-xhdpi/
│   ├── ic_launcher.png (96x96)
│   └── ic_launcher_round.png (96x96)
├── mipmap-xxhdpi/
│   ├── ic_launcher.png (144x144)
│   └── ic_launcher_round.png (144x144)
└── mipmap-xxxhdpi/
    ├── ic_launcher.png (192x192)
    └── ic_launcher_round.png (192x192)
```

## 🔐 8. İzinler

Uygulama şu izinleri gerektirir:

- **RECORD_AUDIO**: Mikrofon erişimi için
- **READ_EXTERNAL_STORAGE**: Müzik dosyalarını okumak için
- **WRITE_EXTERNAL_STORAGE**: Müzik dosyalarını kaydetmek için
- **MODIFY_AUDIO_SETTINGS**: Ses ayarlarını değiştirmek için

## 🚀 9. Release Build

Release build almak için:

1. Android Studio'da **Build > Generate Signed Bundle / APK**
2. Keystore oluştur veya mevcut keystore'u kullan
3. **APK** veya **AAB** formatını seç
4. Build al

## ✅ Kontrol Listesi

Build almadan önce kontrol edin:

- [ ] `capacitor.config.ts` dosyasında `appName: 'LYRİC-ST'`
- [ ] `capacitor.config.ts` dosyasında `appId: 'com.lyricst.app'`
- [ ] Tüm logo dosyaları mevcut
- [ ] Android Manifest'te izinler tanımlı
- [ ] `npx cap sync android` hatasız tamamlandı
- [ ] Android Studio'da Gradle sync başarılı
- [ ] Uygulama adı Android'de "LYRİC-ST" olarak görünüyor

## 🐛 Sorun Giderme

### Logo görünmüyor
- Logo dosyalarının doğru klasörlerde olduğundan emin olun
- `npx cap sync android` komutunu tekrar çalıştırın
- Android Studio'da **File > Invalidate Caches / Restart**

### Build hatası
- Gradle sync yapın
- `android/gradle.properties` dosyasını kontrol edin
- Android SDK versiyonunu kontrol edin (minSdkVersion 22+)

### İzin hatası
- `AndroidManifest.xml` dosyasında izinlerin tanımlı olduğundan emin olun
- Runtime izinleri için kod kontrolü yapın

## 📞 Destek

Sorun yaşarsanız:
1. `npx cap doctor` komutu ile ortamı kontrol edin
2. Android Studio loglarını kontrol edin
3. Capacitor dokümantasyonunu inceleyin


