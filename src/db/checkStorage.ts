/** IndexedDB が実際に開けるかを確認する（プライベートモード等では失敗する） */
export function checkStorage(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) return resolve(false);
      const req = indexedDB.open('ironlog-check');
      req.onsuccess = () => {
        req.result?.close?.();
        resolve(true);
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
