/**
 * پایگاه داده‌ی سمت سرور — SQLite داخلی Node (node:sqlite)، بدون وابستگی تازه.
 * همان مدل «مجموعه/سند» رابط Backend را نگه می‌دارد: جدول docs(col, id, data).
 * فقط سمت سرور (مسیر /api/db) استفاده می‌شود؛ مسیر فایل از DB_PATH می‌آید.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

interface Stmt {
  all(...a: unknown[]): unknown[];
  get(...a: unknown[]): unknown;
  run(...a: unknown[]): unknown;
}
interface Db {
  exec(sql: string): void;
  prepare(sql: string): Stmt;
}

let db: Db | null = null;

function open(): Db {
  if (db) return db;
  // با getBuiltinModule تا باندلر وب‌پک دنبال node:sqlite نگردد
  const mod = (process as unknown as { getBuiltinModule(n: string): { DatabaseSync: new (p: string) => Db } }).getBuiltinModule(
    'node:sqlite',
  );
  const path = process.env['DB_PATH'] || '/data/budgetyar.db';
  mkdirSync(dirname(path), { recursive: true });
  const d = new mod.DatabaseSync(path);
  d.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS docs (
      col        TEXT NOT NULL,
      id         TEXT NOT NULL,
      data       TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (col, id)
    ) WITHOUT ROWID;
  `);
  db = d;
  return d;
}

export function dbGet(col: string, id: string): unknown | null {
  const r = open().prepare('SELECT data FROM docs WHERE col = ? AND id = ?').get(col, id) as { data: string } | undefined;
  return r ? JSON.parse(r.data) : null;
}

export function dbList(col: string): unknown[] {
  const rows = open().prepare('SELECT data FROM docs WHERE col = ?').all(col) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}

export function dbPut(col: string, id: string, data: unknown): void {
  open()
    .prepare(
      `INSERT INTO docs (col, id, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .run(col, id, JSON.stringify(data), new Date().toISOString());
}

export function dbDelete(col: string, id: string): void {
  open().prepare('DELETE FROM docs WHERE col = ? AND id = ?').run(col, id);
}
