
interface GameTimer {
  id: string;
  remaining: number;  // seconds
  callback: () => void;
  isPaused: boolean;
}

export class TimerManager {
  private timers: GameTimer[] = [];

  schedule(id: string, durationMs: number, callback: () => void) {
    // Remove existing timer with same id (prevents double-actions)
    this.cancel(id);
    this.timers.push({ id, remaining: durationMs / 1000, callback, isPaused: false });
  }

  cancel(id: string) {
    this.timers = this.timers.filter(t => t.id !== id);
  }

  update(dt: number) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const t = this.timers[i];
      if (t.isPaused) continue;
      t.remaining -= dt;
      if (t.remaining <= 0) {
        t.callback();
        this.timers.splice(i, 1);
      }
    }
  }

  pauseAll() { this.timers.forEach(t => t.isPaused = true); }
  resumeAll() { this.timers.forEach(t => t.isPaused = false); }
  clear() { this.timers = []; }
}
