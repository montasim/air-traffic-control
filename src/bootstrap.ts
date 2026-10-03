// This entry stays small so recovery works even when the game bundle cannot load.
const bootScreen = document.querySelector<HTMLElement>('#boot-screen')!;
const bootDetails = bootScreen.querySelector<HTMLElement>('.boot-details')!;
const message = document.querySelector<HTMLElement>('#boot-message')!;
const retry = document.querySelector<HTMLAnchorElement>('#boot-retry')!;
// Once revealed, the name stays up at least this long so the launch never flashes past.
const minimumRevealMs = import.meta.env.MODE === 'android' ? 900 : 0;
let ready = false;
let revealedAt = 0;

/** Lift the logo and fade in the name and status, ending with the whole block centred. */
function revealBoot(): void {
  if (revealedAt) return;
  revealedAt = performance.now();
  const gap = parseFloat(getComputedStyle(bootDetails).marginTop) || 0;
  bootScreen.style.setProperty('--boot-reveal-shift', `${-(gap + bootDetails.offsetHeight) / 2}px`);
  bootScreen.classList.add('is-revealed');
}

// Start after the logo has painted. On Android that logo matches the native splash exactly,
// so the splash is dismissed underneath an identical frame before the reveal begins.
requestAnimationFrame(() => requestAnimationFrame(() => {
  if (import.meta.env.MODE === 'android') {
    void import('@capacitor/splash-screen')
      .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 150 }))
      .catch(() => undefined)
      .finally(() => window.setTimeout(revealBoot, 150));
  } else {
    revealBoot();
  }
}));

/** Resolves once the home map preview has drawn (or after `limitMs`), so the menu never fades in half-filled. */
function menuArtReady(limitMs: number): Promise<void> {
  const preview = document.querySelector<HTMLImageElement>('#home-map-preview');
  if (!preview || (preview.complete && preview.naturalWidth > 0)) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, limitMs);
    preview.addEventListener('load', () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

function showFailure(text: string): void {
  if (ready) return;
  revealBoot();
  document.documentElement.dataset.boot = 'error';
  bootScreen.setAttribute('aria-busy', 'false');
  message.textContent = text;
  retry.hidden = false;
}

const timeout = window.setTimeout(() => {
  showFailure('This is taking longer than expected. You can wait, or try again.');
}, 20_000);

document.addEventListener('game-ready', () => {
  ready = true;
  window.clearTimeout(timeout);
  const showMenu = () => {
    delete document.documentElement.dataset.boot;
    document.querySelector<HTMLElement>('#app')!.inert = false;
    bootScreen.setAttribute('aria-busy', 'false');
    bootScreen.setAttribute('aria-hidden', 'true');
    bootScreen.inert = true;
    bootScreen.classList.add('is-ready');
    window.setTimeout(() => bootScreen.remove(), 340);
  };
  const wait = revealedAt ? revealedAt + minimumRevealMs - performance.now() : minimumRevealMs;
  if (!revealedAt) revealBoot();
  if (import.meta.env.MODE === 'android') {
    // Touch-first: holding the crossfade costs nothing, unlike web where main.ts focuses the menu right away.
    void Promise.all([menuArtReady(1500), new Promise((resolve) => window.setTimeout(resolve, Math.max(0, wait)))]).then(showMenu);
  } else if (wait > 0) {
    window.setTimeout(showMenu, wait);
  } else {
    showMenu();
  }
}, { once: true });

void import('./main').catch((error: unknown) => {
  window.clearTimeout(timeout);
  showFailure('Your airfield could not load. Check your connection and try again.');
  console.error('Game startup failed', error);
});
