/**
 * Game messages: every one reaches screen readers through the live status region, and only those
 * that explain a failed input (a rejected route) also flash on screen, so play stays quiet.
 */
export function createAnnouncer(status: HTMLElement, banner: HTMLElement) {
  let bannerTimer = 0;
  const flash = (message: string): void => {
    banner.textContent = message;
    banner.hidden = false;
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => { banner.hidden = true; }, 2800);
  };
  return {
    flash,
    announce(message: string): void {
      status.textContent = "";
      if (message.startsWith("Route not added")) flash(message);
      // Cleared first and set on the next frame, so a repeated message is read again.
      requestAnimationFrame(() => { status.textContent = message; });
    },
  };
}
