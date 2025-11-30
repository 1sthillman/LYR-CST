# 🚀 LYRİC-ST - Final Build Talimatları

## ✅ Tamamlanan İşlemler

### 1. Uygulama Adı ve Logo
- ✅ Uygulama adı: **LYRİC-ST** (tüm dosyalarda güncellendi)
- ✅ Package name: **com.lyricst.app**
- ✅ Logo dosyaları Android için hazırlandı (tüm mipmap boyutları)

### 2. Android Projesi
- ✅ Android platform eklendi
- ✅ Capacitor sync tamamlandı
- ✅ Tüm plugin'ler yüklendi ve sync edildi

### 3. İzinler
- ✅ RECORD_AUDIO (Mikrofon)
- ✅ READ_EXTERNAL_STORAGE (Android 12 ve altı)
- ✅ WRITE_EXTERNAL_STORAGE (Android 12 ve altı)
- ✅ READ_MEDIA_AUDIO (Android 13+)
- ✅ MODIFY_AUDIO_SETTINGS
- ✅ INTERNET

### 4. Dosya Yapısı
- ✅ AndroidManifest.xml yapılandırıldı
- ✅ strings.xml güncellendi
- ✅ file_paths.xml yapılandırıldı
- ✅ MainActivity.java oluşturuldu

## 📱 Build Alma Adımları

### Adım 1: Son Kontroller

```bash
# TypeScript kontrolü
npm run type-check

# Build kontrolü
npm run build

# Capacitor sync
npx cap sync android
```

### Adım 2: Android Studio'da Aç

```bash
npx cap open android
```

### Adım 3: Android Studio'da Yapılacaklar

1. **Gradle Sync** (otomatik olabilir)
   - File > Sync Project with Gradle Files

2. **Build** (ilk kez)
   - Build > Make Project

3. **Run** (Test için)
   - Run > Run 'app'
   - Emülatör veya gerçek cihaz seç

### Adım 4: Release Build (Play Store için)

1. **Keystore Oluştur** (ilk kez):
   ```bash
   keytool -genkey -v -keystore lyricst-release.keystore -alias lyricst -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Android Studio'da**:
   - Build > Generate Signed Bundle / APK
   - **AAB** formatını seç (Play Store için önerilen)
   - Keystore dosyasını seç
   - Şifre gir
   - Build al

3. **APK İsterseniz**:
   - Aynı adımları takip edin
   - **APK** formatını seç

## 📋 Kontrol Listesi

Build öncesi kontrol edin:

- [x] `capacitor.config.ts` → `appName: 'LYRİC-ST'`
- [x] `capacitor.config.ts` → `appId: 'com.lyricst.app'`
- [x] `strings.xml` → `app_name = "LYRİC-ST"`
- [x] Logo dosyaları tüm mipmap klasörlerinde mevcut
- [x] AndroidManifest.xml'de tüm izinler tanımlı
- [x] `npx cap sync android` hatasız tamamlandı
- [x] TypeScript hataları yok
- [x] Build hatasız tamamlanıyor

## 🎨 Logo Kontrolü

Logo dosyaları şu konumlarda olmalı:

```
android/app/src/main/res/
├── mipmap-mdpi/
│   ├── ic_launcher.png ✅
│   └── ic_launcher_round.png ✅
├── mipmap-hdpi/
│   ├── ic_launcher.png ✅
│   └── ic_launcher_round.png ✅
├── mipmap-xhdpi/
│   ├── ic_launcher.png ✅
│   └── ic_launcher_round.png ✅
├── mipmap-xxhdpi/
│   ├── ic_launcher.png ✅
│   └── ic_launcher_round.png ✅
└── mipmap-xxxhdpi/
    ├── ic_launcher.png ✅
    └── ic_launcher_round.png ✅
```

## 🔧 Yapılandırma Dosyaları

### capacitor.config.ts
```typescript
appId: 'com.lyricst.app'
appName: 'LYRİC-ST'
```

### android/app/src/main/res/values/strings.xml
```xml
<string name="app_name">LYRİC-ST</string>
<string name="title_activity_main">LYRİC-ST</string>
```

### android/app/build.gradle
```gradle
applicationId "com.lyricst.app"
```

## 🐛 Olası Sorunlar ve Çözümleri

### 1. Logo Görünmüyor
```bash
npm run android:prepare
npx cap sync android
```
Android Studio'da: File > Invalidate Caches / Restart

### 2. Build Hatası
- Gradle sync yapın
- `cd android && ./gradlew clean`
- Android Studio'yu yeniden başlatın

### 3. İzin Hatası
- AndroidManifest.xml'i kontrol edin
- Runtime izinleri için kod kontrolü yapın
- Android 13+ için READ_MEDIA_AUDIO kullanıldığından emin olun

### 4. Capacitor Plugin Hatası
```bash
npx cap sync android
npx cap doctor
```

## 📦 NPM Scripts

```bash
# Logo hazırla
npm run android:prepare

# Build + Sync
npm run android:sync

# Android Studio'da aç
npm run android:open
```

## ✅ Final Kontrol

Build almadan önce:

1. ✅ Uygulama adı "LYRİC-ST" olarak görünüyor mu?
2. ✅ Logo doğru görünüyor mu?
3. ✅ İzinler runtime'da isteniyor mu?
4. ✅ Mikrofon çalışıyor mu?
5. ✅ Müzik dosyası yükleme çalışıyor mu?
6. ✅ SQLite veritabanı çalışıyor mu?

## 🎉 Başarılı Build!

Tüm kontroller tamamlandıysa, uygulama build için hazırdır!

**Android Studio'da:**
1. Build > Generate Signed Bundle / APK
2. Keystore seç
3. AAB veya APK formatını seç
4. Build al

**Not:** İlk build biraz uzun sürebilir (Gradle indirme, derleme vb.)


