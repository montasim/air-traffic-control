export class RuntimeEventBus {
  private readonly listeners = new Map<string, Set<(...args: any[]) => void>>();
  on(event: string, listener: (...args: any[]) => void): void {
    let listeners = this.listeners.get(event);
    if (!listeners) this.listeners.set(event, listeners = new Set());
    listeners.add(listener);
  }
  once(event: string, listener: (...args: any[]) => void): void {
    const once = (...args: any[]) => { this.listeners.get(event)?.delete(once); listener(...args); };
    this.on(event, once);
  }
  emit(event: string, ...args: any[]): void {
    for (const listener of Array.from(this.listeners.get(event) ?? [])) listener(...args);
  }
  clear(): void { this.listeners.clear(); }
  off(event: string, listener: (...args: any[]) => void): void { this.listeners.get(event)?.delete(listener); }
}
