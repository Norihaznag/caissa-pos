// Stub for expo-sqlite on web
// The actual web implementation uses IndexedDB in offline-db.web.ts

export const openDatabaseAsync = async (name: string) => {
  console.warn('[Web] expo-sqlite is not available on web. Using IndexedDB instead.');
  return null;
};

export const SQLiteDatabase = class {
  execAsync() { return Promise.resolve(); }
  runAsync() { return Promise.resolve({ lastInsertRowId: 0, changes: 0 }); }
  getFirstAsync() { return Promise.resolve(null); }
  getAllAsync() { return Promise.resolve([]); }
};
