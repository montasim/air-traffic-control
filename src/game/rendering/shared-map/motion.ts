import type Phaser from "phaser";

/** The player asked for less motion: map effects hold still, drawn once. */
export function prefersStillMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Calls `step` with each frame's elapsed milliseconds until `alive` turns false (the effect's objects were
 * cleared away, as between map previews or shifts) or the scene shuts down, then calls `onStop` once.
 * Every moving map effect runs through here, so none outlives the map it belongs to.
 */
export function animateWhileAlive(scene: Phaser.Scene, alive: () => boolean, step: (delta: number) => void, onStop?: () => void): void {
  let running = true;
  const stop = () => {
    if (!running) return;
    running = false;
    scene.events.off("update", tick);
    onStop?.();
  };
  function tick(_time: number, delta: number): void {
    if (alive()) step(delta);
    else stop();
  }
  scene.events.on("update", tick);
  scene.events.once("shutdown", stop);
}

/**
 * Redraws `graphics` with `draw(seconds)` each frame, starting from `start` seconds, until it is cleared
 * away; drawn once and left still when the player prefers less motion.
 */
export function animateDrawing(scene: Phaser.Scene, graphics: Phaser.GameObjects.Graphics, draw: (seconds: number) => void, start = 0): void {
  draw(start);
  if (prefersStillMotion()) return;
  let clock = start;
  animateWhileAlive(scene, () => !!graphics.scene, (delta) => draw(clock += delta / 1000));
}
