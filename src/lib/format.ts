/**
 * تقویم شمسی، ارقام فارسی و مبلغ.
 *
 * مبلغ‌ها BigInt تومان‌اند، هرگز float: جمع ده‌ها ردیف میلیاردی با عدد اعشاری
 * خطای گرد کردن می‌سازد و در جدول بودجه «۱ تومان» اختلاف هم سؤال‌برانگیز است.
 */

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
];
const div = (a: number, b: number) => ~~(a / b);
const mod = (a: number, b: number) => a - ~~(a / b) * b;

function jalCal(jy: number) {
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0]!;
  let jm = 0;
  let jump = 0;
  let n: number;
  for (let i = 1; i < BREAKS.length; i++) {
    jm = BREAKS[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy: number, gm: number, gd: number) {
  const d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
}
function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}
function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
function d2j(jdn: number) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  let k = jdn - g2d(gy, 3, r.march);
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}
export const monthLen = (jy: number, jm: number) =>
  jm <= 6 ? 31 : jm <= 11 ? 30 : jalCal(jy).leap === 0 ? 30 : 29;

export interface JDate {
  jy: number;
  jm: number;
  jd: number;
}

export const MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];
export const pad = (n: number) => String(n).padStart(2, '0');

const FA = '۰۱۲۳۴۵۶۷۸۹';
/** ارقام لاتین داخل متن به فارسی. */
export const fa = (s: string | number | bigint) => String(s).replace(/\d/g, (d) => FA[Number(d)]!);
/** ارقام فارسی و عربی به لاتین — پیش از ذخیره. */
export const toEn = (s: unknown) =>
  String(s ?? '')
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

export function jParse(s: string): JDate | null {
  const m = toEn(s)
    .trim()
    .match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (!m) return null;
  const jy = +m[1]!;
  const jm = +m[2]!;
  const jd = +m[3]!;
  if (jy < 1300 || jy > 1500 || jm < 1 || jm > 12 || jd < 1 || jd > monthLen(jy, jm)) return null;
  return { jy, jm, jd };
}
export function j2iso({ jy, jm, jd }: JDate) {
  const g = d2g(j2d(jy, jm, jd));
  return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
}
export function iso2j(iso: string): JDate {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
  return d2j(g2d(y, m, d));
}
export function localIso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const today = (): JDate => iso2j(localIso(new Date()));
export const todayKey = () => {
  const t = today();
  return `${t.jy}-${pad(t.jm)}`;
};
export const jFa = (iso?: string | null) => {
  if (!iso) return '—';
  const j = iso2j(localIso(new Date(iso.length > 10 ? iso : `${iso}T12:00:00`)));
  return fa(`${j.jy}/${pad(j.jm)}/${pad(j.jd)}`);
};
export const todayFa = () => {
  const t = today();
  return fa(`${t.jy}/${pad(t.jm)}/${pad(t.jd)}`);
};
export const mName = (jy: number, jm: number) => `${MONTHS[jm - 1]} ${fa(jy)}`;
export const mkLabel = (mk: string) => {
  const [y, m] = mk.split('-').map(Number) as [number, number];
  return mName(y, m);
};

/* ------------------------------ مبلغ ------------------------------ */

export type Amount = string | number | bigint | null | undefined;

export const B = (x: Amount): bigint => {
  try {
    return typeof x === 'bigint' ? x : BigInt(x || 0);
  } catch {
    return 0n;
  }
};
export const nf = (x: Amount) => B(x).toLocaleString('fa-IR');
export const tm = (x: Amount) => `${nf(x)} تومان`;
/** فقط رقم‌ها، بدون صفرهای ابتدایی، حداکثر ۱۵ رقم. */
export const digits = (s: unknown) =>
  toEn(s)
    .replace(/[^\d]/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 15);
/** نمایش مبلغ در ورودی: ارقام فارسی با جداکننده‌ی «٬». */
export const amtFmt = (s: unknown) => {
  const d = digits(s);
  return d ? fa(BigInt(d).toLocaleString('en-US').replace(/,/g, '٬')) : '';
};
/** «۱٫۲ میلیارد» — عدد بزرگ در یک نگاه. */
export function compact(x: Amount) {
  const v = Number(B(x));
  const a = Math.abs(v);
  const f = (n: number, u: string) =>
    `${fa((Math.round(n * 10) / 10).toString().replace('.', '٫').replace('-', '−'))} ${u}`;
  if (a >= 1e9) return f(v / 1e9, 'میلیارد');
  if (a >= 1e6) return f(v / 1e6, 'میلیون');
  if (a >= 1e3) return f(v / 1e3, 'هزار');
  return fa(v);
}
/** نسبت درصدی دو مبلغ (دو رقم اعشار). مخرج صفر: null مگر صورت هم صفر باشد. */
export function ratio(a: Amount, b: Amount): number | null {
  const x = B(a);
  const y = B(b);
  if (y === 0n) return x === 0n ? 0 : null;
  return Number((x * 10000n) / y) / 100;
}
export function pctFa(p: number | null | undefined, signed?: boolean) {
  if (p === null || p === undefined || !Number.isFinite(p)) return '—';
  const r = Math.abs(p) >= 100 ? Math.round(p) : Math.round(p * 10) / 10;
  return `${signed && r > 0 ? '+' : ''}${fa(String(r).replace('.', '٫').replace('-', '−'))}٪`;
}
export const signed = (x: bigint, f: (v: bigint) => string = nf) => `${x > 0n ? '+' : ''}${f(x)}`;
export const bmax = (arr: bigint[]) => arr.reduce((m, x) => (x > m ? x : m), 0n);
export const sumB = (arr: Amount[]) => arr.reduce<bigint>((s, x) => s + B(x), 0n);
export const pctOf = (amount: Amount, pct: number) =>
  (B(amount) * BigInt(Math.round(pct * 100))) / 10000n;
export const absB = (x: bigint) => (x < 0n ? -x : x);

export const uid = (p = '') =>
  p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const nowIso = () => new Date().toISOString();
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
