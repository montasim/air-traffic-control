import { RuntimeEventBus } from './events';
import type { GameplayRuntime } from './types';

/** Loads a backend only when selected; retired loads cannot attach a second live game. */
export class DeferredRuntime implements GameplayRuntime {
  readonly events = new RuntimeEventBus();
  private inner?: GameplayRuntime;
  private disposed = false;
  private wantsFrames = true;
  constructor(readonly world: Readonly<{width:number;height:number}>, factory: () => Promise<GameplayRuntime>) {
    void factory().then(runtime => {
      if (this.disposed) { runtime.destroy(); return; }
      this.inner = runtime;
      for (const event of ['frame','scene-ready','hud-update','flight-message','feedback','landing','route-coach','run-state','game-over','route-status','traffic-warning','runtime-error']) {
        runtime.events.on(event, (...args: any[]) => this.events.emit(event,...args));
      }
      if (this.wantsFrames) runtime.wake(); else runtime.sleep();
    }).catch(error => { if (!this.disposed) this.events.emit('runtime-error',error); });
  }
  get running() {return this.inner?.running ?? false;}
  getSession() {return this.inner?.getSession();}
  wake() {this.wantsFrames=true;this.inner?.wake();}
  sleep() {this.wantsFrames=false;this.inner?.sleep();}
  captureFrame(callback:(canvas:HTMLCanvasElement)=>void) {
    if (this.disposed) return;
    if (this.inner) this.inner.captureFrame(callback);
    else this.events.once('scene-ready',()=>this.inner?.captureFrame(callback));
  }
  destroy() {this.disposed=true;this.inner?.destroy();this.inner=undefined;this.events.clear();}
}
