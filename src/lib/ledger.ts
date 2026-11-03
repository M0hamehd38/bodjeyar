/**
 * دفتر بودجه — همه‌ی محاسبه‌های بودجه در برابر عملکرد روی یک نمای فقط‌خواندنی از داده.
 * هر بار داده عوض می‌شود یک Ledger تازه ساخته می‌شود؛ پس حافظه‌ی قبوض هرگز کهنه نمی‌ماند.
 */

import {
  B,
  MONTHS,
  mName,
  pad,
  pctOf,
  ratio,
  sumB,
  todayKey,
} from './format';
import type {
  BillType,
  Data,
  InvStatus,
  Line,
  LineType,
  Month,
  PayField,
  PayrollRow,
  Period,
  Priority,
  Role,
  Row,
  Status,
  Totals,
  Version,
  VersionStatus,
} from './types';

export const REASONS = [
  'کاهش فروش',
  'افزایش هزینه',
  'کمبود قطعه',
  'افزایش قیمت خرید',
  'تأخیر وصول',
  'پیش‌بینی غیرواقعی',
  'شرایط بازار',
  'سایر',
];
export const INV_STATUS: Record<InvStatus, string> = {
  planned: 'برنامه‌ریزی‌شده',
  running: 'در حال اجرا',
  done: 'تکمیل‌شده',
  stopped: 'متوقف‌شده',
};
export const INV_TONE = { planned: 'info', running: 'severe', done: 'ok', stopped: 'neutral' } as const;
export const PRIORITY: Record<Priority, string> = { high: 'بالا', mid: 'متوسط', low: 'پایین' };
export type VStatus = VersionStatus | 'superseded';
export const V_STATUS: Record<VStatus, string> = {
  draft: 'پیش‌نویس',
  submitted: 'منتظر تأیید',
  approved: 'تأییدشده',
  rejected: 'برگشت‌خورده',
  superseded: 'جایگزین‌شده',
};
export const V_TONE = {
  draft: 'neutral',
  submitted: 'severe',
  approved: 'ok',
  rejected: 'danger',
  superseded: 'info',
} as const;
export const BILL_TYPES: Record<BillType, string> = {
  water: 'آب',
  power: 'برق',
  phone: 'تلفن',
  internet: 'اینترنت',
};
export const PAY_FIELDS: [PayField, string][] = [
  ['base', 'حقوق پایه'],
  ['overtime', 'اضافه‌کاری'],
  ['benefits', 'مزایا'],
  ['bonus', 'پاداش / کارانه'],
  ['insurance', 'بیمه سهم کارفرما'],
  ['eidi', 'عیدی / سنوات'],
  ['other', 'سایر'],
];
export const TYPE_LABEL: Record<LineType, string> = {
  revenue: 'درآمد',
  expense: 'هزینه',
  payroll: 'حقوق و مزایا',
};
export const ROLE_LABEL: Record<Role, string> = {
  manager: 'مدیر مجموعه',
  accountant: 'مدیر مالی / حسابدار',
};
export const STATUS_LABEL: Record<Status, string> = {
  ok: 'در محدوده',
  warn: 'قابل توجه',
  bad: 'بحرانی',
  none: 'بدون داده',
};
export const PERIOD_TYPE: Record<string, string> = {
  annual: 'سالانه',
  half1: 'شش‌ماهه اول',
  half2: 'شش‌ماهه دوم',
  custom: 'سفارشی',
};

export type Perm =
  | 'view'
  | 'approve'
  | 'settings'
  | 'reopen'
  | 'edit_budget'
  | 'actual'
  | 'variance'
  | 'investment'
  | 'revision';

const PERMS: Record<Role, Perm[]> = {
  manager: ['view', 'approve', 'settings', 'reopen'],
  accountant: ['view', 'edit_budget', 'actual', 'variance', 'investment', 'revision'],
};
export const roleCan = (role: Role | undefined, p: Perm) => !!role && PERMS[role].includes(p);

