# 🚀 GitHub Pages Hızlı Çözüm

## ❌ Link Görünmüyor Sorunu

### Sorun
Settings'de ayarları yaptınız ama site linki görünmüyor.

### ✅ Çözüm (3 Adım)

#### 1. Settings > Pages'de Source'u Değiştirin

**ŞU AN**: "Deploy from a branch" seçili (YANLIŞ ❌)

**OLMASI GEREKEN**: "GitHub Actions" seçin (DOĞRU ✅)

**Nasıl Yapılır:**
1. Settings > Pages'e gidin
2. **Source** dropdown'ından **"GitHub Actions"** seçin
3. **Save** butonuna tıklayın

#### 2. Workflow'u Çalıştırın

1. **Actions** sekmesine gidin
2. Sol menüden **"Deploy to GitHub Pages"** workflow'unu bulun
3. Sağ üstte **"Run workflow"** butonuna tıklayın
4. **"Run workflow"** butonuna tekrar tıklayın

#### 3. Bekleyin ve Kontrol Edin

1. **Actions** sekmesinde workflow'un çalıştığını görün
2. Tüm adımların yeşil (✅) olduğunu kontrol edin
3. 5-10 dakika bekleyin
4. **Settings > Pages**'e geri dönün
5. Artık site URL'i görünecek: `https://1sthillman.github.io/LYR-CST/`

---

## 🔍 Hala Çalışmıyorsa

### Workflow Başarısız Oluyorsa

1. **Actions** sekmesinde workflow'a tıklayın
2. Hangi adımda hata olduğunu görün
3. Hata mesajını okuyun
4. Genellikle şu hatalar olur:
   - **npm ci hatası**: `package-lock.json` eksik olabilir
   - **Build hatası**: TypeScript hataları olabilir
   - **Permission hatası**: Settings > Actions > General'de workflow permissions kontrol edin

### Workflow Çalışmıyorsa

1. **Settings** > **Actions** > **General**'e gidin
2. **Workflow permissions** bölümünde:
   - **"Read and write permissions"** seçin
   - **"Allow GitHub Actions to create and approve pull requests"** işaretleyin
   - **Save** butonuna tıklayın

---

## 📋 Kontrol Listesi

- [ ] Settings > Pages'de **"GitHub Actions"** seçili
- [ ] Actions sekmesinde workflow çalıştı
- [ ] Workflow başarılı (tüm adımlar yeşil)
- [ ] 5-10 dakika bekledim
- [ ] Settings > Pages'de site URL'i görünüyor

---

**Önemli**: İlk deploy genellikle 5-10 dakika sürer. Sabırlı olun! ⏳

