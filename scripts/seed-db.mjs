/**
 * پر کردن پایگاه داده از فایل پشتیبان بودجه‌یار (خروجی scripts/import-xlsx.mts).
 *   DB_PATH=/data/budgetyar.db node scripts/seed-db.mjs backup.json [--replace]
 * بدون --replace اگر پایگاه داده خالی نباشد کاری نمی‌کند. کاربران و گزارش ممیزی (audit_logs) دست نمی‌خورند.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error('usage: seed-db.mjs backup.json [--replace]');
  process.exit(1);
}
const path = process.env.DB_PATH || '/data/budgetyar.db';
mkdirSync(dirname(path), { recursive: true });
const b = JSON.parse(readFileSync(file, 'utf-8'));
if (b.app !== 'budgetyar') throw new Error('فایل پشتیبان بودجه‌یار نیست');

const db = new DatabaseSync(path);
db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS docs (col TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (col, id)) WITHOUT ROWID;`);

const KEEP = ['users', 'audit_logs'];
const existing = db.prepare("SELECT COUNT(*) AS n FROM docs WHERE col NOT IN ('users','audit_logs')").get().n;
if (existing > 0 && flag !== '--replace') {
  console.error(`پایگاه داده ${existing} سند دارد؛ برای جایگزینی --replace بدهید.`);
  process.exit(2);
}

const COLS = ['centers', 'heads', 'periods', 'versions', 'actuals', 'bills', 'variances', 'inv_track', 'entries', 'staff', 'accounts', 'capex', 'proposals'];
const now = new Date().toISOString();
const put = db.prepare(`INSERT INTO docs (col, id, data, updated_at) VALUES (?, ?, ?, ?)
  ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`);

db.exec('BEGIN');
try {
  db.prepare(`DELETE FROM docs WHERE col NOT IN (${KEEP.map(() => '?').join(',')})`).run(...KEEP);
  const counts = {};
  for (const col of COLS) {
    const rows = Array.isArray(b[col]) ? b[col] : [];
    for (const r of rows) put.run(col, String(r.id), JSON.stringify(r), now);
    counts[col] = rows.length;
  }
  put.run('org', 'main', JSON.stringify({ ...b.org, id: 'main' }), now);
  put.run('settings', 'main', JSON.stringify({ ...b.settings, id: 'main' }), now);
  db.exec('COMMIT');
  console.log(JSON.stringify(counts));
} catch (e) {
  db.exec('ROLLBACK');
  throw e;
}
