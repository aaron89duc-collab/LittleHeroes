/** Where the game runs: browser (Vercel) or the Android app (Capacitor WebView). */

type CapWindow = Window & { Capacitor?: { isNativePlatform?: () => boolean } };

/** True inside the Android app built with Capacitor. */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!(window as CapWindow).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/**
 * Public web address of the game. The app itself is served from https://localhost, so it uses this
 * for the co-op TURN list (/api/ice) and for invite links. Override at build time with VITE_PUBLIC_URL.
 */
export const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL || 'https://littleheroes.vercel.app').replace(/\/+$/, '');