export const payMonthly = (r: PayrollRow) => PAY_FIELDS.reduce((s, [k]) => s + B(r[k]), 0n);
export const vLabel = (v: Pick<Version, 'number'>) => (v.number === 0 ? 'نسخه اولیه' : `اصلاحیه ${v.number.toLocaleString('fa-IR')}`);
export const favorable = (type: LineType, diff: bigint) => (type === 'revenue' ? diff >= 0n : diff <= 0n);
export const isRev = (r: { type: LineType }) => r.type === 'revenue';
export const isExp = (r: { type: LineType }) => r.type !== 'revenue';
export const varId = (r: { m: Month; type: LineType; key: string }) =>
  `${r.m.k}_${r.type}_${r.key}`.replace(/[^A-Za-z0-9_\-.~:@+]/g, '_');

export function monthsOf(p: Period | undefined | null): Month[] {
  if (!p) return [];
  return Array.from({ length: p.months }, (_, i) => {
    let m = p.start_jm + i;
    let y = p.start_jy;
    while (m > 12) {
      m -= 12;
      y++;
    }
    return { jy: y, jm: m, k: `${y}-${pad(m)}`, i };
  });
}
export function periodRange(p: Period) {
  const ms = monthsOf(p);
  const a = ms[0]!;
  const z = ms[ms.length - 1]!;
  return `${mName(a.jy, a.jm)} تا ${mName(z.jy, z.jm)}`;
}
export const monthShort = (m: Month) => MONTHS[m.jm - 1]!;

export class Ledger {
  private billCache: Record<string, Record<string, bigint>> = {};

  constructor(readonly d: Data) {}

  /* ---------- lookups ---------- */
  centerById = (id?: string) => this.d.centers.find((c) => c.id === id);
  headById = (id?: string) => this.d.heads.find((h) => h.id === id);
  cName = (id?: string) => this.centerById(id)?.name || '—';
  hName = (id?: string) => this.headById(id)?.name || '—';
  revCenters = (all?: boolean) => this.d.centers.filter((c) => c.kind === 'revenue' && (all || c.active));
  costCenters = (all?: boolean) => this.d.centers.filter((c) => c.kind === 'cost' && (all || c.active));
  periodById = (id?: string | null) => this.d.periods.find((p) => p.id === id);

  versionsOf = (pid: string) =>
    this.d.versions.filter((v) => v.period_id === pid).sort((a, b) => a.number - b.number);
  activeV = (pid: string): Version | null =>
    this.versionsOf(pid)
      .filter((v) => v.status === 'approved')
      .at(-1) ?? null;
  openV = (pid: string): Version | null =>
    this.versionsOf(pid).find((v) => ['draft', 'submitted', 'rejected'].includes(v.status)) ?? null;
  vStatus = (v: Version): VStatus => {
    if (v.status === 'approved') {
      const a = this.activeV(v.period_id);
      return a && a.id !== v.id ? 'superseded' : 'approved';
    }
    return v.status;
  };
  pendingCount = () => this.d.versions.filter((v) => v.status === 'submitted').length;

  /* ---------- budget lines ---------- */
  linesOf(v: Version): Line[] {
    const L: Line[] = [];
    for (const r of v.revenue || [])
      L.push({ type: 'revenue', key: r.center, center: r.center, label: this.cName(r.center), months: r.months.map(B) });
    for (const r of v.expense || [])
      L.push({
        type: 'expense',
        key: `${r.head}|${r.center}`,
        head: r.head,
        center: r.center,
        label: this.hName(r.head),
        months: r.months.map(B),
      });
    const n = this.periodById(v.period_id)?.months || 0;
    for (const r of v.payroll || []) {
      const m = payMonthly(r);
      L.push({ type: 'payroll', key: r.center, center: r.center, label: 'حقوق و مزایا', months: Array(n).fill(m) });
    }
    return L;
  }

  /** قبوض ماه → هزینه‌ی واقعی تخصیص‌یافته به head|center */
  billAlloc(mk: string) {
    const cached = this.billCache[mk];
    if (cached) return cached;
    const out: Record<string, bigint> = {};
    for (const b of this.d.bills) {
      if (b.month !== mk) continue;
      const head = this.d.heads.find((h) => h.utility === b.type);
      if (!head) continue;
      const amt = B(b.amount);
      const add = (c: string, v: bigint) => {
        const k = `${head.id}|${c}`;
        out[k] = (out[k] || 0n) + v;
      };
      if (b.mode === 'direct') add(b.center || '', amt);
      else {
        let rest = amt;
        b.alloc.forEach((a, i) => {
          const part = i === b.alloc.length - 1 ? rest : (amt * BigInt(a.pct)) / 100n;
          rest -= part;
          add(a.center, part);
        });
      }
    }
    return (this.billCache[mk] = out);
  }

