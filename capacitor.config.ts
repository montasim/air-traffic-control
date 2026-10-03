import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.montasim.airtrafficcontrol',
  appName: 'Air Traffic Control',
  webDir: 'dist-android',
  android: {
    backgroundColor: '#29483e',
  },
  plugins: {
    // The page's own boot screen takes over immediately; this is only a fallback.
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#29483e',
      showSpinner: false,
    },
    // MainActivity hides the system bars and passes the camera cutout to CSS instead (no WebView padding).
    SystemBars: {
      insetsHandling: 'disable',
    },
  },
};

export default config;
