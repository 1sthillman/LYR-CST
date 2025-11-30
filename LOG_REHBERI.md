# 📋 Log Rehberi - Mikrofon Sorun Giderme

## 🔍 Logları Nasıl Alırsınız?

### Android Studio'da:
1. Android Studio'yu açın
2. **View > Tool Windows > Logcat** (veya Alt+6)
3. Filtre: `chromium` veya `WebView` veya `console`
4. Uygulamayı başlatın ve logları izleyin

### ADB ile (Terminal):
```bash
# Tüm logları göster
adb logcat

# Sadece console.log'ları göster
adb logcat | grep -E "\[DUMMY\]|\[SPEECH\]|\[PLAYER\]"

# Logları dosyaya kaydet
adb logcat > mikrofon_logs.txt
```

### Chrome DevTools (WebView):
1. Android cihazı USB ile bağlayın
2. Chrome'da `chrome://inspect` açın
3. "Inspect" butonuna tıklayın
4. Console sekmesinde logları görün

---

## 📊 Log Formatı

Tüm loglar şu prefix'lerle başlar:
- `[DUMMY]` - DummyRecorderService logları
- `[SPEECH]` - SpeechRecognitionService logları
- `[PLAYER]` - PremiumKaraokePlayer logları

### Önemli Loglar:

#### Başlatma:
- `✅ [DUMMY] Dummy recorder başladı`
- `✅ [SPEECH] Recognition başladı`
- `✅ [PLAYER] Karaoke başlatıldı`

#### Hata:
- `❌ [DUMMY]` - Dummy recorder hataları
- `❌ [SPEECH]` - Speech recognition hataları
- `❌ [PLAYER]` - Player hataları

#### Restart:
- `🔄 [DUMMY]` - Dummy recorder restart
- `🔄 [SPEECH]` - Speech recognition restart

#### Durum:
- `🔍 [DUMMY] Keep-alive check` - Her 5 saniyede bir
- `🛑 [SPEECH] Recognition durdu` - onend event

---

## 🐛 Sorun Tespiti

### Mikrofon sürekli açılıp kapanıyorsa:

1. **Dummy Recorder loglarını kontrol et:**
   - `[DUMMY] onstop event tetiklendi` - Recorder duruyor mu?
   - `[DUMMY] Recorder inactive` - Keep-alive kontrolü
   - `[DUMMY] Restart` - Ne sıklıkla restart oluyor?

2. **Speech Recognition loglarını kontrol et:**
   - `[SPEECH] onend event` - Ne sıklıkla duruyor?
   - `[SPEECH] Restart` - Ne sıklıkla restart oluyor?
   - `[SPEECH] Error` - Hangi hatalar var?

3. **Player loglarını kontrol et:**
   - `[PLAYER] Karaoke başlatıldı` - Başlatma başarılı mı?
   - `[PLAYER] Durum özeti` - Servisler aktif mi?

---

## 📤 Logları Gönderme

Logları kopyalayıp gönderirken:

1. **Başlatma anından itibaren** logları alın
2. **30 saniye** boyunca logları kaydedin
3. **Tüm logları** kopyalayın (filtreleme yapmayın)
4. **Hata mesajlarını** özellikle belirtin

### Örnek Log Formatı:
```
✅ [PLAYER] Dummy recorder başlatılıyor...
✅ [DUMMY] Dummy recorder başladı
🔄 [SPEECH] Recognition yeniden başlatılıyor...
❌ [DUMMY] Recorder hatası: ...
```

---

**Not**: Loglar console'da görünecek. Android Studio Logcat veya Chrome DevTools ile görebilirsiniz.

