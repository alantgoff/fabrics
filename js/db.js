/* IndexedDB wrapper — fabrics and the owned-thread drawer live on-device. */
const DB = (() => {
  const DB_NAME = 'fabric-stash';
  const STORE = 'fabrics';
  const T_STORE = 'threads';
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(T_STORE)) {
          db.createObjectStore(T_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      fn(t.objectStore(store));
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    }));
  }

  function getAllFrom(store) {
    return open().then(db => new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    }));
  }

  return {
    getAll() { return getAllFrom(STORE); },
    put(fabric) { return tx(STORE, 'readwrite', s => s.put(fabric)); },
    delete(id) { return tx(STORE, 'readwrite', s => s.delete(id)); },
    putMany(fabrics) { return tx(STORE, 'readwrite', s => fabrics.forEach(f => s.put(f))); },
    getThreads() { return getAllFrom(T_STORE).catch(() => []); },
    putThread(thread) { return tx(T_STORE, 'readwrite', s => s.put(thread)).catch(() => {}); },
    deleteThread(id) { return tx(T_STORE, 'readwrite', s => s.delete(id)).catch(() => {}); },
  };
})();
