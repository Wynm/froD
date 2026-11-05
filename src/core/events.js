// Minimal event emitter with wildcard support. Pure module.
export class Emitter {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) { this.map.get(name)?.delete(fn); }
  emit(name, data) {
    this.map.get(name)?.forEach(fn => fn(data, name));
    this.map.get('*')?.forEach(fn => fn(data, name));
  }
}
