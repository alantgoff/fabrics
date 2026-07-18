/* IndexedDB wrapper — all fabric data lives on-device. */
const DB = (() => {
  const DB_NAME = 'fabric-stash';
  const STORE = 'fabrics';
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      const result = fn(store);
      t.oncomplete = () => resolve(result && result.result !== undefined ? result.result : undefined);
      t.onerror = () => reject(t.error);
    }));
  }

  return {
    getAll() {
      return open().then(db => new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      }));
    },
    get(id) {
      return open().then(db => new Promise((resolve, reject) => {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }));
    },
    put(fabric) { return tx('readwrite', s => s.put(fabric)); },
    delete(id) { return tx('readwrite', s => s.delete(id)); },
    putMany(fabrics) {
      return tx('readwrite', s => { fabrics.forEach(f => s.put(f)); });
    },
  };
})();
