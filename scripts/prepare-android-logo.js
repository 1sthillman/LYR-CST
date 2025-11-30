/**
 * Android Logo Hazırlama Scripti
 * logo.jpeg dosyasını Android için gerekli boyutlara dönüştürür
 * 
 * Kullanım: node scripts/prepare-android-logo.js
 * 
 * Gereksinimler:
 * - sharp: npm install sharp --save-dev
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sharp kütüphanesi yoksa uyarı ver
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (error) {
  console.error('❌ sharp kütüphanesi bulunamadı!');
  console.log('📦 Yüklemek için: npm install sharp --save-dev');
  process.exit(1);
}

const logoPath = path.join(__dirname, '..', 'logo.jpeg');
const androidResPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Android mipmap boyutları (px)
const mipmapSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Round icon boyutları
const roundSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function prepareAndroidLogos() {
  try {
    // Logo dosyasını kontrol et
    if (!fs.existsSync(logoPath)) {
      console.error('❌ logo.jpeg dosyası bulunamadı!');
      console.log('📁 Dosya yolu:', logoPath);
      process.exit(1);
    }

    console.log('🔄 Android logo hazırlanıyor...');

    // Android res klasörünü oluştur
    if (!fs.existsSync(androidResPath)) {
      fs.mkdirSync(androidResPath, { recursive: true });
      console.log('✅ Android res klasörü oluşturuldu');
    }

    // Her mipmap klasörü için logo oluştur
    for (const [mipmap, size] of Object.entries(mipmapSizes)) {
      const mipmapPath = path.join(androidResPath, mipmap);
      if (!fs.existsSync(mipmapPath)) {
        fs.mkdirSync(mipmapPath, { recursive: true });
      }

      // Normal icon
      const iconPath = path.join(mipmapPath, 'ic_launcher.png');
      await sharp(logoPath)
        .resize(size, size, {
          fit: 'cover',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(iconPath);
      console.log(`✅ ${mipmap}/ic_launcher.png oluşturuldu (${size}x${size})`);

      // Round icon
      const roundIconPath = path.join(mipmapPath, 'ic_launcher_round.png');
      await sharp(logoPath)
        .resize(size, size, {
          fit: 'cover',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(roundIconPath);
      console.log(`✅ ${mipmap}/ic_launcher_round.png oluşturuldu (${size}x${size})`);
    }

    console.log('🎉 Tüm Android logoları başarıyla oluşturuldu!');
    console.log('📁 Konum:', androidResPath);
  } catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  }
}

prepareAndroidLogos();

