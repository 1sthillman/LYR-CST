# 🌐 GitHub Pages Kurulum Rehberi

## ✅ Proje GitHub'a Push Edildi!

Proje başarıyla GitHub'a yüklendi: https://github.com/1sthillman/LYR-CST

## 🚀 GitHub Pages'i Aktif Etme

### Yöntem 1: GitHub Actions (Önerilen - Otomatik)

1. GitHub'da repository'nize gidin: https://github.com/1sthillman/LYR-CST
2. **Settings** > **Pages** sekmesine gidin
3. **Source** bölümünden:
   - **Deploy from a branch** seçin
   - **Branch**: `gh-pages` seçin
   - **Folder**: `/ (root)` seçin
   - **Save** butonuna tıklayın

4. **Actions** sekmesine gidin
5. İlk push'tan sonra otomatik olarak workflow çalışacak
6. Workflow tamamlandığında site yayında olacak

**URL**: `https://1sthillman.github.io/LYR-CST/`

### Yöntem 2: Manuel Deploy

```bash
# Build al
npm run build

# gh-pages paketini yükle (global)
npm install -g gh-pages

# GitHub Pages'e deploy et
gh-pages -d dist
```

## ⚙️ GitHub Actions Workflow

`.github/workflows/deploy.yml` dosyası otomatik deploy için hazır:

- Her `main` branch'e push'ta otomatik build
- Build başarılı olursa otomatik deploy
- GitHub Pages'e otomatik yayınlama

## 📝 Önemli Notlar

1. **Base Path**: Vite config'de base path `/LYR-CST/` olarak ayarlandı
2. **HTTPS Gerekli**: Mikrofon erişimi için HTTPS gerekli (GitHub Pages HTTPS kullanır ✅)
3. **Build**: Her push'ta otomatik build ve deploy yapılır

## 🔧 Sorun Giderme

### Site Açılmıyorsa:
1. GitHub Actions'da workflow'un başarılı olduğunu kontrol edin
2. Settings > Pages'de branch'in doğru seçildiğini kontrol edin
3. Birkaç dakika bekleyin (deploy zaman alabilir)

### Mikrofon Çalışmıyorsa:
- GitHub Pages HTTPS kullanır, bu yüzden mikrofon erişimi çalışmalı
- Tarayıcı izinlerini kontrol edin

## 📊 Deployment Durumu

Deployment durumunu kontrol etmek için:
- Repository > **Actions** sekmesine gidin
- Son workflow run'ı kontrol edin

---

**Hazır!** Proje GitHub Pages'de yayında olacak! 🎉

