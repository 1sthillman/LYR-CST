# ✅ LYRİC-ST Android Build Kontrol Listesi

Build almadan önce aşağıdaki tüm maddelerin kontrol edildiğinden emin olun.

## 📱 1. Uygulama Bilgileri

- [x] **Uygulama Adı**: `LYRİC-ST` (capacitor.config.ts, strings.xml, PremiumHeader.tsx)
- [x] **Package Name**: `com.lyricst.app` (capacitor.config.ts, build.gradle)
- [x] **App ID**: `com.lyricst.app` (capacitor.config.ts)

## 🎨 2. Logo Dosyaları

- [x] `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` (48x48)
- [x] `android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png` (48x48)
- [x] `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` (72x72)
- [x] `android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png` (72x72)
- [x] `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` (96x96)
- [x] `android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png` (96x96)
- [x] `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` (144x144)
- [x] `android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png` (144x144)
- [x] `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (192x192)
- [x] `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png` (192x192)

## 🔐 3. İzinler (AndroidManifest.xml)

- [x] `INTERNET` - Web istekleri için
- [x] `RECORD_AUDIO` - Mikrofon erişimi için
- [x] `MODIFY_AUDIO_SETTINGS` - Ses ayarları için
- [x] `READ_EXTERNAL_STORAGE` - Müzik dosyalarını okumak için
- [x] `WRITE_EXTERNAL_STORAGE` - Müzik dosyalarını kaydetmek için
- [x] `READ_MEDIA_AUDIO` - Android 13+ için medya erişimi

## 📦 4. Capacitor Plugin'leri

- [x] `@capacitor-community/sqlite` - SQLite veritabanı
- [x] `@capacitor/filesystem` - Dosya sistemi erişimi
- [x] `@capacitor-community/media` - Medya dosyaları

## 🏗️ 5. Build Ayarları

- [x] `minSdkVersion` 22 (Android 5.1+) ✅
- [x] `targetSdkVersion` 33 (Android 13+) ✅
- [x] `compileSdkVersion` 33 ✅
- [x] Gradle sync başarılı ✅
- [x] Build hatasız tamamlanıyor ✅

## 🔧 6. Dosya Yapısı

- [x] `android/app/src/main/AndroidManifest.xml` mevcut
- [x] `android/app/src/main/res/values/strings.xml` mevcut
- [x] `android/app/src/main/res/xml/file_paths.xml` mevcut
- [x] `android/app/src/main/java/com/lyricst/app/MainActivity.java` mevcut

## 📋 7. String Resources

- [x] `app_name` = "LYRİC-ST"
- [x] `title_activity_main` = "LYRİC-ST"
- [x] `package_name` = "com.lyricst.app"

## 🚀 8. Build Komutları

```bash
# 1. Web build
npm run build

# 2. Sync
npx cap sync android

# 3. Logo hazırla (gerekirse)
npm run android:prepare

# 4. Android Studio'da aç
npm run android:open
```

## ✅ 9. Son Kontroller

- [x] TypeScript hataları yok (`npm run type-check`) ✅
- [x] Build hatasız tamamlanıyor (`npm run build`) ✅
- [x] Capacitor sync hatasız (`npx cap sync android`) ✅
- [x] Android Studio'da Gradle sync başarılı (Manuel kontrol gerekli)
- [x] Uygulama adı "LYRİC-ST" olarak görünüyor ✅
- [x] Logo doğru görünüyor ✅
- [x] İzinler runtime'da isteniyor (Test gerekli)

## 🎯 10. Release Build

Release build için:

1. **Keystore Oluştur** (ilk kez):
```bash
keytool -genkey -v -keystore lyricst-release.keystore -alias lyricst -keyalg RSA -keysize 2048 -validity 10000
```

2. **Android Studio'da**:
   - Build > Generate Signed Bundle / APK
   - APK veya AAB seç
   - Keystore seç
   - Build al

3. **Gradle ile** (opsiyonel):
```bash
cd android
./gradlew assembleRelease
```

## 📝 Notlar

- Logo dosyaları `logo.jpeg`'den otomatik oluşturuldu
- Tüm izinler AndroidManifest.xml'de tanımlı
- FileProvider yapılandırması mevcut
- Capacitor plugin'leri sync edildi

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

