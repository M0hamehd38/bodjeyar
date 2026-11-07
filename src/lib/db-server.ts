/**
 * پایگاه داده‌ی سمت سرور — SQLite داخلی Node (node:sqlite)، بدون وابستگی تازه.
 * همان مدل «مجموعه/سند» رابط Backend را نگه می‌دارد: جدول docs(col, id, data).
 * فقط سمت سرور (مسیر /api/db) استفاده می‌شود؛ مسیر فایل از DB_PATH می‌آید.
 */

import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import PROVISION_USERS from './provision-users.json';

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
  provisionUsers(d);
  db = d;
  return d;
}

/**
 * ساخت یک‌باره‌ی حساب‌های مدیر و حسابدار (provision-users.json — فقط هش PBKDF2، هرگز خود رمز).
 * شناسه‌ی هر دسته از هش محتوا ساخته و در مجموعه‌ی `meta` ثبت می‌شود تا با هر راه‌اندازی تکرار
 * نشود؛ رمزی که کاربر بعداً عوض کند دست نمی‌خورد. اگر نام کاربری از قبل باشد، فقط رمز، نقش و
 * فعال‌بودنش به‌روز می‌شود.
 */
function provisionUsers(d: Db) {
  const users = PROVISION_USERS as Array<Record<string, unknown> & { id: string; username: string }>;
  if (!users.length) return;
  const marker = `provision-users-${createHash('sha256').update(JSON.stringify(users)).digest('hex').slice(0, 16)}`;
  if (d.prepare("SELECT 1 FROM docs WHERE col = 'meta' AND id = ?").get(marker)) return;
  const now = new Date().toISOString();
  const put = d.prepare(
    `INSERT INTO docs (col, id, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  );
  const existing = (d.prepare("SELECT id, data FROM docs WHERE col = 'users'").all() as { id: string; data: string }[]).map(
    (r) => ({ id: r.id, user: JSON.parse(r.data) as { username?: string } }),
  );
  d.exec('BEGIN');
  try {
    for (const u of users) {
      const same = existing.find((e) => (e.user.username || '').toLowerCase() === u.username.toLowerCase());
      const id = same ? same.id : u.id;
      put.run('users', id, JSON.stringify({ ...(same?.user || {}), ...u, id, created_at: (same?.user as { created_at?: string })?.created_at || now }), now);
    }
    put.run('meta', marker, JSON.stringify({ id: marker, applied_at: now, users: users.map((u) => u.username) }), now);
    d.exec('COMMIT');
    console.log(`[budgetyar] حساب‌های یک‌باره اعمال شد: ${users.map((u) => u.username).join('، ')}`);
  } catch (e) {
    d.exec('ROLLBACK');
    console.error('[budgetyar] ساخت حساب‌های یک‌باره انجام نشد:', e);
  }
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
