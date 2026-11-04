/**
 * ورود فایل «چک‌لیست جمع‌آوری اطلاعات اولیه بودجه نمایندگی» (Excel).
 *
 * هر شیت فایل به بخش متناظر برنامه می‌نشیند:
 *   درآمدها            → مراکز درآمد + عملکرد ماهانه‌ی درآمد + ریز اسناد
 *   هزینه‌ها            → سرفصل‌ها و مراکز هزینه + عملکرد هزینه و حقوق + ریز اسناد
 *   حقوق و مزایا        → دفتر حقوق پرسنل (به تفکیک نفر و ماه)
 *   قبوض و اشتراک‌ها    → قبوض (آب، برق، تلفن، اینترنت)
 *   سرمایه‌گذاری        → خریدهای سرمایه‌ای انجام‌شده
 *   مطالبات / پرداختنی  → حساب‌های دریافتنی و پرداختنی مهم
 *
 * تبدیل قطعی است (بدون هوش مصنوعی): همان فایل همیشه همان داده را می‌سازد.
 * شرح اصلی هر ردیف عیناً در «ریز اسناد» می‌ماند؛ سرفصل استاندارد فقط برای
 * جمع‌بندی بودجه است. هر چیزی که با فرض تصمیم گرفته شد در warnings می‌آید.
 *
 * ورودی این ماژول جدول خام ردیف‌هاست، نه exceljs؛ پس هم در مرورگر و هم در
 * Node (اسکریپت ساخت پشتیبان) همین کد اجرا می‌شود.
 */

import { pad } from './format';
import type {
  Account,
  AccountStatus,
  Actual,
  Bill,
  BillType,
  Capex,
  Center,
  Entry,
  Head,
  PayrollRow,
  Period,
  StaffPay,
  Version,
} from './types';

export type Cell = string | number | boolean | Date | null | undefined;
export type SheetRows = Cell[][];
export type Workbook = Record<string, SheetRows>;

export interface ImportBundle {
  centers: Center[];
  heads: Head[];
  periods: Period[];
  versions: Version[];
  actuals: Actual[];
  bills: Bill[];
  entries: Entry[];
  staff: StaffPay[];
  accounts: Account[];
  capex: Capex[];
  counts: Record<string, number>;
  warnings: string[];
  year: number;
}

/* ------------------------------ یکسان‌سازی متن ------------------------------ */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function norm(x: Cell): string {
  if (x === null || x === undefined) return '';
  if (x instanceof Date) return x.toISOString().slice(0, 10);
  return String(x)
    .replace(/[‌‏‎]/g, ' ')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/\s+/g, ' ')
    .trim();
}
const squash = (x: Cell) => norm(x).replace(/\s/g, '');

