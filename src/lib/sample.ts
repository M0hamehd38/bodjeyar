/**
 * ساختار پیش‌فرض نمایندگی و داده‌ی نمونه (قابل حذف از تنظیمات › داده‌ها).
 * داده‌ی نمونه برچسب `sample` دارد تا حذفش به داده‌ی واقعی دست نزند.
 */

import { clone, nowIso, pad } from './format';
import { monthsOf, payMonthly } from './ledger';
import type {
  Actual,
  Bill,
  Center,
  Head,
  InvTrack,
  Period,
  Version,
  VarianceNote,
} from './types';

export function defaultStructure(): { centers: Center[]; heads: Head[] } {
  const now = nowIso();
  const rc = [
    'فروش خودرو (کمیسیون)',
    'خدمات پس از فروش',
    'قطعات یدکی',
    'بیمه و کارت نارنجی',
    'صافکاری و نقاشی',
    'آپشن خودرو',
  ];
  const cc = ['فروش خودرو', 'خدمات پس از فروش', 'قطعات', 'صافکاری و نقاشی', 'اداری و مالی', 'مشترک'];
  const cost: Center[] = cc.map((n, i) => ({
    id: `cc${i + 1}`,
    kind: 'cost',
    name: n,
    active: true,
    order: i,
    has_staff: n !== 'مشترک',
    created_at: now,
  }));
  const linkTo: Record<number, string> = { 0: 'cc1', 1: 'cc2', 2: 'cc3', 4: 'cc4' };
  const rev: Center[] = rc.map((n, i) => ({
    id: `rc${i + 1}`,
    kind: 'revenue',
    name: n,
    active: true,
    order: i,
    link: linkTo[i] || '',
    created_at: now,
  }));
  const H = (
    id: string,
    name: string,
    kind: Head['kind'],
    center: string,
    extra?: Partial<Head>,
  ): Omit<Head, 'order'> => ({ id, name, kind, default_center: center, active: true, ...extra });
  const heads: Head[] = [
    H('h_pay', 'حقوق و مزایا', 'fixed', 'cc5', { payroll: true }),
    H('h_ins', 'بیمه', 'fixed', 'cc5'),
    H('h_water', 'آب', 'fixed', 'cc6', { utility: 'water' }),
    H('h_power', 'برق', 'fixed', 'cc6', { utility: 'power' }),
    H('h_phone', 'تلفن', 'fixed', 'cc5', { utility: 'phone' }),
    H('h_net', 'اینترنت', 'fixed', 'cc5', { utility: 'internet' }),
    H('h_tax', 'مالیات', 'fixed', 'cc5'),
    H('h_ofix', 'سایر هزینه‌های ثابت', 'fixed', 'cc6'),
    H('h_parts', 'خرید قطعات', 'variable', 'cc3'),
    H('h_cons', 'مواد مصرفی تعمیرگاه', 'variable', 'cc2'),
    H('h_paint', 'مواد رنگ', 'variable', 'cc4'),
    H('h_comm', 'پورسانت', 'variable', 'cc1'),
    H('h_ovar', 'سایر هزینه‌های متغیر', 'variable', 'cc6'),
  ].map((h, i) => ({ ...h, order: i }));
  return { centers: [...rev, ...cost], heads };
}

export interface SampleSet {
  periods: Period[];
  versions: Version[];
  actuals: Actual[];
  bills: Bill[];
  variances: VarianceNote[];
  inv: InvTrack[];
}