  actualValue(type: LineType, key: string, mk: string) {
    if (type === 'expense') {
      const h = this.headById(key.split('|')[0]);
      if (h?.utility) return this.billAlloc(mk)[key] || 0n;
    }
    return B(this.d.actuals[mk]?.[type]?.[key]);
  }
  hasActual = (mk: string) => !!this.d.actuals[mk]?.saved_at || this.d.bills.some((b) => b.month === mk);

  /** وضعیت با قدر مطلق درصد انحراف در برابر آستانه‌های تنظیمات */
  statusOf(budget: bigint, actual: bigint): Status {
    const p = budget === 0n ? (actual === 0n ? 0 : null) : ratio(actual - budget, budget);
    if (p === null) return 'bad';
    const a = Math.abs(p);
    return a <= this.d.settings.green ? 'ok' : a <= this.d.settings.yellow ? 'warn' : 'bad';
  }

  analyze(pid: string, idxs: number[]) {
    const p = this.periodById(pid);
    const v = p ? this.activeV(pid) : null;
    if (!p) return { rows: [] as Row[], months: [] as Month[], version: null };
    const ms = monthsOf(p).filter((m) => idxs.includes(m.i));
    const base = v ? this.linesOf(v) : [];
    const map = new Map<string, Line>(base.map((l) => [`${l.type}:${l.key}`, l]));
    const n = p.months;
    const extra = (type: LineType, key: string) => {
      if (map.has(`${type}:${key}`)) return;
      const [h, c] = key.split('|') as [string, string];
      map.set(`${type}:${key}`, {
        type,
        key,
        head: type === 'expense' ? h : undefined,
        center: type === 'expense' ? c : key,
        label: type === 'expense' ? this.hName(h) : type === 'payroll' ? 'حقوق و مزایا' : this.cName(key),
        months: Array(n).fill(0n),
        unbudgeted: true,
      });
    };
    for (const m of ms) {
      const a = this.d.actuals[m.k];
      if (a)
        for (const t of ['revenue', 'expense', 'payroll'] as const)
          for (const k of Object.keys(a[t] || {})) if (B(a[t][k]) !== 0n) extra(t, k);
      for (const k of Object.keys(this.billAlloc(m.k))) extra('expense', k);
    }
    const rows: Row[] = [...map.values()].map((l) => {
      const budget = ms.reduce((s, m) => s + (l.months[m.i] || 0n), 0n);
      const actual = ms.reduce((s, m) => s + this.actualValue(l.type, l.key, m.k), 0n);
      const diff = actual - budget;
      return {
        ...l,
        budget,
        actual,
        diff,
        pct: budget === 0n ? null : ratio(diff, budget),
        ach: ratio(actual, budget),
        status: this.statusOf(budget, actual),
        fav: favorable(l.type, diff),
      };
    });
    return { rows, months: ms, version: v };
  }

  totalsBy(rows: Row[], f: (r: Row) => boolean): Totals {
    const r = rows.filter(f);
    const budget = sumB(r.map((x) => x.budget));
    const actual = sumB(r.map((x) => x.actual));
    const diff = actual - budget;
    return {
      budget,
      actual,
      diff,
      pct: budget === 0n ? null : ratio(diff, budget),
      ach: ratio(actual, budget),
      status: this.statusOf(budget, actual),
    };
  }

  monthsWithActual = (p: Period) => monthsOf(p).filter((m) => this.hasActual(m.k));
  missingMonths(p: Period) {
    const nowK = todayKey();
    return monthsOf(p).filter((m) => m.k < nowK && !this.hasActual(m.k));
  }

