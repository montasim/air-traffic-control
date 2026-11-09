/** Slack under 1000/30 ms so a 60 Hz screen steps every second frame and a 120 Hz one every fourth. */
const FRAME_MS = 1000 / 30 - 4;

interface Loop {
  callback: (time: number, delta: number) => void;
}

/**
 * Steps the game (update and draw) about 30 times a second, unless `fullRate()` says otherwise (a finger
 * drawing a route). Each step gets all the time since the last one, so the world keeps real time.
 */
export function capFrameRate(loop: Loop, fullRate: () => boolean): void {
  const step = loop.callback;
  let carried = 0;
  loop.callback = (time, delta) => {
    carried += delta;
    if (carried < FRAME_MS && !fullRate()) return;
    step(time, carried);
    carried = 0;
  };
}
