import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lyricst.app',
  appName: 'LYRİC-ST',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // LOCAL BUILD KULLAN - GitHub Pages yerine local dist klasörünü kullan
    // url: 'https://1sthillman.github.io/LYR-CST/', // COMMENT OUT - Local build kullan
    cleartext: false, // HTTPS kullan
  },
  // Android izinleri - kesintisiz dinleme için (dummy.md)
  android: {
    permissions: [
      'RECORD_AUDIO',
      'FOREGROUND_SERVICE',
      'WAKE_LOCK',
      'MODIFY_AUDIO_SETTINGS',
    ],
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true, // Debug için (production'da false yapılabilir)
  },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
      androidMode: 'encryption',
    },
    Media: {
      iosPermissions: ['photo', 'camera', 'microphone'],
    },
  },
};

export default config;

