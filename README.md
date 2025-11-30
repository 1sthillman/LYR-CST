# 🎤 LYRİC-ST - Karaoke Not Pro

Modern, akıllı ve hızlı karaoke uygulaması. Gerçek zamanlı ses tanıma ile şarkı sözlerini takip edin.

## ✨ Özellikler

- 🎵 **Gerçek Zamanlı Ses Tanıma**: Web Speech API ile anlık kelime algılama
- 📱 **Web & Android Desteği**: Hem web hem de Android platformlarında çalışır
- 🎨 **Modern UI**: Framer Motion animasyonları ve Tailwind CSS ile güzel arayüz
- 📊 **Performans Takibi**: Doğruluk oranı ve ilerleme takibi
- 💾 **Yerel Veritabanı**: IndexedDB (Web) ve SQLite (Android) desteği
- 🎯 **Akıllı Eşleştirme**: Adaptive threshold ile akıllı kelime eşleştirme

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Node.js 18+
- npm veya yarn

### Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Production build
npm run build
```

## 📱 Android Build

```bash
# Android için hazırla
npm run android:prepare

# Build ve sync
npm run android:sync

# Android Studio'da aç
npm run android:open
```

## 🌐 GitHub Pages

Bu proje GitHub Pages'de yayınlanabilir:

1. Repository'yi GitHub'a push edin
2. Settings > Pages > Source: `gh-pages` branch seçin
3. Build otomatik olarak deploy edilecek

### Manuel Deploy

```bash
# Build al
npm run build

# GitHub Pages için deploy
npm install -g gh-pages
gh-pages -d dist
```

## 🛠️ Teknolojiler

- **React 18** - UI Framework
- **TypeScript** - Type Safety
- **Vite** - Build Tool
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Capacitor** - Native Mobile
- **Web Speech API** - Speech Recognition
- **SQLite** - Database (Android)
- **IndexedDB** - Database (Web)

## 📁 Proje Yapısı

```
src/
├── components/     # React bileşenleri
├── services/       # Servisler (Speech, Audio, Database)
├── engine/         # Eşleştirme motorları
├── database/       # Veritabanı adaptörleri
├── utils/          # Yardımcı fonksiyonlar
└── types/          # TypeScript tipleri
```

## 🎯 Kullanım

1. Şarkı ekleyin (başlık, sanatçı, sözler)
2. Müzik dosyası yükleyin (opsiyonel)
3. "KARAOKE BAŞLAT" butonuna tıklayın
4. Mikrofon izni verin
5. Şarkı sözlerini söyleyin ve takip edin!

## 🔧 Geliştirme

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Preview production build
npm run preview
```

## 📝 Lisans

Bu proje özel bir projedir.

## 👤 Yazar

1sthillman

---

**Not**: Bu uygulama Web Speech API kullanır. Tarayıcı desteği gereklidir.