/** مبلغ تومان به رشته‌ی رقمی؛ خالی ⇒ null (یعنی «ثبت نشده»، نه صفر). */
export function amount(x: Cell): string | null {
  if (x === null || x === undefined || x === '') return null;
  if (typeof x === 'number') return Number.isFinite(x) ? String(Math.round(x)) : null;
  const s = norm(x).replace(/[,٬،\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return String(Math.round(Number(s)));
}

const MONTH_ALIASES: Record<string, number> = {
  فروردین: 1,
  اردیبهشت: 2,
  اریدبهشت: 2,
  اردبهشت: 2,
  خرداد: 3,
  تیر: 4,
  مرداد: 5,
  امرداد: 5,
  شهریور: 6,
  مهر: 7,
  آبان: 8,
  ابان: 8,
  آذر: 9,
  آدر: 9,
  دی: 10,
  بهمن: 11,
  اسفند: 12,
};
export function monthNo(x: Cell): number | null {
  const s = squash(x);
  if (!s) return null;
  if (MONTH_ALIASES[s]) return MONTH_ALIASES[s]!;
  if (/^\d{1,2}$/.test(s) && +s >= 1 && +s <= 12) return +s;
  for (const [k, v] of Object.entries(MONTH_ALIASES)) if (s.startsWith(k)) return v;
  return null;
}

/* ------------------------------ ساختار مراکز ------------------------------ */

interface CenterDef {
  id: string;
  name: string;
  has_staff: boolean;
  match: RegExp;
}

/** مراکز هزینه‌ی نمایندگی — ترتیب مهم است: الگوی خاص‌تر اول. */
const COST_CENTERS: CenterDef[] = [
  { id: 'cc_sales', name: 'فروش خودرو', has_staff: true, match: /^فروشخودرو/ },
  { id: 'cc_aso', name: 'خدمات پس از فروش اداری', has_staff: true, match: /^خدماتپسازفروشاداری/ },
  { id: 'cc_ass', name: 'خدمات پس از فروش تعمیرگاه', has_staff: true, match: /^خدماتپسازفروشتعمیرگاه|^تعمیرگاه/ },
  { id: 'cc_body', name: 'صافکاری و نقاشی', has_staff: true, match: /صافکاری|نقاشی/ },
  { id: 'cc_parts', name: 'قطعات یدکی', has_staff: true, match: /قطعات|فروشگاه/ },
  { id: 'cc_fin', name: 'اداری و مالی', has_staff: true, match: /^(اداری)?و?مالی$|^اداریومالی|^اداریمالی|^مالی/ },
  { id: 'cc_mgmt', name: 'مدیریت', has_staff: true, match: /^مدیریت/ },
  { id: 'cc_sec', name: 'حراست و نگهبانی', has_staff: true, match: /حراست|نگهبان/ },
  { id: 'cc_shared', name: 'مشترک', has_staff: false, match: /^مشترک|^عمومی|^آپارتمان|^واحدآپارتمان/ },
];
const GENERIC_AS = /^خدماتپسازفروش$/;

/** سرفصل‌های استاندارد هزینه — هر شرح آزاد فایل با الگو به یکی می‌نشیند. */
interface HeadDef {
  id: string;
  name: string;
  match?: RegExp;
  payroll?: boolean;
  utility?: BillType;
}
const HEADS: HeadDef[] = [
  { id: 'h_pay', name: 'حقوق، بیمه و مزایای پرسنل', payroll: true, match: /^(حقوق|بیمه$|بیمهسهمکارفرما|سنوات|عیدی|اضافهکار)/ },
  { id: 'h_ceo', name: 'هزینه‌های مدیرعامل و مدیریت', match: /مدیرعامل|^هزینهمدیریت/ },
  { id: 'h_water', name: 'آب', utility: 'water', match: /^آب$|^قبضآب/ },
  { id: 'h_power', name: 'برق', utility: 'power', match: /^برق$|^قبضبرق/ },
  { id: 'h_phone', name: 'تلفن', utility: 'phone', match: /^تلفن/ },
  { id: 'h_net', name: 'اینترنت', utility: 'internet', match: /^اینترنت/ },
  { id: 'h_post', name: 'پست و ارسال مرسوله', match: /تیپاکس|پست|پیک/ },
  { id: 'h_trans', name: 'ایاب‌وذهاب و کرایه', match: /اسنپ|کرایه|ایابوذهاب|تاکسی/ },
  { id: 'h_sport', name: 'ورزش و رفاه کارکنان', match: /فوتبال|شطرنج|ورزش/ },
  { id: 'h_soft', name: 'نرم‌افزار و پشتیبانی سیستم', match: /پشتیبانی|نرمافزار|گواهیالکترونیک/ },
  { id: 'h_tax', name: 'مالیات و عوارض', match: /ارزشافزوده|مالیات|عوارض/ },
  { id: 'h_comm', name: 'پورسانت فروش', match: /پورسانت/ },
  { id: 'h_ads', name: 'تبلیغات و بازاریابی', match: /تبلیغ/ },
  { id: 'h_dist', name: 'توزیع، کارواش و آماده‌سازی خودرو', match: /توزیع|کارواش|خودروامانی/ },
  { id: 'h_body', name: 'مواد و اجرت صافکاری و نقاشی', match: /صافکاری|نقاشی/ },
  { id: 'h_furn', name: 'تعمیر اثاثه و تجهیزات اداری', match: /اثاثه|پرینتر|تعمیرسیستم/ },
  { id: 'h_equip', name: 'ماشین‌آلات، ابزار و تجهیزات تعمیرگاه', match: /ماشینآلات|کالیبراسیون|کالیراسیون|روکش|انژکتور|جوشکاری|باتری|قوطی|گونی|شوینده|ابزار/ },
  { id: 'h_bld', name: 'تعمیر و نگهداری ساختمان و تأسیسات', match: /ساختمان|برقکشی|لولهکشی|لوله|نصبوسایل|کولر|چسبگاز|تأسیسات|تاسیسات/ },
  { id: 'h_food', name: 'ناهار و پذیرایی', match: /ناهار|پذیرایی|صبحانه|آشامیدنی|لیوان|قند|چای|شیرینی/ },
  { id: 'h_gift', name: 'هدایا و کمک خیریه', match: /هدایا|هدیه|خیریه/ },
  { id: 'h_office', name: 'لوازم‌التحریر و ملزومات اداری', match: /لوازمالتحریر|کاغذ|چاپ|سلفون|موس|کامپیوتر|رومیزی|گلدان/ },
  { id: 'h_wear', name: 'لباس و کفش کار', match: /لباس|کفش/ },
  { id: 'h_house', name: 'هزینه آپارتمان و اقامت', match: /آپارتمان|اجاره/ },
  { id: 'h_ovar', name: 'سایر هزینه‌ها' },
];
export const headFor = (desc: Cell): HeadDef => {
  const s = squash(desc);
  return HEADS.find((h) => h.match && h.match.test(s)) ?? HEADS[HEADS.length - 1]!;
};

/* ------------------------------ کمکی‌ها ------------------------------ */

function findSheet(wb: Workbook, ...keys: string[]): SheetRows {
  const names = Object.keys(wb);
  for (const k of keys) {
    const n = names.find((x) => squash(x).includes(squash(k)));
    if (n) return wb[n]!;
  }
  return [];
}

/** ردیف سرتیتر: اولین ردیفی با چند خانه‌ی پر که هم کلید و هم «ماه»/«مبلغ» را در خانه‌های جدا دارد. */
function headerIndex(rows: SheetRows, key: string): number {
  const k = squash(key);
  return rows.findIndex((r) => {
    const cells = r.map(squash).filter(Boolean);
    return cells.length >= 3 && cells.some((c) => c.includes(k)) && cells.some((c) => /^ماه$|^مبلغ/.test(c));
  });
}
function colOf(header: Cell[], ...keys: string[]): number {
  for (const k of keys) {
    const i = header.findIndex((c) => squash(c).includes(squash(k)));
    if (i >= 0) return i;
  }
  return -1;
}
const at = (r: Cell[], i: number): Cell => (i >= 0 ? r[i] : undefined);

function yearOf(x: Cell, current: number): number {
  const s = norm(x);
  const m = s.match(/(1[34]\d\d)/);
  if (m) return +m[1]!;
  if (/گذشته|قبل/.test(s)) return current - 1;
  return current;
}
const mk = (y: number, m: number) => `${y}-${pad(m)}`;
const round100k = (n: number) => String(Math.round(n / 100000) * 100000);

/* ------------------------------ ورود ------------------------------ */

export function parseBudgetWorkbook(
  wb: Workbook,
  opts: { user: string; now: string; file?: string; year?: number },
): ImportBundle {
  const warnings: string[] = [];
  const src = (sheet: string, row: number) => `${opts.file ? `${opts.file} › ` : ''}${sheet} › ردیف ${row}`;

  /* سال جاری: از تاریخ‌های شیت سرمایه‌گذاری، وگرنه ورودی، وگرنه ۱۴۰۵ */
  let year = opts.year ?? 0;
  if (!year) {
    const inv = findSheet(wb, 'سرمایه');
    for (const r of inv) for (const c of r) {
      const m = norm(c).match(/^(1[34]\d\d)[/\-.]\d{1,2}[/\-.]\d{1,2}$/);
      if (m) year = Math.max(year, +m[1]!);
    }
    if (!year) year = 1405;
  }

  /* ---------- مراکز ---------- */
  const centers: Center[] = [];
  const costOrder = new Map<string, number>();
  const ensureCost = (raw: Cell): string => {
    const s = squash(raw);
    if (GENERIC_AS.test(s)) {
      costOrder.set('cc_ass', 0);
      return 'cc_ass';
    }
    const def = COST_CENTERS.find((c) => c.match.test(s)) ?? (s ? null : COST_CENTERS.at(-1)!);
    if (def) {
      if (!costOrder.has(def.id)) costOrder.set(def.id, 0);
      return def.id;
    }
    // مرکز ناشناخته: همان نام فایل، با شناسه‌ی پایدار
    const name = norm(raw);
    let c = centers.find((x) => x.kind === 'cost' && x.name === name);
    if (!c) {
      c = { id: `cc_x${centers.filter((x) => x.kind === 'cost').length + 1}`, kind: 'cost', name, active: true, order: 100 + centers.length, has_staff: true, created_at: opts.now };
      centers.push(c);
      warnings.push(`مرکز هزینه‌ی «${name}» در ساختار استاندارد نبود و جدا ساخته شد.`);
    }
    return c.id;
  };

  const revKeyMap = new Map<string, Center>();
  const ensureRev = (centerRaw: Cell, subRaw: Cell): string => {
    const cName = norm(centerRaw);
    const sub = norm(subRaw);
    const key = squash(cName) + '|' + squash(sub);
    const hit = revKeyMap.get(key);
    if (hit) return hit.id;
    const name = sub || cName;
    const s = squash(cName);
    const link = /فروشخودرو|بیمه|کارتنارنجی/.test(s)
      ? 'cc_sales'
      : /خدماتپسازفروش/.test(s)
        ? 'cc_ass'
        : /صافکاری|نقاشی/.test(s)
          ? 'cc_body'
          : /قطعات/.test(s)
            ? 'cc_parts'
            : '';
    if (link) costOrder.set(link, 0);
    const c: Center = {
      id: `rc_${String(revKeyMap.size + 1).padStart(2, '0')}`,
      kind: 'revenue',
      name,
      group: sub ? cName : undefined,
      active: true,
      order: revKeyMap.size,
      link,
      created_at: opts.now,
    };
    revKeyMap.set(key, c);
    return c.id;
  };

  /* ---------- عملکرد ماهانه ---------- */
  const actuals = new Map<string, Actual>();
  const act = (k: string): Actual => {
    let a = actuals.get(k);
    if (!a) {
      a = { id: k, revenue: {}, expense: {}, payroll: {}, closed: true, saved_at: opts.now, updated_by: opts.user, closed_by: opts.user, rev: 0 };
      actuals.set(k, a);
    }
    return a;
  };
  const addTo = (rec: Record<string, string>, key: string, amt: string) => {
    rec[key] = String(BigInt(rec[key] || '0') + BigInt(amt));
  };

  const entries: Entry[] = [];
  const bills: Bill[] = [];

  /* ---------- درآمدها ---------- */
  {
    const rows = findSheet(wb, 'درآمد');
    const hi = headerIndex(rows, 'مرکز درآمد');
    const H = rows[hi] ?? [];
    const cY = colOf(H, 'سال'), cM = colOf(H, 'ماه'), cC = colOf(H, 'مرکز درآمد'), cS = colOf(H, 'زیرگروه');
    const cA = colOf(H, 'مبلغ'), cSt = colOf(H, 'وضعیت'), cN = colOf(H, 'توضیح'), cR = colOf(H, 'منبع');
    if (hi < 0) warnings.push('شیت «درآمدها» پیدا نشد یا سرتیتر آن تغییر کرده است.');
    for (let i = hi + 1; hi >= 0 && i < rows.length; i++) {
      const r = rows[i]!;
      const amt = amount(at(r, cA));
      const m = monthNo(at(r, cM));
      if (amt === null || !norm(at(r, cC))) continue;
      if (!m) {
        warnings.push(`درآمدها، ردیف ${i + 1}: ماه «${norm(at(r, cM))}» شناخته نشد؛ ردیف وارد نشد.`);
        continue;
      }
      const y = yearOf(at(r, cY), year);
      const rc = ensureRev(at(r, cC), at(r, cS));
      const k = mk(y, m);
      addTo(act(k).revenue, rc, amt);
      entries.push({
        id: `e_r_${i + 1}`, month: k, type: 'revenue', key: rc, center: rc,
        desc: norm(at(r, cS)) || norm(at(r, cC)), sub: norm(at(r, cS)) || undefined, amount: amt,
        status: norm(at(r, cSt)) || undefined, note: norm(at(r, cN)) || undefined, ref: norm(at(r, cR)) || undefined,
        source: src('درآمدها', i + 1), imported: true,
      });
    }
  }

  /* ---------- هزینه‌ها ---------- */
  const headUse = new Map<string, { centers: Map<string, number>; fixed: number; variable: number }>();
  {
    const rows = findSheet(wb, 'هزینه');
    const hi = headerIndex(rows, 'سرفصل');
    const H = rows[hi] ?? [];
    const cY = colOf(H, 'سال'), cM = colOf(H, 'ماه'), cK = colOf(H, 'نوع هزینه'), cH = colOf(H, 'سرفصل');
    const cC = colOf(H, 'مرکز هزینه'), cA = colOf(H, 'مبلغ'), cSh = colOf(H, 'مستقیم'), cN = colOf(H, 'توضیح');
    const cRef = colOf(H, 'شماره سند', 'مرجع'), cSrc = colOf(H, 'منبع');
    if (hi < 0) warnings.push('شیت «هزینه‌ها» پیدا نشد یا سرتیتر آن تغییر کرده است.');

    // مبلغ همان سرفصل در هر واحد خدمات پس از فروش در ماه‌های دیگر — برای تفکیک ردیف کلی
    const typical = new Map<string, number[]>();
    const pending: { i: number; r: Cell[] }[] = [];
    for (let i = hi + 1; hi >= 0 && i < rows.length; i++) {
      const r = rows[i]!;
      if (amount(at(r, cA)) === null) continue;
      pending.push({ i, r });
      const s = squash(at(r, cC));
      if (/^خدماتپسازفروش(اداری|تعمیرگاه)/.test(s)) {
        const k = `${squash(at(r, cH))}|${s.includes('اداری') ? 'cc_aso' : 'cc_ass'}`;
        typical.set(k, [...(typical.get(k) || []), Number(amount(at(r, cA)))]);
      }
    }
    let genericAs = 0;
    for (const { i, r } of pending) {
      const amt = amount(at(r, cA))!;
      const m = monthNo(at(r, cM));
      const desc = norm(at(r, cH));
      if (!m) {
        warnings.push(`هزینه‌ها، ردیف ${i + 1}: ماه «${norm(at(r, cM))}» شناخته نشد؛ ردیف وارد نشد.`);
        continue;
      }
      if (!desc) {
        warnings.push(`هزینه‌ها، ردیف ${i + 1}: سرفصل خالی است؛ زیر «سایر هزینه‌ها» ثبت شد.`);
      }
      const y = yearOf(at(r, cY), year);
      const k = mk(y, m);
      const hd = headFor(desc);
      const kindRaw = squash(at(r, cK));
      const kind: 'fixed' | 'variable' = kindRaw.startsWith('ثابت') ? 'fixed' : 'variable';

      let center: string;
      const cs = squash(at(r, cC));
      if (GENERIC_AS.test(cs)) {
        genericAs++;
        // ردیف کلی «خدمات پس از فروش»: نزدیک‌ترین مبلغ همان سرفصل در دو واحد
        const near = (id: string) => {
          const xs = typical.get(`${squash(desc)}|${id}`) || [];
          return xs.length ? Math.min(...xs.map((x) => Math.abs(x - Number(amt)))) : Infinity;
        };
        const dO = near('cc_aso');
        const dS = near('cc_ass');
        if (dO !== Infinity || dS !== Infinity) center = dO <= dS ? 'cc_aso' : 'cc_ass';
        else if (hd.payroll) center = kind === 'fixed' ? 'cc_aso' : 'cc_ass';
        else if (hd.id === 'h_tax' || hd.id === 'h_soft') center = 'cc_aso';
        else center = 'cc_ass';
        costOrder.set(center, 0);
      } else center = ensureCost(at(r, cC));

      const shared = /مشترک/.test(squash(at(r, cSh))) || center === 'cc_shared';
      const u = headUse.get(hd.id) ?? { centers: new Map(), fixed: 0, variable: 0 };
      u.centers.set(center, (u.centers.get(center) || 0) + 1);
      u[kind]++;
      headUse.set(hd.id, u);

      const key = hd.payroll ? center : `${hd.id}|${center}`;
      const type = hd.payroll ? 'payroll' : 'expense';
      if (hd.utility) {
        // قبض ثبت‌شده در شیت هزینه‌ها ← همان قبض در بخش قبوض (عملکرد از قبوض خوانده می‌شود)
        bills.push({
          id: `b_e_${i + 1}`, type: hd.utility, subscription: '', meter: '', location: 'ثبت‌شده در شیت هزینه‌ها',
          amount: amt, month: k, pay_date: '', mode: 'direct', center, alloc: [],
          updated_by: opts.user, updated_at: opts.now,
        });
      } else if (hd.payroll) addTo(act(k).payroll, center, amt);
      else addTo(act(k).expense, key, amt);

      entries.push({
        id: `e_x_${i + 1}`, month: k, type, key, center, head: hd.id, desc: desc || 'بدون شرح', amount: amt, kind, shared,
        note: norm(at(r, cN)) || undefined, ref: norm(at(r, cRef)) || norm(at(r, cSrc)) || undefined,
        source: src('هزینه‌ها', i + 1), imported: true,
      });
    }
    if (genericAs)
      warnings.push(
        `${genericAs} ردیف هزینه با مرکز کلی «خدمات پس از فروش» ثبت شده بود؛ هر کدام به واحد اداری یا تعمیرگاه با نزدیک‌ترین مبلغ همان سرفصل در ماه‌های دیگر نسبت داده شد (ریز آن در «ریز اسناد» هست).`,
      );
  }

  /* ---------- قبوض ---------- */
  {
    const rows = findSheet(wb, 'قبوض', 'اشتراک');
    const hi = headerIndex(rows, 'نوع قبض');
    const H = rows[hi] ?? [];
    const cId = colOf(H, 'شناسه'), cY = colOf(H, 'سال'), cM = colOf(H, 'ماه'), cT = colOf(H, 'نوع قبض');
    const cSub = colOf(H, 'اشتراک'), cMeter = colOf(H, 'کنتور'), cLoc = colOf(H, 'محل'), cC = colOf(H, 'مرکز');
    const cMode = colOf(H, 'نوع تخصیص'), cPct = colOf(H, 'درصد'), cTot = colOf(H, 'مبلغ کل'), cAl = colOf(H, 'تخصیص‌یافته', 'تخصیص یافته');
    const cPer = colOf(H, 'دوره مصرف'), cPay = colOf(H, 'تاریخ پرداخت'), cN = colOf(H, 'توضیح');
    const TYPES: [RegExp, BillType][] = [[/^آب/, 'water'], [/^برق/, 'power'], [/تلفن/, 'phone'], [/اینترنت/, 'internet']];
    const groups = new Map<string, Bill>();
    let noCenter = 0;
    for (let i = hi + 1; hi >= 0 && i < rows.length; i++) {
      const r = rows[i]!;
      const total = amount(at(r, cTot)) ?? amount(at(r, cAl));
      if (total === null) continue;
      const m = monthNo(at(r, cM));
      const t = TYPES.find(([re]) => re.test(squash(at(r, cT))))?.[1];
      if (!m || !t) {
        warnings.push(`قبوض، ردیف ${i + 1}: ماه یا نوع قبض شناخته نشد؛ ردیف وارد نشد.`);
        continue;
      }
      const k = mk(yearOf(at(r, cY), year), m);
      const hasCenter = !!norm(at(r, cC));
      if (!hasCenter) noCenter++;
      const center = hasCenter ? ensureCost(at(r, cC)) : (costOrder.set('cc_shared', 0), 'cc_shared');
      const internal = norm(at(r, cId));
      const pct = Number(amount(at(r, cPct)) ?? 0);
      const base: Bill = {
        id: `b_x_${i + 1}`, type: t, subscription: norm(at(r, cSub)), meter: norm(at(r, cMeter)),
        location: [norm(at(r, cLoc)), norm(at(r, cPer)) && `دوره ${norm(at(r, cPer))}`, norm(at(r, cN))].filter(Boolean).join(' · '),
        amount: total, month: k, pay_date: norm(at(r, cPay)), mode: 'direct', center, alloc: [],
        updated_by: opts.user, updated_at: opts.now,
      };
      if (internal && (pct > 0 || /مشترک/.test(squash(at(r, cMode))))) {
        const g = groups.get(`${internal}|${k}`);
        if (g) g.alloc.push({ center, pct });
        else {
          const b = { ...base, id: `b_x_${internal}_${k}`.replace(/[^A-Za-z0-9_-]/g, '_'), mode: 'shared' as const, center: undefined, alloc: [{ center, pct }] };
          groups.set(`${internal}|${k}`, b);
          bills.push(b);
        }
      } else bills.push(base);
    }
    for (const b of groups.values()) {
      const s = b.alloc.reduce((x, a) => x + a.pct, 0);
      if (s !== 100) {
        warnings.push(`قبض مشترک ${b.subscription || b.id}: جمع درصد تخصیص ${s} است نه ۱۰۰؛ باقی‌مانده به «مشترک» داده شد.`);
        const rest = 100 - s;
        if (rest > 0) b.alloc.push({ center: 'cc_shared', pct: rest });
      }
    }
    if (noCenter)
      warnings.push(`${noCenter} قبض مرکز هزینه نداشت (بیشتر قبوض آب و واحد آپارتمان)؛ به مرکز «مشترک» ثبت شد. در بخش عملکرد › قبوض می‌توانید تخصیص دقیق بدهید.`);
  }

  /* ---------- حقوق پرسنل ---------- */
  const staff: StaffPay[] = [];
  {
    const rows = findSheet(wb, 'حقوق');
    const hi = headerIndex(rows, 'پرسنل');
    const H = rows[hi] ?? [];
    const cY = colOf(H, 'سال'), cM = colOf(H, 'ماه'), cP = colOf(H, 'پرسنل'), cU = colOf(H, 'واحد');
    const cols = {
      base: colOf(H, 'حقوق پایه'), overtime: colOf(H, 'اضافه'), benefits: colOf(H, 'مزایا'), bonus: colOf(H, 'پاداش'),
      insurance: colOf(H, 'بیمه'), eidi: colOf(H, 'عیدی'), commute: colOf(H, 'کارواش', 'ایاب'), card: colOf(H, 'کارت'),
    };
    const cT = colOf(H, 'جمع'), cN = colOf(H, 'توضیح');
    let mismatch = 0;
    for (let i = hi + 1; hi >= 0 && i < rows.length; i++) {
      const r = rows[i]!;
      const person = norm(at(r, cP));
      if (!person) continue;
      const m = monthNo(at(r, cM));
      if (!m) {
        warnings.push(`حقوق، ردیف ${i + 1}: ماه شناخته نشد؛ ردیف وارد نشد.`);
        continue;
      }
      const v = Object.fromEntries(Object.entries(cols).map(([k, c]) => [k, amount(at(r, c)) ?? '0'])) as Record<keyof typeof cols, string>;
      const parts = Object.values(v).reduce((s, x) => s + Number(x), 0);
      const total = amount(at(r, cT)) ?? String(parts);
      if (Math.abs(parts - Number(total)) > 1) mismatch++;
      const unit = norm(at(r, cU));
      const us = squash(unit);
      const center = GENERIC_AS.test(us) ? 'cc_aso' : COST_CENTERS.find((c) => c.match.test(us))?.id;
      staff.push({
        id: `s_${i + 1}`, month: mk(yearOf(at(r, cY), year), m), person, unit, center, ...v, total,
        note: norm(at(r, cN)) || undefined, source: src('حقوق و مزایا', i + 1), imported: true,
      });
    }
    if (mismatch)
      warnings.push(
        `در ${mismatch} ردیف حقوق، «جمع پرداختی» با جمع ستون‌های آن یکسان نیست (بیشتر ستون ایاب‌وذهاب/کارت طلایی در جمع نیامده). جمع همان‌طور که در فایل آمده ثبت شد؛ در بخش «پرسنل و حقوق» علامت خورده است.`,
      );
  }

  /* ---------- سرمایه‌گذاری ---------- */
  const capex: Capex[] = [];
  {
    const rows = findSheet(wb, 'سرمایه');
    const hi = headerIndex(rows, 'شرح');
    const H = rows[hi] ?? [];
    const cY = colOf(H, 'سال'), cM = colOf(H, 'ماه'), cT = colOf(H, 'شرح'), cU = colOf(H, 'واحد'), cA = colOf(H, 'مبلغ');
    const cD = colOf(H, 'تاریخ'), cNec = colOf(H, 'ضروری'), cSt = colOf(H, 'وضعیت'), cV = colOf(H, 'تأمین', 'تامین'), cN = colOf(H, 'توضیح');
    let totalRow: number | null = null;
    for (let i = hi + 1; hi >= 0 && i < rows.length; i++) {
      const r = rows[i]!;
      const amt = amount(at(r, cA));
      if (amt === null) continue;
      const title = norm(at(r, cT));
      if (!title) {
        totalRow = Number(amt);
        continue; // ردیف جمع
      }
      const dm = norm(at(r, cD)).match(/^(1[34]\d\d)[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
      const m = monthNo(at(r, cM)) ?? (dm ? +dm[2]! : null);
      const y = dm ? +dm[1]! : yearOf(at(r, cY), year);
      if (!m) {
        warnings.push(`سرمایه‌گذاری، ردیف ${i + 1}: ماه شناخته نشد؛ ردیف وارد نشد.`);
        continue;
      }
      const unit = norm(at(r, cU));
      const us = squash(unit);
      const center = GENERIC_AS.test(us)
        ? 'cc_ass'
        : /صافکاری/.test(us)
          ? 'cc_body'
          : ensureCost(unit);
      capex.push({
        id: `cx_${i + 1}`, month: mk(y, m), title, center, unit, amount: amt,
        date: dm ? `${dm[1]}/${pad(+dm[2]!)}/${pad(+dm[3]!)}` : undefined,
        necessity: norm(at(r, cNec)) || undefined, status: norm(at(r, cSt)) || 'خریداری‌شده', vendor: norm(at(r, cV)) || undefined,
        note: norm(at(r, cN)) || undefined, source: src('سرمایه‌گذاری', i + 1), imported: true,
      });
    }
    const sum = capex.reduce((s, x) => s + Number(x.amount), 0);
    if (totalRow !== null && Math.abs(totalRow - sum) > 1)
      warnings.push(`جمع سرمایه‌گذاری در فایل (${totalRow.toLocaleString('fa-IR')}) با جمع ردیف‌ها (${sum.toLocaleString('fa-IR')}) یکی نیست.`);
  }

  /* ---------- مطالبات و پرداختنی‌ها ---------- */
  const accounts: Account[] = [];
  const readAccounts = (rows: SheetRows, kind: Account['kind'], label: string) => {
    const hi = headerIndex(rows, 'طرف حساب');
    const H = rows[hi] ?? [];
    const cP = colOf(H, 'طرف حساب'), cK = colOf(H, 'نوع'), cA = colOf(H, 'مبلغ'), cD = colOf(H, 'تاریخ');
    const cS = colOf(H, 'وضعیت'), cDays = colOf(H, 'زمان'), cN = colOf(H, 'توضیح');
    for (let i = hi + 1; hi >= 0 && i < rows.length; i++) {
      const r = rows[i]!;
      const party = norm(at(r, cP));
      const amt = amount(at(r, cA));
      if (!party || amt === null) continue;
      const st = squash(at(r, cS));
      const status: AccountStatus = /بخشی/.test(st) ? 'partial' : /نشده/.test(st) ? 'open' : /(وصول|پرداخت|تسویه)شده/.test(st) ? 'settled' : 'open';
      const days = Number(amount(at(r, cDays)) ?? NaN);
      accounts.push({
        id: `a_${kind === 'receivable' ? 'r' : 'p'}_${i + 1}`, kind, party, category: norm(at(r, cK)) || undefined, amount: amt,
        status, created: norm(at(r, cD)) || undefined, due_days: Number.isFinite(days) ? days : undefined,
        note: norm(at(r, cN)) || undefined, source: src(label, i + 1), updated_by: opts.user, updated_at: opts.now, imported: true,
      });
    }
  };
  readAccounts(findSheet(wb, 'مطالبات'), 'receivable', 'مطالبات');
  readAccounts(findSheet(wb, 'پرداختنی'), 'payable', 'حساب‌های پرداختنی');

  /* ---------- ساختار نهایی ---------- */
  for (const def of COST_CENTERS)
    if (costOrder.has(def.id))
      centers.push({ id: def.id, kind: 'cost', name: def.name, active: true, order: COST_CENTERS.indexOf(def), has_staff: def.has_staff, created_at: opts.now });
  // مراکز درآمد هم‌گروه کنار هم: ترتیب اولین ظهور گروه، بعد ترتیب خود مرکز
  const revs = [...revKeyMap.values()];
  const gOrder = (c: Center) => revs.findIndex((x) => (x.group || x.id) === (c.group || c.id));
  revs.sort((a, b) => gOrder(a) - gOrder(b) || a.order - b.order).forEach((c, i) => (c.order = i));
  centers.push(...revs);
  centers.sort((a, b) => (a.kind === b.kind ? a.order - b.order : a.kind === 'revenue' ? -1 : 1));

  const heads: Head[] = HEADS.filter((h) => headUse.has(h.id) || h.utility === 'water' || h.utility === 'power' || h.payroll || h.id === 'h_ovar' || bills.some((b) => b.type === h.utility)).map(
    (h, i) => {
      const u = headUse.get(h.id);
      const top = u ? [...u.centers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
      const def = top ?? (h.utility ? 'cc_shared' : 'cc_shared');
      return {
        id: h.id,
        name: h.name,
        kind: h.payroll || h.utility || (u && u.fixed > u.variable) || h.id === 'h_house' || h.id === 'h_soft' ? 'fixed' : 'variable',
        default_center: centers.some((c) => c.id === def) ? def : centers.find((c) => c.kind === 'cost')?.id || '',
        active: true,
        order: i,
        ...(h.payroll ? { payroll: true } : {}),
        ...(h.utility ? { utility: h.utility } : {}),
      };
    },
  );

  /* ---------- دوره‌ها ---------- */
  const monthKeys = [...new Set([...actuals.keys(), ...bills.map((b) => b.month)])].sort();
  const periods: Period[] = [];
  const years = [...new Set(monthKeys.map((k) => +k.slice(0, 4)))].sort();
  for (const y of years) {
    const ms = monthKeys.filter((k) => +k.slice(0, 4) === y).map((k) => +k.slice(5));
    const h1 = ms.some((m) => m <= 6);
    const h2 = ms.some((m) => m >= 7);
    const mkP = (type: Period['type'], start: number, n: number, title: string): Period => ({
      id: `p_${y}_${type}`, title, type, start_jy: y, start_jm: start, months: n, created_by: opts.user, created_at: opts.now, history: true, imported: true,
    });
    if (h1 && h2) periods.push(mkP('annual', 1, 12, `عملکرد سال ${y.toLocaleString('fa-IR', { useGrouping: false })}`));
    else if (h1) periods.push(mkP('half1', 1, 6, `شش‌ماهه اول ${y.toLocaleString('fa-IR', { useGrouping: false })} (عملکرد)`));
    else if (h2) periods.push(mkP('half2', 7, 6, `شش‌ماهه دوم ${y.toLocaleString('fa-IR', { useGrouping: false })} (عملکرد)`));
  }

  /* ---------- پیش‌نویس بودجه‌ی دوره‌ی بعد از روی میانگین ---------- */
  const versions: Version[] = [];
  const last = periods.at(-1);
  if (last) {
    const lastKeys = monthKeys.filter((k) => k >= mk(last.start_jy, last.start_jm));
    const n = lastKeys.length || 1;
    const nextStart = last.start_jm + last.months;
    const ny = nextStart > 12 ? last.start_jy + 1 : last.start_jy;
    const nm = nextStart > 12 ? nextStart - 12 : nextStart;
    const fy = (x: number) => x.toLocaleString('fa-IR', { useGrouping: false });
    const next: Period = {
      id: `p_${ny}_${nm <= 6 ? 'half1' : 'half2'}`,
      title: `${nm <= 6 ? 'شش‌ماهه اول' : 'شش‌ماهه دوم'} ${fy(ny)}`,
      type: nm <= 6 ? 'half1' : 'half2',
      start_jy: ny, start_jm: nm, months: 6, created_by: opts.user, created_at: opts.now, imported: true,
    };
    periods.push(next);
    const avg = (get: (a: Actual) => string | undefined) =>
      lastKeys.reduce((s, k) => s + Number(actuals.get(k) ? get(actuals.get(k)!) || 0 : 0), 0) / n;
    const six = (x: number) => Array(6).fill(round100k(x));

    const revenue = [...revKeyMap.values()].map((c) => ({ center: c.id, months: six(avg((a) => a.revenue[c.id])) }));
    const expKeys = [...new Set(lastKeys.flatMap((k) => Object.keys(actuals.get(k)?.expense || {})))];
    const expense = expKeys
      .map((key) => {
        const [head, center] = key.split('|') as [string, string];
        return { head, center, months: six(avg((a) => a.expense[key])) };
      })
      .filter((r) => r.months[0] !== '0');
    for (const t of ['water', 'power', 'phone', 'internet'] as BillType[]) {
      const head = heads.find((h) => h.utility === t);
      if (!head) continue;
      const by = new Map<string, number>();
      for (const b of bills) {
        if (b.type !== t || !lastKeys.includes(b.month)) continue;
        if (b.mode === 'direct') by.set(b.center!, (by.get(b.center!) || 0) + Number(b.amount));
        else for (const a of b.alloc) by.set(a.center, (by.get(a.center) || 0) + (Number(b.amount) * a.pct) / 100);
      }
      for (const [center, sum] of by) if (sum / n >= 50000) expense.push({ head: head.id, center, months: six(sum / n) });
    }
    const payCenters = [...new Set(lastKeys.flatMap((k) => Object.keys(actuals.get(k)?.payroll || {})))];
    const payroll: PayrollRow[] = payCenters.map((c) => ({
      center: c,
      headcount: String(new Set(staff.filter((s) => s.center === c && lastKeys.includes(s.month)).map((s) => s.person)).size),
      base: round100k(avg((a) => a.payroll[c])),
      overtime: '0', benefits: '0', bonus: '0', insurance: '0', eidi: '0', other: '0',
    }));
    versions.push({
      id: `v_${next.id}_0`, period_id: next.id, number: 0, title: `بودجه ${next.title}`, status: 'draft', reason: '', wizard_step: 1,
      created_by: opts.user, created_at: opts.now, updated_at: opts.now, rev: 0,
      revenue, expense, payroll, investments: [],
      ai_assumptions: [
        `پیش‌نویس اولیه‌ی سامانه از روی میانگین ماهانه‌ی عملکرد واقعی ${last.title.replace(' (عملکرد)', '')} (${fy(n)} ماه) ساخته شده و هنوز بودجه‌ی تأییدشده نیست.`,
        'هر رقم به نزدیک‌ترین صد هزار تومان گرد شده و برای هر شش ماه یکسان است؛ فصلی‌بودن، تورم و برنامه‌ی فروش را در ویزارد یا با دستیار اعمال کنید.',
        'حقوق هر واحد = میانگین ماهانه‌ی حقوق، بیمه و سنوات همان واحد در شیت هزینه‌ها؛ کل آن در ستون «حقوق پایه» آمده است.',
        'سرمایه‌گذاری دوره‌ی بعد خالی است؛ پروژه‌های جدید را در مرحله‌ی سرمایه‌گذاری اضافه کنید.',
      ],
    });
  }

  const counts = {
    centers: centers.length,
    heads: heads.length,
    months: actuals.size,
    entries: entries.length,
    revenue_rows: entries.filter((e) => e.type === 'revenue').length,
    expense_rows: entries.filter((e) => e.type !== 'revenue').length,
    staff_rows: staff.length,
    people: new Set(staff.map((s) => s.person)).size,
    bills: bills.length,
    capex: capex.length,
    receivables: accounts.filter((a) => a.kind === 'receivable').length,
    payables: accounts.filter((a) => a.kind === 'payable').length,
  };

  return {
    centers,
    heads,
    periods,
    versions,
    actuals: [...actuals.values()].sort((a, b) => a.id.localeCompare(b.id)),
    bills,
    entries,
    staff,
    accounts,
    capex,
    counts,
    warnings,
    year,
  };
}

/** خواندن فایل xlsx با exceljs به جدول خام ردیف‌ها (مقدار محاسبه‌شده‌ی فرمول‌ها). */
export async function readXlsx(buf: ArrayBuffer): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const out: Workbook = {};
  wb.eachSheet((ws) => {
    const rows: SheetRows = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const vals: Cell[] = [];
      row.eachCell({ includeEmpty: true }, (cell, c) => {
        let v = cell.value as unknown;
        if (v && typeof v === 'object' && !(v instanceof Date)) {
          const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
          v = o.result ?? o.text ?? (o.richText ? o.richText.map((t) => t.text).join('') : null);
        }
        vals[c - 1] = (v as Cell) ?? null;
      });
      rows[n - 1] = vals;
    });
    for (let i = 0; i < rows.length; i++) rows[i] ||= [];
    out[ws.name] = rows;
  });
  return out;
}
