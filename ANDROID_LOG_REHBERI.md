# 📱 Android Log Rehberi - Detaylı Log Sistemi

## 🎯 Genel Bakış

Android versiyonunda artık **web versiyonundaki kadar detaylı loglar** var! Tüm loglar Android Logcat'e yazılıyor ve web formatına uygun şekilde formatlanıyor.

---

## 📊 Log Tag'leri

Android Logcat'te logları filtrelemek için şu tag'leri kullanabilirsiniz:

### Ana Tag'ler:
- **`LYRICST`** - Tüm loglar (genel filtre)
- **`LYRICST_SPEECH`** - Speech Recognition logları
- **`LYRICST_MATCHER`** - Lyrics Matcher logları
- **`LYRICST_PLAYER`** - Player logları
- **`LYRICST_DUMMY`** - Dummy Recorder logları
- **`LYRICST_AUDIO`** - Audio Context logları
- **`LYRICST_MOBILE`** - Mobil özel loglar
- **`LYRICST_WEBVIEW`** - WebView console logları

---

## 🔍 Logları Görüntüleme

### 1. Android Studio Logcat

1. Android Studio'yu açın
2. **View > Tool Windows > Logcat** (veya Alt+6)
3. Filtre kutusuna tag yazın:
   ```
   LYRICST_SPEECH
   ```
   veya
   ```
   LYRICST
   ```

### 2. ADB ile Terminal

```bash
# Tüm LYRICST loglarını göster
adb logcat -s LYRICST

# Sadece Speech Recognition logları
adb logcat -s LYRICST_SPEECH

# Sadece Matcher logları
adb logcat -s LYRICST_MATCHER

# Tüm logları göster (filtreleme yok)
adb logcat | grep LYRICST

# Logları dosyaya kaydet
adb logcat -s LYRICST:* > android_logs.txt
```

### 3. Chrome DevTools (WebView)

1. Android cihazı USB ile bağlayın
2. Chrome'da `chrome://inspect` açın
3. "Inspect" butonuna tıklayın
4. Console sekmesinde logları görün

---

## 📋 Log Formatı

Tüm loglar web versiyonundaki gibi formatlanıyor:

```
[2025-11-30T22:32:01.581Z] [LOG] 🎤 [SPEECH] Kelime algılandı: "değişmemi" | Confidence: 0.90 | Type: INTERIM | Original: "değişmemi" | Lang: tr-TR
```

**Format:**
- `[timestamp]` - ISO 8601 formatında zaman damgası
- `[LOG]` - Log tipi (LOG, ERROR, WARNING)
- `🎤 [SPEECH]` - Log kategorisi ve emoji
- Detaylı bilgiler (Confidence, Type, Original, Lang, vb.)

---

## 🔍 Önemli Log Örnekleri

### Speech Recognition Başlatma:
```
[2025-11-30T22:32:01.000Z] [LOG] ✅ [NATIVE SPEECH] Native Speech Recognition başlatıldı
[2025-11-30T22:32:01.001Z] [LOG] 📱 [NATIVE SPEECH] startListening() çağrıldı
```

### Kelime Algılama:
```
[2025-11-30T22:32:01.581Z] [LOG] 🎤 [SPEECH] Kelime algılandı: "değişmemi" | Confidence: 0.90 | Type: INTERIM | Original: "değişmemi" | Lang: tr-TR
```

### Eşleştirme:
```
[2025-11-30T22:32:01.582Z] [LOG] 🔍 [MATCHER] Eşleştirme kontrolü: "değişmemi" | Mevcut pozisyon: 93/339 | Hedef kelime: "olmam" | Similarity: 0.85 | Threshold: 0.35 | MinSimilarity: 0.70 | Confidence: 0.90 | MinConfidence: 0.45 | PartialMatch: true
[2025-11-30T22:32:01.595Z] [LOG] ✅ [MATCHER] EŞLEŞME BAŞARILI! "değil" -> "değil" | Pozisyon: 94 -> 95 | Similarity: 1.00 | Confidence: 0.90 | Doğru: true
```

### Hatalar:
```
[2025-11-30T22:32:01.592Z] [LOG] ❌ [MATCHER] Eşleşme bulunamadı: "yok" | Mevcut pozisyon: 94/339 | Hedef: "değil" | Similarity: 0.00 | Threshold: 0.35 | Confidence: 0.90 | BestMatch: 0.70 (index: 101)
```

---

## 🐛 Sorun Giderme

### Loglar görünmüyorsa:

1. **Android Studio Logcat'i kontrol edin:**
   - Logcat penceresi açık mı?
   - Filtre doğru mu? (LYRICST yazın)
   - Cihaz seçili mi?

2. **ADB bağlantısını kontrol edin:**
   ```bash
   adb devices
   ```

3. **Uygulama çalışıyor mu?**
   - Uygulamayı yeniden başlatın
   - Logcat'i temizleyin ve tekrar deneyin

4. **WebView console logları:**
   - Chrome DevTools ile kontrol edin
   - `chrome://inspect` açın

---

## 📊 Log Seviyeleri

- **`Log.d()` (DEBUG)** - Tüm detaylı loglar
- **`Log.i()` (INFO)** - Bilgi logları
- **`Log.w()` (WARNING)** - Uyarı logları
- **`Log.e()` (ERROR)** - Hata logları

---

## 🎯 Filtreleme İpuçları

### Sadece başarılı eşleşmeleri görmek:
```bash
adb logcat -s LYRICST_MATCHER | grep "EŞLEŞME BAŞARILI"
```

### Sadece hataları görmek:
```bash
adb logcat -s LYRICST | grep "❌"
```

### Sadece Speech Recognition logları:
```bash
adb logcat -s LYRICST_SPEECH
```

### Belirli bir kelimeyi aramak:
```bash
adb logcat -s LYRICST | grep "değişmemi"
```

---

## ✅ Log Sistemi Özellikleri

1. **Web Formatına Uygun:** Web versiyonundaki loglar ile aynı format
2. **Timestamp:** Her log ISO 8601 formatında zaman damgası içerir
3. **Kategorize:** Loglar kategorilere ayrılmış (SPEECH, MATCHER, PLAYER, vb.)
4. **Detaylı:** Her log maksimum bilgi içerir
5. **Filtrelenebilir:** Tag'lere göre kolayca filtreleme yapılabilir

---

## 📝 Notlar

- Tüm loglar Android Logcat'e yazılıyor
- WebView console logları otomatik olarak yakalanıyor
- Native Android logları da aynı formatta yazılıyor
- Loglar performansı etkilemez (production'da kapatılabilir)

---

**Artık Android'de de web versiyonundaki kadar detaylı loglar var! 🎉**