  versionTotals(v: Version) {
    const L = this.linesOf(v);
    const n = this.periodById(v.period_id)?.months || 0;
    const rev: bigint[] = Array(n).fill(0n);
    const exp: bigint[] = Array(n).fill(0n);
    const pay: bigint[] = Array(n).fill(0n);
    for (const l of L)
      l.months.forEach((x, i) => {
        if (l.type === 'revenue') rev[i]! += x;
        else if (l.type === 'payroll') pay[i]! += x;
        else exp[i]! += x;
      });
    const inv = sumB((v.investments || []).map((x) => x.amount));
    const R = sumB(rev);
    const E = sumB(exp);
    const P = sumB(pay);
    return { rev, exp, pay, R, E, P, inv, net: R - E - P };
  }

  scenarios(t: { R: bigint; E: bigint; P: bigint }) {
    const sc = this.d.settings.scen;
    const mk = (rp: number, ep: number) => {
      const R = t.R + pctOf(t.R, rp);
      const C = t.E + t.P + pctOf(t.E + t.P, ep);
      return { R, C, net: R - C };
    };
    return { cons: mk(sc.cons.rev, sc.cons.exp), likely: mk(0, 0), opt: mk(sc.opt.rev, sc.opt.exp) };
  }

  recentAudit(n: number) {
    return Object.entries(this.d.audit)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .flatMap(([, d]) => d.entries)
      .slice(0, n);
  }

  /* ---------- validation ---------- */
  validateVersion(d: Version) {
    const e: string[] = [];
    const p = this.periodById(d.period_id);
    if (!p) e.push('دوره بودجه معتبر نیست.');
    if (d.number > 0 && String(d.reason || '').trim().length < 5)
      e.push('دلیل اصلاحیه را در مرحله «دوره» بنویسید.');
    if (!(d.revenue || []).some((r) => r.months.some((x) => B(x) > 0n))) e.push('حداقل یک رقم درآمد وارد کنید.');
    const keys = new Set<string>();
    for (const r of d.expense || []) {
      if (!this.headById(r.head)) e.push('در مرحله هزینه‌ها، سرفصل یک ردیف انتخاب نشده است.');
      if (!this.centerById(r.center)) e.push('در مرحله هزینه‌ها، مرکز هزینه یک ردیف انتخاب نشده است.');
      const k = `${r.head}|${r.center}`;
      if (keys.has(k))
        e.push(`ردیف تکراری در هزینه‌ها: ${this.hName(r.head)} / ${this.cName(r.center)}. دو ردیف را یکی کنید.`);
      keys.add(k);
    }
    for (const r of d.payroll || []) if (!this.centerById(r.center)) e.push('واحد یک ردیف حقوق انتخاب نشده است.');
    for (const x of d.investments || []) {
      if (String(x.title || '').trim().length < 2) e.push('عنوان همه پروژه‌های سرمایه‌گذاری را بنویسید.');
      if (B(x.amount) <= 0n) e.push(`مبلغ پروژه «${x.title || 'بی‌نام'}» را وارد کنید.`);
    }
    return [...new Set(e)];
  }
}

export const AUDIT_ACT: Record<string, string> = {
  create: 'ایجاد',
  update: 'ویرایش',
  delete: 'حذف',
  submit: 'ارسال برای تأیید',
  approve: 'تأیید',
  reject: 'برگشت',
  close: 'بستن ماه',
  reopen: 'بازکردن ماه',
  logout: 'خروج',
  explain: 'ثبت علت انحراف',
  login: 'ورود',
  password: 'تغییر رمز',
  restore: 'بازیابی',
  access: 'تغییر دسترسی',
  ai: 'هوش مصنوعی ·',
};
export const AUDIT_ENT: Record<string, string> = {
  budget: 'بودجه',
  revision: 'اصلاحیه',
  period: 'دوره',
  actual: 'عملکرد',
  bill: 'قبض',
  variance: 'انحراف',
  investment: 'سرمایه‌گذاری',
  theme: 'هویت سازمان',
  settings: 'تنظیمات',
  center: 'مرکز',
  head: 'سرفصل',
  user: 'کاربر',
  sample: 'داده نمونه',
  backup: 'پشتیبان',
  report: 'گزارش',
};
export const auditText = (a: { action: string; entity: string; detail?: string }) =>
  `${AUDIT_ACT[a.action] || a.action} ${AUDIT_ENT[a.entity] || a.entity}${a.detail ? `: ${a.detail}` : ''}`;
