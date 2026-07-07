// Copyright (C) 2026 Jonas Immanuel Frey - Licensed under MIT. See LICENSE file for details

import { Database } from '@db/sqlite';

let s_path__db = new URL('../.gitignored/app.db', import.meta.url).pathname;

let f_o_db = function () {
  Deno.mkdirSync(new URL('../.gitignored', import.meta.url).pathname, { recursive: true });
  let o_db = new Database(s_path__db);
  o_db.exec('PRAGMA journal_mode = WAL;');
  o_db.exec('PRAGMA foreign_keys = ON;');
  return o_db;
};

let f_init_schema = function (o_db) {
  o_db.exec(`
    CREATE TABLE IF NOT EXISTS a_o_dataset2d (
      n_id INTEGER PRIMARY KEY AUTOINCREMENT,
      s_name TEXT NOT NULL DEFAULT 'dataset2d',
      s_kind TEXT NOT NULL DEFAULT 'random_simple',
      n_ts_ms__created INTEGER NOT NULL,
      n_ts_ms__updated INTEGER NOT NULL
    );
  `);
  o_db.exec(`
    CREATE TABLE IF NOT EXISTS a_o_vec2d (
      n_id INTEGER PRIMARY KEY AUTOINCREMENT,
      n_o_dataset2d_n_id INTEGER NOT NULL,
      n_x REAL NOT NULL,
      n_y REAL NOT NULL,
      n_ts_ms__created INTEGER NOT NULL,
      n_ts_ms__updated INTEGER NOT NULL,
      FOREIGN KEY (n_o_dataset2d_n_id) REFERENCES a_o_dataset2d(n_id) ON DELETE CASCADE
    );
  `);
  o_db.exec(`
    CREATE TABLE IF NOT EXISTS a_o_window (
      n_id INTEGER PRIMARY KEY AUTOINCREMENT,
      s_type TEXT NOT NULL UNIQUE,
      b_open INTEGER NOT NULL DEFAULT 0,
      n_pos_x REAL NOT NULL DEFAULT 80,
      n_pos_y REAL NOT NULL DEFAULT 80,
      n_scl_x REAL NOT NULL DEFAULT 640,
      n_scl_y REAL NOT NULL DEFAULT 480,
      n_z INTEGER NOT NULL DEFAULT 1,
      n_ts_ms__created INTEGER NOT NULL,
      n_ts_ms__updated INTEGER NOT NULL
    );
  `);
};

// ---------------------------------------------------------------- dataset2d

let f_a_o_dataset2d = function (o_db) {
  return o_db.prepare('SELECT * FROM a_o_dataset2d ORDER BY n_id ASC').all();
};

let f_o_dataset2d__insert = function (o_db, s_name, s_kind) {
  let n_ts_ms = Date.now();
  let o_row = o_db
    .prepare(
      `INSERT INTO a_o_dataset2d (s_name, s_kind, n_ts_ms__created, n_ts_ms__updated)
       VALUES (?, ?, ?, ?) RETURNING *`
    )
    .get(s_name, s_kind, n_ts_ms, n_ts_ms);
  return o_row;
};

let f_dataset2d__delete = function (o_db, n_id) {
  o_db.prepare('DELETE FROM a_o_dataset2d WHERE n_id = ?').run(n_id);
};

let f_dataset2d__touch = function (o_db, n_id) {
  o_db.prepare('UPDATE a_o_dataset2d SET n_ts_ms__updated = ? WHERE n_id = ?').run(Date.now(), n_id);
};

// ---------------------------------------------------------------- vec2d

let f_a_o_vec2d = function (o_db, n_o_dataset2d_n_id) {
  return o_db
    .prepare('SELECT * FROM a_o_vec2d WHERE n_o_dataset2d_n_id = ? ORDER BY n_id ASC')
    .all(n_o_dataset2d_n_id);
};

let f_vec2d__insert_many = function (o_db, n_o_dataset2d_n_id, a_o_p) {
  let n_ts_ms = Date.now();
  let o_stmt = o_db.prepare(
    `INSERT INTO a_o_vec2d (n_o_dataset2d_n_id, n_x, n_y, n_ts_ms__created, n_ts_ms__updated)
     VALUES (?, ?, ?, ?, ?)`
  );
  let f_tx = o_db.transaction((a_o_p__inner) => {
    for (let o_p of a_o_p__inner) {
      o_stmt.run(n_o_dataset2d_n_id, o_p.n_x, o_p.n_y, n_ts_ms, n_ts_ms);
    }
  });
  f_tx(a_o_p);
  f_dataset2d__touch(o_db, n_o_dataset2d_n_id);
};

let f_vec2d__delete_ids = function (o_db, n_o_dataset2d_n_id, a_n_id) {
  if (a_n_id.length == 0) return;
  let s_placeholder = a_n_id.map(() => '?').join(',');
  o_db
    .prepare(`DELETE FROM a_o_vec2d WHERE n_id IN (${s_placeholder})`)
    .run(...a_n_id);
  f_dataset2d__touch(o_db, n_o_dataset2d_n_id);
};

let f_vec2d__delete_all = function (o_db, n_o_dataset2d_n_id) {
  o_db.prepare('DELETE FROM a_o_vec2d WHERE n_o_dataset2d_n_id = ?').run(n_o_dataset2d_n_id);
  f_dataset2d__touch(o_db, n_o_dataset2d_n_id);
};

// ---------------------------------------------------------------- window

let f_a_o_window = function (o_db) {
  return o_db.prepare('SELECT * FROM a_o_window ORDER BY n_z ASC').all();
};

let f_o_window__upsert = function (o_db, o_window) {
  let n_ts_ms = Date.now();
  o_db
    .prepare(
      `INSERT INTO a_o_window
        (s_type, b_open, n_pos_x, n_pos_y, n_scl_x, n_scl_y, n_z, n_ts_ms__created, n_ts_ms__updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(s_type) DO UPDATE SET
         b_open = excluded.b_open,
         n_pos_x = excluded.n_pos_x,
         n_pos_y = excluded.n_pos_y,
         n_scl_x = excluded.n_scl_x,
         n_scl_y = excluded.n_scl_y,
         n_z = excluded.n_z,
         n_ts_ms__updated = excluded.n_ts_ms__updated`
    )
    .run(
      o_window.s_type,
      o_window.b_open ? 1 : 0,
      o_window.n_pos_x,
      o_window.n_pos_y,
      o_window.n_scl_x,
      o_window.n_scl_y,
      o_window.n_z,
      n_ts_ms,
      n_ts_ms
    );
  return o_db.prepare('SELECT * FROM a_o_window WHERE s_type = ?').get(o_window.s_type);
};

export {
  f_o_db,
  f_init_schema,
  f_a_o_dataset2d,
  f_o_dataset2d__insert,
  f_dataset2d__delete,
  f_dataset2d__touch,
  f_a_o_vec2d,
  f_vec2d__insert_many,
  f_vec2d__delete_ids,
  f_vec2d__delete_all,
  f_a_o_window,
  f_o_window__upsert,
};
