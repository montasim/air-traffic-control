// This entry stays small so recovery works even when the game bundle cannot load.
const bootScreen = document.querySelector<HTMLElement>('#boot-screen')!;
const message = document.querySelector<HTMLElement>('#boot-message')!;
const retry = document.querySelector<HTMLAnchorElement>('#boot-retry')!;
let ready = false;

function showFailure(text: string): void {
  if (ready) return;
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
  delete document.documentElement.dataset.boot;
  document.querySelector<HTMLElement>('#app')!.inert = false;
  bootScreen.setAttribute('aria-busy', 'false');
  bootScreen.setAttribute('aria-hidden', 'true');
  bootScreen.inert = true;
  bootScreen.classList.add('is-ready');
  window.setTimeout(() => bootScreen.remove(), 200);
}, { once: true });

void import('./main').catch((error: unknown) => {
  window.clearTimeout(timeout);
  showFailure('Your airfield could not load. Check your connection and try again.');
  console.error('Game startup failed', error);
});
