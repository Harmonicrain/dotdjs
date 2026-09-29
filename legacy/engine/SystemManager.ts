
import { System } from '../types/systems';

export class SystemManager {
  private systems: System[] = [];
  private systemMap: Map<string, System> = new Map();

  register(system: System) {
    if (this.systemMap.has(system.name)) {
        console.warn(`System ${system.name} already registered.`);
        return;
    }
    
    // Default properties
    if (system.enabled === undefined) system.enabled = true;
    if (system.priority === undefined) system.priority = 0;

    this.systems.push(system);
    this.systemMap.set(system.name, system);
    
    // Sort by priority (asc)
    this.systems.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    if (system.enabled && system.onEnable) system.onEnable();
  }

  init() {
      for (const sys of this.systems) {
          if (sys.init) sys.init();
      }
  }

  unregister(name: string) {
      const system = this.systemMap.get(name);
      if (!system) return;

      if (system.enabled && system.onDisable) system.onDisable();
      if (system.dispose) system.dispose();

      this.systems = this.systems.filter(s => s !== system);
      this.systemMap.delete(name);
  }

  getSystem<T extends System>(name: string): T | undefined {
      return this.systemMap.get(name) as T;
  }

  enable(name: string) {
      const sys = this.systemMap.get(name);
      if (sys && !sys.enabled) {
          sys.enabled = true;
          if (sys.onEnable) sys.onEnable();
      }
  }

  disable(name: string) {
      const sys = this.systemMap.get(name);
      if (sys && sys.enabled) {
          sys.enabled = false;
          if (sys.onDisable) sys.onDisable();
      }
  }

  updateAll(dt: number, now: number) {
    for (const sys of this.systems) {
      if (sys.enabled) {
          try {
              sys.update(dt, now);
          } catch (err) {
              console.error(`System "${sys.name}" threw error during update:`, err);
          }
      }
    }
  }

  dispose() {
      for (const sys of this.systems) {
          if (sys.enabled && sys.onDisable) sys.onDisable();
          if (sys.dispose) sys.dispose();
      }
      this.systems = [];
      this.systemMap.clear();
  }
}
