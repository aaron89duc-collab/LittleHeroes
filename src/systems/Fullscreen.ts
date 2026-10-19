/**
 * Mobile full-screen helper.
 * - Android / desktop: Fullscreen API on the page root + landscape orientation lock (needs a user gesture).
 * - iPhone Safari has no Fullscreen API for pages: the game is a PWA (manifest + apple meta tags),
 *   so "Add to Home Screen" launches it full screen without browser bars.
 */
import { isNativeApp } from './Platform';

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> };
type FsEl = HTMLElement & { webkitRequestFullscreen?: (opts?: unknown) => Promise<void> };

export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

export const isIOS = (): boolean =>
  typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  // the Android app is always full screen (immersive mode set by MainActivity)
  (isNativeApp() ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export function fullscreenSupported(): boolean {
  if (isNativeApp()) return false; // nothing to toggle in the app
  const el = document.documentElement as FsEl;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement) || isStandalone();
}

async function lockLandscape(): Promise<void> {
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.('landscape');
  } catch {
    /* not allowed on this device — the rotate hint covers it */
  }
}

/** Must be called from inside a pointer/click/key handler. */
export async function enterFullscreen(): Promise<boolean> {
  if (isFullscreen()) return true;
  const el = document.documentElement as FsEl;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
    await lockLandscape();
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  const d = document as FsDoc;
  try {
    if (d.fullscreenElement) await document.exitFullscreen();
    else if (d.webkitFullscreenElement) await d.webkitExitFullscreen?.();
  } catch {
    /* ignore */
  }
}

export async function toggleFullscreen(): Promise<void> {
  const d = document as FsDoc;
  if (d.fullscreenElement || d.webkitFullscreenElement) await exitFullscreen();
  else await enterFullscreen();
}

/** On phones/tablets: go full screen on the first tap (browsers require a gesture). */
export function installAutoFullscreen(): void {
  if (!isTouchDevice() || !fullscreenSupported()) return;
  const handler = (): void => {
    void enterFullscreen();
  };
  document.addEventListener('pointerup', handler, { once: true, capture: true });
  // re-enter after the user leaves full screen and taps again
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) document.addEventListener('pointerup', handler, { once: true, capture: true });
  });
}

export const isInAppBrowser = (): boolean =>
  typeof navigator !== 'undefined' &&
  // our own Android app is a WebView too ("wv" in its user agent)
  !isNativeApp() &&
  /FBAN|FBAV|FB_IAB|Instagram|Zalo|Line\/|Messenger|TikTok|wv\)/i.test(navigator.userAgent);

/**
 * Touch devices get a start gate: a real button tap is the most reliable user gesture for the
 * Fullscreen API (Android), and on iPhone it explains "Add to Home Screen".
 */
export function installFullscreenGate(): void {
  if (!isTouchDevice() || isStandalone() || isFullscreen()) return;
  const gate = document.getElementById('fs-gate');
  const go = document.getElementById('fs-go') as HTMLButtonElement | null;
  const msg = document.getElementById('fs-msg');
  const skip = document.getElementById('fs-skip');
  if (!gate || !go || !msg || !skip) return;
  const hide = (): void => gate.classList.remove('show');
  if (isInAppBrowser()) {
    msg.textContent = 'Bạn đang mở trong ứng dụng (Zalo/Facebook...). Hãy bấm ⋮ → "Mở bằng trình duyệt" (Chrome/Safari) để chơi toàn màn hình.';
  } else if (!fullscreenSupported() && isIOS()) {
    go.textContent = '▶ CHƠI NGAY';
    msg.textContent = 'iPhone không cho web toàn màn hình. Để chơi full: bấm nút Chia sẻ ⬆ của Safari → "Thêm vào MH chính", rồi mở game từ biểu tượng mới.';
  } else {
    msg.textContent = 'Xoay ngang điện thoại để chơi. Game sẽ ẩn thanh địa chỉ và thanh điều hướng.';
  }
  go.addEventListener('click', () => {
    void enterFullscreen().then(hide);
    hide();
  });
  skip.addEventListener('click', hide);
  gate.classList.add('show');
}
