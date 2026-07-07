// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

// wipes the sqlite database (and its WAL/SHM sidecars) so the next start is clean.
let a_s_path = ['app.db', 'app.db-wal', 'app.db-shm'].map((s_name) => {
  return new URL(`./.gitignored/${s_name}`, import.meta.url).pathname;
});

for (let s_path of a_s_path) {
  try {
    Deno.removeSync(s_path);
    console.log(`[rmdb] removed ${s_path}`);
  } catch {
    // file may not exist yet — nothing to remove
  }
}
console.log('[rmdb] done');
