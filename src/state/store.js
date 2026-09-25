// Reactive State Store for X4 Station Analyzer
export class StationStore {
  constructor() {
    this.state = {
      activeModules: new Map(),
      workforcePercentage: 100,
      factionEco: 'community',
      blueprintXml: null
    };
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event) {
    this.listeners.forEach(fn => fn(this.state, event));
  }

  updateModule(macroId, count) {
    if (count <= 0) {
      this.state.activeModules.delete(macroId);
    } else {
      this.state.activeModules.set(macroId, count);
    }
    this.notify('MODULES_UPDATED');
  }
}

export const store = new StationStore();
