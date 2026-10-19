import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android app (APK) wrapper. The game itself is the same web build (dist/);
 * Capacitor puts it in a native WebView. Build: see docs/ANDROID.md.
 */
const config: CapacitorConfig = {
  appId: 'vn.littleheroes.royalcitybrawl',
  appName: 'Little Heroes',
  webDir: 'dist',
  android: {
    // keeps localStorage/IndexedDB of the https://localhost origin stable between updates
    allowMixedContent: false,
    backgroundColor: '#060a1c',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
