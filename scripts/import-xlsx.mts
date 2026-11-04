/**
 * ساخت فایل پشتیبان بودجه‌یار از روی فایل اکسل اطلاعات اولیه.
 *   npx tsx scripts/import-xlsx.mts <file.xlsx> [out.json]
 * خروجی را در تنظیمات › داده‌ها › «بازیابی از پشتیبان» بدهید. فایل داده در مخزن ذخیره نمی‌شود.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseBudgetWorkbook, readXlsx } from '../src/lib/import-xlsx';
import { bundleToBackup } from '../src/lib/import-apply';

const [file, out] = process.argv.slice(2);
if (!file) {
  console.error('usage: tsx scripts/import-xlsx.mts <file.xlsx> [out.json]');
  process.exit(1);
}
const buf = readFileSync(file);
const now = new Date().toISOString();
const wb = await readXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
const b = parseBudgetWorkbook(wb, { user: 'import', now, file: basename(file) });
console.log(JSON.stringify(b.counts));
for (const w of b.warnings) console.log('⚠', w);
const sum = (xs: string[]) => xs.reduce((s, x) => s + BigInt(x), 0n);
for (const a of b.actuals)
  console.log(a.id, 'rev', sum(Object.values(a.revenue)), 'exp', sum(Object.values(a.expense)), 'pay', sum(Object.values(a.payroll)), 'bills', sum(b.bills.filter((x) => x.month === a.id).map((x) => x.amount)));
if (out) {
  writeFileSync(out, JSON.stringify(bundleToBackup(b, { name: 'نمایندگی سایپا استوار' }, now), null, 1));
  console.log('wrote', out);
}
