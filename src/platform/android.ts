import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

/**
 * Native Android behavior around the shared game shell.
 * `onBack` dismisses the topmost layer and returns false when nothing is left,
 * in which case the app moves to the background instead of closing.
 */
export function installAndroidShell(onBack: () => boolean): void {
  void App.addListener('backButton', () => {
    if (!onBack()) void App.minimizeApp();
  });

  // The WebView must never leave the bundled game; outbound links open in the system browser.
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || !(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[href]');
    if (!link || new URL(link.href).origin === location.origin) return;
    event.preventDefault();
    void Browser.open({ url: link.href });
  });
}
