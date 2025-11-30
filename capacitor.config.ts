import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lyricst.app',
  appName: 'LYRİC-ST',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
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

