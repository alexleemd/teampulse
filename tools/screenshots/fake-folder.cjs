// Runs via page.addInitScript(fn, arg) BEFORE any page script. Replaces the
// folder picker and IndexedDB with in-memory fakes, so the app opens the
// fictional sample team without anyone clicking through the folder dialog.
// arg = { files: { 'team-pulse.json': '<json text>' }, folderName, storeHandle, permission, noFsApi, seed }
function teamPulseFakeInit(arg) {
  const opts = arg || {};

  // 1. Deterministic Math.random (mulberry32). TP_AMBIENT seeds motes and orbs with it.
  let s = (opts.seed ?? 12345) >>> 0;
  Math.random = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  if (opts.noFsApi) {
    // Headless Chromium ships showDirectoryPicker natively, so hide it to reach the inline #startupGate path.
    ['showDirectoryPicker', 'showOpenFilePicker'].forEach((key) => Object.defineProperty(window, key, { value: undefined, configurable: true, writable: true }));
    return;
  }

  // 2. In-memory File System Access fake. Contents live in a closure Map so
  //    handle instances carry only cloneable own props (kind, name).
  const store = new Map(Object.entries(opts.files || {}));
  window.__tpFiles = store; // test hook: read what the app wrote
  const permission = opts.permission || 'granted';

  class FakeWritable {
    constructor(name) { this._name = name; this._chunks = []; }
    async write(value) { this._chunks.push(typeof value === 'string' ? value : String(value)); }
    async close() { store.set(this._name, this._chunks.join('')); }
  }
  class FakeFileHandle {
    constructor(name) { this.kind = 'file'; this.name = name; }
    async getFile() { return new File([store.get(this.name) ?? ''], this.name, { type: 'application/json', lastModified: 0 }); }
    async createWritable() { return new FakeWritable(this.name); }
    async queryPermission() { return permission; }
    async requestPermission() { return 'granted'; }
  }
  class FakeDirectoryHandle {
    constructor(name) { this.kind = 'directory'; this.name = name; }
    async getFileHandle(name, options = {}) {
      if (!store.has(name)) {
        if (!options.create) throw new DOMException(`${name} not found`, 'NotFoundError');
        store.set(name, '');
      }
      return new FakeFileHandle(name);
    }
    async queryPermission() { return permission; }
    async requestPermission() { return 'granted'; }
  }
  const dir = new FakeDirectoryHandle(opts.folderName || 'Team Pulse Demo');
  window.showDirectoryPicker = async () => dir;
  window.showOpenFilePicker = async () => [new FakeFileHandle('team-pulse.json')];

  if (opts.realIdb) return; // keep the browser's IndexedDB (click-to-connect path)

  // 3. Fake IndexedDB so getStoredFolderHandle() returns the LIVE fake
  //    (a real IDB would structured-clone it and strip the methods).
  const idb = new Map();
  if (opts.storeHandle) idb.set('connected-data-folder', dir);
  const later = (fn) => setTimeout(fn, 0);
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    createObjectStore() {},
    close() {},
    transaction() {
      const tx = { error: null, oncomplete: null, onerror: null, onabort: null };
      tx.objectStore = () => ({
        put(value, key) { idb.set(key, value); later(() => tx.oncomplete && tx.oncomplete()); return {}; },
        delete(key) { idb.delete(key); later(() => tx.oncomplete && tx.oncomplete()); return {}; },
        get(key) {
          const req = { result: idb.get(key), error: null, onsuccess: null, onerror: null };
          later(() => { req.onsuccess && req.onsuccess(); tx.oncomplete && tx.oncomplete(); });
          return req;
        }
      });
      return tx;
    }
  };
  const fakeFactory = {
    open() {
      const req = { result: fakeDb, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      later(() => req.onsuccess && req.onsuccess());
      return req;
    }
  };
  Object.defineProperty(window, 'indexedDB', { value: fakeFactory, configurable: true, writable: true });
}
module.exports = { teamPulseFakeInit };
