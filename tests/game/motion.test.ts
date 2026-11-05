import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { animateWhileAlive } from '../../src/game/rendering/shared-map/motion';

/** Just enough of a scene's event emitter for the frame loop. */
function fakeScene() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const on = (name: string, handler: (...args: unknown[]) => void) => { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name)!.add(handler); };
  const events = {
    on,
    once: (name: string, handler: (...args: unknown[]) => void) => { const wrapped = (...args: unknown[]) => { handlers.get(name)!.delete(wrapped); handler(...args); }; on(name, wrapped); },
    off: (name: string, handler: (...args: unknown[]) => void) => handlers.get(name)?.delete(handler),
    emit: (name: string, ...args: unknown[]) => [...(handlers.get(name) ?? [])].forEach((handler) => handler(...args)),
    count: (name: string) => handlers.get(name)?.size ?? 0,
  };
  return { scene: { events } as unknown as Phaser.Scene, events };
}

describe('animateWhileAlive', () => {
  it('steps each frame and stops once its objects are gone', () => {
    const { scene, events } = fakeScene();
    let alive = true;
    const step = vi.fn();
    const onStop = vi.fn();
    animateWhileAlive(scene, () => alive, step, onStop);
    events.emit('update', 0, 16);
    events.emit('update', 0, 17);
    expect(step.mock.calls).toEqual([[16], [17]]);
    alive = false;
    events.emit('update', 0, 16);
    expect(step).toHaveBeenCalledTimes(2);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(events.count('update')).toBe(0);
  });

  it('stops when the scene shuts down, and only once', () => {
    const { scene, events } = fakeScene();
    const onStop = vi.fn();
    animateWhileAlive(scene, () => true, vi.fn(), onStop);
    events.emit('shutdown');
    events.emit('update', 0, 16);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(events.count('update')).toBe(0);
  });
});