/** شش‌ماهه اول ۱۴۰۵ با عملکرد کامل و بسته، شش‌ماهه دوم منتظر تأیید مدیر. */
export function sampleData(acc: string, mgr: string, heads: Head[]): SampleSet {
  let seed = 11;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const jit = (a: number) => 1 + (rnd() * 2 - 1) * a;
  const M = 1000000;
  const r100k = (n: number) => String(Math.round(n / 100000) * 100000);
  const now = nowIso();
  const headById = (id: string) => heads.find((h) => h.id === id);

  const pA: Period = { id: 'p_s_h1_1405', title: 'شش‌ماهه اول ۱۴۰۵', type: 'half1', start_jy: 1405, start_jm: 1, months: 6, created_by: acc, created_at: '2026-03-01T08:00:00Z', sample: true };
  const pB: Period = { id: 'p_s_h2_1405', title: 'شش‌ماهه دوم ۱۴۰۵', type: 'half2', start_jy: 1405, start_jm: 7, months: 6, created_by: acc, created_at: '2026-09-01T08:00:00Z', sample: true };
  const season = [0.85, 0.95, 1.0, 1.05, 1.0, 1.1];
  const seasonB = [1.05, 1.0, 0.95, 0.9, 1.0, 1.25];
  const revBase: Record<string, number> = { rc1: 950, rc2: 620, rc3: 1050, rc4: 140, rc5: 360, rc6: 160 };
  const expBase: [string, string, number][] = [
    ['h_parts', 'cc3', 760], ['h_cons', 'cc2', 85], ['h_paint', 'cc4', 120], ['h_comm', 'cc1', 70],
    ['h_ovar', 'cc6', 30], ['h_ins', 'cc5', 40], ['h_water', 'cc2', 3.5], ['h_water', 'cc4', 2.1],
    ['h_water', 'cc5', 1.4], ['h_power', 'cc2', 24], ['h_power', 'cc4', 14.4], ['h_power', 'cc5', 9.6],
    ['h_phone', 'cc5', 4], ['h_net', 'cc5', 6], ['h_tax', 'cc5', 90], ['h_ofix', 'cc6', 35],
  ];
  const pay: Record<string, [number, number, number, number, number]> = {
    cc1: [7, 154, 10, 21, 25], cc2: [16, 336, 45, 48, 30], cc3: [5, 105, 6, 15, 8], cc4: [8, 176, 22, 24, 18], cc5: [5, 125, 4, 15, 5],
  };
  const variable = ['h_parts', 'h_cons', 'h_paint', 'h_comm'];
  const mkVersion = (p: Period, sea: number[], number: number, extra: Partial<Version>): Version => ({
    id: `v_s_${p.id}_${number}`, period_id: p.id, number, title: `بودجه ${p.title}`, status: 'approved', reason: '', wizard_step: 5, rev: 1, sample: true,
    created_by: acc, created_at: now, updated_at: now,
    revenue: Object.entries(revBase).map(([c, b]) => ({ center: c, months: sea.map((s) => r100k(b * M * s)) })),
    expense: expBase.map(([h, c, b]) => ({ head: h, center: c, months: sea.map((s) => r100k(b * M * (variable.includes(h) ? s : 1))) })),
    payroll: Object.entries(pay).map(([c, [hc, base, ot, ben, bon]]) => ({
      center: c, headcount: String(hc), base: String(base * M), overtime: String(ot * M), benefits: String(ben * M), bonus: String(bon * M),
      insurance: String(Math.round(base * 0.23) * M), eidi: String(Math.round(base / 6) * M), other: String(2 * M),
    })),
    investments: [],
    ...extra,
  });

  const vA0 = mkVersion(pA, season, 0, {
    created_at: '2026-03-05T08:00:00Z', submitted_by: acc, submitted_at: '2026-03-08T08:00:00Z', decided_by: mgr, decided_at: '2026-03-10T08:00:00Z', decision_note: 'تأیید شد.',
    investments: [
      { id: 'i_s1', title: 'بالابر دوستون (۲ دستگاه)', center: 'cc2', type: 'تجهیزات تعمیرگاه', amount: String(600 * M), month: 1, priority: 'high', description: 'افزایش ظرفیت پذیرش خدمات' },
      { id: 'i_s2', title: 'نرم‌افزار پذیرش و نوبت‌دهی', center: 'cc2', type: 'نرم‌افزار', amount: String(180 * M), month: 3, priority: 'mid', description: 'کاهش زمان انتظار مشتری' },
    ],
  });
  const vA1 = clone(vA0);
  Object.assign(vA1, {
    id: `v_s_${pA.id}_1`, number: 1, base_version_id: vA0.id, reason: 'افزایش قیمت خرید قطعات و تعرفه برق از تیرماه',
    created_at: '2026-06-24T08:00:00Z', submitted_at: '2026-06-25T08:00:00Z', decided_at: '2026-06-27T08:00:00Z', decision_note: 'با کنترل موجودی انبار تأیید شد.',
  });
  for (const i of [3, 4, 5]) {
    const pr = vA1.expense.find((e) => e.head === 'h_parts')!;
    pr.months[i] = r100k(Number(pr.months[i]) * 1.12);
    const rv = vA1.revenue.find((e) => e.center === 'rc3')!;
    rv.months[i] = r100k(Number(rv.months[i]) * 1.08);
    vA1.expense.filter((e) => e.head === 'h_power').forEach((e) => (e.months[i] = r100k(Number(e.months[i]) * 1.25)));
  }
  const vB0 = mkVersion(pB, seasonB, 0, {
    status: 'submitted', wizard_step: 5, created_at: '2026-09-10T08:00:00Z', submitted_by: acc, submitted_at: '2026-09-28T08:00:00Z',
    decided_by: null, decided_at: null, decision_note: '',
    investments: [
      { id: 'i_s3', title: 'کابین رنگ جدید', center: 'cc4', type: 'تجهیزات', amount: String(2800 * M), month: 2, priority: 'high', description: 'جایگزینی کابین فرسوده و افزایش کیفیت نقاشی' },
      { id: 'i_s4', title: 'بازسازی سالن نمایش', center: 'cc1', type: 'ساختمان', amount: String(1500 * M), month: 4, priority: 'mid', description: '' },
    ],
  });
  const r3 = vB0.revenue.find((r) => r.center === 'rc3')!;
  r3.months = r3.months.map((x) => r100k(Number(x) * 1.08));
  const hp = vB0.expense.find((r) => r.head === 'h_parts')!;
  hp.months = hp.months.map((x) => r100k(Number(x) * 1.12));
  vB0.payroll.forEach((p) => {
    for (const k of ['base', 'insurance', 'eidi'] as const) p[k] = String(Math.round((Number(p[k]) * 1.18) / M) * M);
  });

  const actuals: Actual[] = [];
  const bills: Bill[] = [];
  monthsOf(pA).forEach((m) => {
    const v = m.i >= 3 ? vA1 : vA0;
    const a: Actual = { id: m.k, revenue: {}, expense: {}, payroll: {}, closed: true, saved_at: `2026-0${Math.min(9, m.jm + 3)}-05T08:00:00Z`, updated_by: acc, closed_by: acc, rev: 1, sample: true };
    v.revenue.forEach((r) => {
      let f = jit(0.06);
      if (r.center === 'rc1' && m.i === 4) f = 0.8;
      if (r.center === 'rc5' && m.i === 2) f = 1.14;
      if (r.center === 'rc3' && m.i >= 2) f = jit(0.04) + 0.03;
      a.revenue[r.center] = r100k(Number(r.months[m.i]) * f);
    });
    v.expense.forEach((r) => {
      if (headById(r.head)?.utility) return;
      let f = jit(0.05);
      if (r.head === 'h_parts' && m.i === 2) f = 1.16;
      if (r.head === 'h_parts' && m.i >= 3) f = jit(0.04) + 0.02;
      if (r.head === 'h_ovar' && m.i === 1) f = 1.35;
      a.expense[`${r.head}|${r.center}`] = r100k(Number(r.months[m.i]) * f);
    });
    v.payroll.forEach((r) => {
      a.payroll[r.center] = r100k(Number(payMonthly(r)) * (r.center === 'cc2' && m.i >= 3 ? 1.07 : jit(0.025)));
    });
    actuals.push(a);
    const pw = [1.0, 1.05, 1.3, 1.32, 1.27, 1.12][m.i]! * 48 * M;
    const wt = [1, 1, 1.2, 1.3, 1.3, 1.1][m.i]! * 7 * M;
    const sharedAlloc = [{ center: 'cc2', pct: 50 }, { center: 'cc4', pct: 30 }, { center: 'cc5', pct: 20 }];
    const pd = (d: number) => `1405/${pad(Math.min(12, m.jm + 1))}/${d}`;
    bills.push(
      { id: `b_s_${m.k}_p`, type: 'power', subscription: '48201773', meter: 'کنتور ۱', location: 'ساختمان تعمیرگاه و اداری', amount: r100k(pw), month: m.k, pay_date: pd(10), mode: 'shared', alloc: sharedAlloc, sample: true },
      { id: `b_s_${m.k}_w`, type: 'water', subscription: '229140', meter: 'کنتور آب ۱', location: 'کل مجموعه', amount: r100k(wt), month: m.k, pay_date: pd(12), mode: 'shared', alloc: sharedAlloc, sample: true },
      { id: `b_s_${m.k}_t`, type: 'phone', subscription: '0765224', meter: '۵ خط', location: 'اداری', amount: r100k(4 * M * jit(0.1)), month: m.k, pay_date: '', mode: 'direct', center: 'cc5', alloc: [], sample: true },
      { id: `b_s_${m.k}_i`, type: 'internet', subscription: 'ADSL-991', meter: '', location: 'اداری', amount: String(6 * M), month: m.k, pay_date: '', mode: 'direct', center: 'cc5', alloc: [], sample: true },
    );
  });

  const variances: VarianceNote[] = [
    { id: '1405-05_revenue_rc1', month: '1405-05', type: 'revenue', key: 'rc1', label: 'فروش خودرو (کمیسیون)', reason: 'شرایط بازار', action: 'پیگیری تخصیص خودرو از شرکت و پیش‌فروش', comment: 'کاهش سهمیه تحویل مرداد', by: acc, at: '2026-08-30T08:00:00Z', sample: true },
    { id: '1405-03_expense_h_parts_cc3', month: '1405-03', type: 'expense', key: 'h_parts|cc3', label: 'خرید قطعات', reason: 'افزایش قیمت خرید', action: 'اصلاحیه بودجه از تیر', comment: 'افزایش نرخ تأمین‌کننده', by: acc, at: '2026-06-20T08:00:00Z', sample: true },
  ];
  const inv: InvTrack[] = [
    { id: 'i_s1', status: 'done', progress: 100, actual: String(640 * M), sample: true },
    { id: 'i_s2', status: 'running', progress: 60, actual: String(95 * M), sample: true },
  ];
  return { periods: [pA, pB], versions: [vA0, vA1, vB0], actuals, bills, variances, inv };
}
