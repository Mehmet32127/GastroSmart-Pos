import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gastrosmart.pos',
  appName: 'GastroSmart POS',
  webDir: 'launcher',          // React build değil, sadece launcher sayfası
  server: {
    androidScheme: 'http',
    cleartext: true,           // HTTP (LAN) erişimi için gerekli
  },
  android: {
    backgroundColor: '#0f1117',
  },
};

export default config;
