#!/bin/bash

# Android Kurulum Scripti
# Bu script Android projesini oluşturur ve yapılandırır

echo "🚀 Android kurulumu başlatılıyor..."

# 1. Build al
echo "📦 Web build alınıyor..."
npm run build

# 2. Android platform ekle (yoksa)
if [ ! -d "android" ]; then
    echo "📱 Android platform ekleniyor..."
    npx cap add android
fi

# 3. Sync
echo "🔄 Capacitor sync yapılıyor..."
npx cap sync android

# 4. Logo hazırla (eğer script varsa)
if [ -f "scripts/prepare-android-logo.js" ]; then
    echo "🎨 Android logoları hazırlanıyor..."
    node scripts/prepare-android-logo.js
fi

echo "✅ Android kurulumu tamamlandı!"
echo "📱 Android Studio'da açmak için: npx cap open android"



