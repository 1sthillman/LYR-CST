# 🎯 GitHub Pages - Adım Adım Kurulum

## ✅ Şu Anki Durum

Görsellerden anladığım kadarıyla:
- ✅ Settings > Pages'de **"GitHub Actions"** seçili (DOĞRU!)
- ✅ Actions permissions'da **"Allow all actions"** seçili (DOĞRU!)

## 🚀 Şimdi Yapılacaklar

### Adım 1: Workflow Permissions Kontrolü

1. **Settings** > **Actions** > **General**'e gidin
2. Sayfayı aşağı kaydırın
3. **"Workflow permissions"** bölümünü bulun
4. Şu seçeneklerden birini seçin:
   - ✅ **"Read and write permissions"** (ÖNERİLEN)
   - VEYA
   - ✅ **"Read repository contents and packages permissions"** + **"Allow GitHub Actions to create and approve pull requests"** işaretli

5. **Save** butonuna tıklayın

### Adım 2: Workflow'u Çalıştırın

1. **Actions** sekmesine gidin
2. Sol menüden **"Deploy to GitHub Pages"** workflow'unu bulun
3. Eğer hiç çalışmamışsa:
   - Sağ üstte **"Run workflow"** butonuna tıklayın
   - **"Run workflow"** butonuna tekrar tıklayın
4. Workflow'un çalıştığını görün

### Adım 3: Workflow'un Başarılı Olduğunu Kontrol Edin

1. **Actions** sekmesinde workflow'a tıklayın
2. Tüm adımların yeşil (✅) olduğunu kontrol edin:
   - ✅ Checkout
   - ✅ Setup Node.js
   - ✅ Install dependencies
   - ✅ Build
   - ✅ Setup Pages
   - ✅ Upload artifact
   - ✅ Deploy to GitHub Pages

### Adım 4: Site URL'ini Kontrol Edin

1. **Settings** > **Pages**'e geri dönün
2. Sayfanın en üstünde site URL'i görünecek:
   ```
   Your site is live at https://1sthillman.github.io/LYR-CST/
   ```

## ⏱️ Bekleme Süresi

- İlk deploy: **5-10 dakika** sürebilir
- Sonraki deploy'lar: **2-5 dakika** sürer

## 🔍 Sorun Giderme

### Workflow Çalışmıyorsa

1. **Settings** > **Actions** > **General**'e gidin
2. **"Workflow permissions"** bölümünü kontrol edin
3. **"Read and write permissions"** seçili olduğundan emin olun
4. **Save** butonuna tıklayın
5. Workflow'u tekrar çalıştırın

### Workflow Başarısız Oluyorsa

1. **Actions** sekmesinde workflow'a tıklayın
2. Hangi adımda hata olduğunu görün
3. Hata mesajını okuyun
4. Genellikle şu hatalar olur:
   - **npm ci hatası**: `package-lock.json` eksik
   - **Build hatası**: TypeScript hataları
   - **Permission hatası**: Workflow permissions yanlış

### Site URL'i Hala Görünmüyorsa

1. Workflow'un başarılı olduğundan emin olun
2. 10 dakika bekleyin
3. Sayfayı yenileyin (F5)
4. **Settings** > **Pages**'e tekrar gidin

---

## 📋 Kontrol Listesi

- [ ] Settings > Pages'de **"GitHub Actions"** seçili
- [ ] Settings > Actions > General'de **"Read and write permissions"** seçili
- [ ] Actions sekmesinde workflow çalıştı
- [ ] Workflow başarılı (tüm adımlar yeşil ✅)
- [ ] 5-10 dakika bekledim
- [ ] Settings > Pages'de site URL'i görünüyor

---

**Önemli**: Workflow permissions ayarları kritik! Mutlaka kontrol edin! 🔐

