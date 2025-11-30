# 📋 Log Alma Talimatları

## 🎯 Logları Nasıl Alırsınız?

### Yöntem 1: Chrome DevTools (Önerilen - En Kolay)

1. **Android cihazınızı USB ile bilgisayara bağlayın**
2. **Chrome tarayıcısını açın**
3. Adres çubuğuna yazın: `chrome://inspect`
4. **"Remote devices"** bölümünde cihazınızı görün
5. **"inspect"** butonuna tıklayın
6. **Console** sekmesine geçin
7. Uygulamayı başlatın ve "KARAOKE BAŞLAT" butonuna tıklayın
8. **30 saniye** boyunca logları izleyin
9. Console'daki tüm logları **kopyalayın** (Ctrl+A, Ctrl+C)

### Yöntem 2: Android Studio Logcat

1. Android Studio'yu açın
2. **View > Tool Windows > Logcat** (veya Alt+6)
3. Filtre kutusuna yazın: `chromium` veya `WebView`
4. Uygulamayı başlatın
5. Logları kopyalayın

### Yöntem 3: ADB (Terminal)

```bash
# Tüm logları göster
adb logcat

# Sadece console loglarını göster (daha temiz)
adb logcat | grep -E "console|chromium"

# Logları dosyaya kaydet
adb logcat > mikrofon_logs.txt
```

---

## 🔍 Aranacak Loglar

Loglarda şunları arayın:

### Başlatma Logları:
- `[PLAYER] Dummy recorder başlatılıyor...`
- `[DUMMY] Dummy recorder başladı`
- `[SPEECH] Recognition başladı`
- `[PLAYER] Karaoke başlatıldı`

### Hata Logları:
- `❌ [DUMMY]` - Dummy recorder hataları
- `❌ [SPEECH]` - Speech recognition hataları
- `❌ [PLAYER]` - Player hataları

### Restart Logları:
- `🔄 [DUMMY]` - Dummy recorder restart
- `🔄 [SPEECH]` - Speech recognition restart
- `🛑 [SPEECH] Recognition durdu` - onend event

### Durum Logları:
- `🔍 [DUMMY] Keep-alive check` - Her 5 saniyede bir
- `[DUMMY] onstop event` - Recorder duruyor mu?

---

## 📤 Logları Gönderirken

1. **Başlatma anından itibaren** logları alın
2. **En az 30 saniye** boyunca logları kaydedin
3. **Tüm logları** kopyalayın (filtreleme yapmayın)
4. **Özellikle şunları belirtin:**
   - Kaç saniyede bir restart oluyor?
   - Hangi hata mesajları var?
   - `[DUMMY] onstop` ne sıklıkla tetikleniyor?
   - `[SPEECH] onend` ne sıklıkla tetikleniyor?

---

## 🎯 Test Senaryosu

1. Uygulamayı açın
2. Bir şarkı seçin
3. **"KARAOKE BAŞLAT"** butonuna tıklayın
4. **30 saniye** sessiz kalın (hiç konuşmayın)
5. Logları kaydedin
6. Logları kopyalayıp gönderin

---

**Önemli**: Logları gönderirken **tam logları** gönderin, filtreleme yapmayın. Tüm `[DUMMY]`, `[SPEECH]`, `[PLAYER]` logları önemli!

