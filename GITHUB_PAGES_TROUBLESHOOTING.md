# 🔧 GitHub Pages Sorun Giderme

## ❌ Link Görünmüyor Sorunu

### Durum
GitHub Pages ayarları yapıldı ama site linki görünmüyor.

### Çözüm Adımları

#### 1. GitHub Actions Workflow'unu Kontrol Edin

1. Repository'de **Actions** sekmesine gidin
2. **Deploy to GitHub Pages** workflow'unu kontrol edin
3. Eğer workflow çalışmıyorsa veya hata varsa:
   - Workflow'u manuel olarak çalıştırın: **Actions** > **Deploy to GitHub Pages** > **Run workflow**

#### 2. Settings > Pages Ayarlarını Kontrol Edin

Görselde **main** branch seçilmiş görünüyor. İki seçenek var:

**Seçenek A: GitHub Actions Kullan (Önerilen)**
- **Source**: "GitHub Actions" seçin
- Bu durumda workflow otomatik deploy yapacak

**Seçenek B: Branch'den Deploy**
- **Source**: "Deploy from a branch" seçin
- **Branch**: `gh-pages` seçin (workflow bu branch'e deploy yapıyor)
- **Folder**: `/ (root)` seçin

#### 3. Workflow'un Başarılı Olduğunu Kontrol Edin

1. **Actions** sekmesine gidin
2. Son workflow run'ına tıklayın
3. Tüm adımların yeşil (başarılı) olduğunu kontrol edin
4. Eğer hata varsa, hata mesajını okuyun

#### 4. Permissions Kontrolü

Workflow'un çalışması için gerekli permissions:
- ✅ `contents: read`
- ✅ `pages: write`
- ✅ `id-token: write`

Bu permissions workflow dosyasında tanımlı.

#### 5. Manuel Deploy (Hızlı Çözüm)

Eğer workflow çalışmıyorsa, manuel deploy yapabilirsiniz:

```bash
# Build al
npm run build

# gh-pages paketini yükle
npm install -g gh-pages

# GitHub Pages'e deploy et
gh-pages -d dist
```

Bu komut `gh-pages` branch'ine deploy yapacak.

#### 6. Settings'de Branch'i Güncelleyin

Manuel deploy yaptıktan sonra:
1. **Settings** > **Pages**
2. **Source**: "Deploy from a branch"
3. **Branch**: `gh-pages` seçin
4. **Save**

### Beklenen Sonuç

Deploy başarılı olduktan sonra:
- **Settings > Pages** sayfasında site URL'i görünecek
- URL: `https://1sthillman.github.io/LYR-CST/`
- Site birkaç dakika içinde yayında olacak

### Hala Çalışmıyorsa

1. **Actions** sekmesinde workflow loglarını kontrol edin
2. Hata mesajlarını okuyun
3. Workflow'u tekrar çalıştırın
4. Birkaç dakika bekleyin (deploy zaman alabilir)

---

**Not**: İlk deploy genellikle 5-10 dakika sürebilir. Sabırlı olun! ⏳

