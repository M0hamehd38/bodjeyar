/** نُه گزارش مدیریتی و خروجی Excel/PDF آن‌ها. */

import { B, fa, localIso, mName, MONTHS, nf, pctFa, ratio, sumB, todayFa, toEn } from './format';
import {
  INV_STATUS,
  isExp,
  isRev,
  monthsOf,
  PRIORITY,
  STATUS_LABEL,
  TYPE_LABEL,
  varId,
  type Ledger,
} from './ledger';
import type { Row, Status } from './types';

export const REPORTS = {
  summary: 'خلاصه مدیریتی',
  revenue: 'گزارش درآمد',
  expense: 'گزارش هزینه',
  units: 'گزارش عملکرد واحدها',
  bva: 'بودجه در برابر عملکرد',
  variance: 'گزارش انحراف',
  payroll: 'حقوق و مزایا',
  investment: 'سرمایه‌گذاری',
  compare: 'مقایسه دوره‌ها',
} as const;
export type ReportType = keyof typeof REPORTS;

export interface Cell {
  t: string;
  n?: number | '';
  num?: boolean;
  st?: Status;
}
export interface Report {
  title: string;
  scope: string;
  cols: string[];
  rows: Cell[][];
  foot: Cell[] | null;
  note: string;
  empty?: string;
}
export interface ReportFilter {
  type: ReportType;
  mi: string;
  mb: number | null;
  center: string;
  cost: string;
}

const C = {
  m: (b: bigint | string | undefined): Cell => ({ t: nf(b), n: Number(B(b)), num: true }),
  p: (x: number | null, s?: boolean): Cell => ({ t: pctFa(x, s), n: x === null ? '' : Math.round(x * 10) / 10, num: true }),
  t: (s: unknown): Cell => ({ t: String(s ?? '') }),
  s: (st: Status): Cell => ({ t: STATUS_LABEL[st], st }),
};

export function buildReport(L: Ledger, pid: string | null, r: ReportFilter): Report | null {
  const p = L.periodById(pid);
  if (!p) return null;
  const v = L.activeV(p.id);
  const ms = monthsOf(p);
  const idxs = r.mi === 'all' ? ms.map((m) => m.i).filter((i) => L.hasActual(ms[i]!.k)) : [+r.mi];
  const scope = r.mi === 'all' ? `${p.title} (ماه‌های دارای عملکرد)` : mName(ms[+r.mi]!.jy, ms[+r.mi]!.jm);
  const fC = (row: Row) => (!r.center || row.type !== 'revenue' || row.center === r.center) && (!r.cost || row.type === 'revenue' || row.center === r.cost);
  const out: Report = { title: REPORTS[r.type], scope, cols: [], rows: [], foot: null, note: '' };
  if (!v && r.type !== 'investment') return { ...out, empty: 'برای این دوره بودجه تأییدشده‌ای نیست.' };
  const rows = v ? L.analyze(p.id, idxs).rows.filter(fC) : [];

  if (r.type === 'summary') {
    const R = L.totalsBy(rows, isRev);
    const E = L.totalsBy(rows, isExp);
    const P = L.totalsBy(rows, (x) => x.type === 'payroll');
    const net = R.actual - E.actual;
    const netB = R.budget - E.budget;
    const crit = rows.filter((x) => x.status === 'bad' && !x.fav).length;
    const abs = (x: bigint) => (x < 0n ? -x : x);
    const big = rows.filter((x) => !x.fav).sort((a, b) => (abs(b.diff) > abs(a.diff) ? 1 : -1))[0];
    const inv = v!.investments || [];
    const invB = sumB(inv.map((x) => x.amount));
    const invA = sumB(inv.map((x) => L.d.inv[x.id]?.actual || 0));
    out.cols = ['شاخص', 'بودجه', 'عملکرد', 'اختلاف', 'درصد'];
    out.rows = [
      [C.t('درآمد کل'), C.m(R.budget), C.m(R.actual), C.m(R.diff), C.p(R.ach)],
      [C.t('هزینه کل (با حقوق)'), C.m(E.budget), C.m(E.actual), C.m(E.diff), C.p(E.ach)],
      [C.t('نتیجه مالی'), C.m(netB), C.m(net), C.m(net - netB), C.p(ratio(net, netB))],
      [C.t('سهم هزینه منابع انسانی'), C.t(''), C.m(P.actual), C.t(''), C.p(ratio(P.actual, E.actual))],
      [C.t('مصرف بودجه سرمایه‌گذاری'), C.m(invB), C.m(invA), C.m(invA - invB), C.p(ratio(invA, invB))],
      [C.t('تعداد هشدارهای بحرانی'), C.t(''), C.t(fa(crit)), C.t(''), C.t('')],
      [
        C.t('بیشترین انحراف نامطلوب'),
        C.t(''),
        C.t(big ? `${big.label} · ${L.cName(big.center)}` : '—'),
        big ? C.m(big.diff) : C.t(''),
        big ? C.p(big.pct, true) : C.t(''),
      ],
    ];
    out.note = 'درصد ستون آخر = تحقق (عملکرد ÷ بودجه).';
  } else if (r.type === 'revenue') {
    out.cols = ['مرکز درآمد', 'بودجه', 'عملکرد', 'اختلاف', 'درصد اختلاف', 'درصد تحقق', 'سهم از درآمد', 'وضعیت'];
    const R = L.totalsBy(rows, isRev);
    out.rows = rows
      .filter(isRev)
      .map((x) => [C.t(L.cName(x.center)), C.m(x.budget), C.m(x.actual), C.m(x.diff), C.p(x.pct, true), C.p(x.ach), C.p(ratio(x.actual, R.actual)), C.s(x.status)]);
    out.foot = [C.t('جمع'), C.m(R.budget), C.m(R.actual), C.m(R.diff), C.p(R.pct, true), C.p(R.ach), C.p(100), C.s(R.status)];
  } else if (r.type === 'expense') {
    out.cols = ['سرفصل', 'گروه', 'مرکز هزینه', 'بودجه', 'عملکرد', 'اختلاف', 'درصد اختلاف', 'وضعیت'];
    const ex = rows.filter((x) => x.type === 'expense');
    const E = L.totalsBy(ex, () => true);
    out.rows = ex
      .sort((a, b) => (L.headById(a.head)?.kind || '').localeCompare(L.headById(b.head)?.kind || ''))
      .map((x) => [
        C.t(x.label),
        C.t(L.headById(x.head)?.kind === 'variable' ? 'متغیر' : 'ثابت'),
        C.t(L.cName(x.center)),
        C.m(x.budget),
        C.m(x.actual),
        C.m(x.diff),
        C.p(x.pct, true),
        C.s(x.status),
      ]);
    out.foot = [C.t('جمع'), C.t(''), C.t(''), C.m(E.budget), C.m(E.actual), C.m(E.diff), C.p(E.pct, true), C.s(E.status)];
    out.note = 'حقوق و مزایا در گزارش جداگانه آمده است.';
  } else if (r.type === 'units') {
    out.cols = ['واحد', 'درآمد واقعی', 'هزینه واقعی', 'حقوق واقعی', 'بودجه هزینه کل', 'تحقق هزینه', 'وضعیت هزینه'];
    out.rows = L.costCenters(true)
      .filter((c) => !r.cost || c.id === r.cost)
      .map((c) => {
        const ex = L.totalsBy(rows, (x) => x.type === 'expense' && x.center === c.id);
        const py = L.totalsBy(rows, (x) => x.type === 'payroll' && x.center === c.id);
        const tot = L.totalsBy(rows, (x) => isExp(x) && x.center === c.id);
        const rc = L.revCenters(true).find((x) => x.link === c.id);
        const rv = rc ? L.totalsBy(rows, (x) => isRev(x) && x.center === rc.id) : null;
        return [C.t(c.name), rv ? C.m(rv.actual) : C.t('—'), C.m(ex.actual), C.m(py.actual), C.m(tot.budget), C.p(tot.ach), C.s(tot.status)];
      });
    out.note = 'درآمد واحد از مرکز درآمد مرتبط با آن واحد (در تنظیمات) خوانده می‌شود.';
  } else if (r.type === 'bva') {
    out.cols = ['ردیف', 'نوع', 'بودجه', 'عملکرد', 'اختلاف', 'درصد اختلاف', 'درصد تحقق', 'وضعیت'];
    const order = ['revenue', 'expense', 'payroll'];
    out.rows = rows
      .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))
      .map((x) => [
        C.t(x.type === 'revenue' ? L.cName(x.center) : `${x.label} · ${L.cName(x.center)}`),
        C.t(TYPE_LABEL[x.type]),
        C.m(x.budget),
        C.m(x.actual),
        C.m(x.diff),
        C.p(x.pct, true),
        C.p(x.ach),
        C.s(x.status),
      ]);
  } else if (r.type === 'variance') {
    out.cols = ['بخش', 'ماه', 'نوع', 'بودجه', 'عملکرد', 'اختلاف', 'درصد', 'علت', 'اقدام پیشنهادی', 'توضیح'];
    for (const i of idxs) {
      const m = ms[i]!;
      for (const x of L.analyze(p.id, [i]).rows.filter(fC)) {
        if (x.status === 'ok') continue;
        const rec = L.d.variances[varId({ ...x, m })];
        out.rows.push([
          C.t(x.type === 'revenue' ? L.cName(x.center) : `${x.label} · ${L.cName(x.center)}`),
          C.t(MONTHS[m.jm - 1]),
          C.t(TYPE_LABEL[x.type]),
          C.m(x.budget),
          C.m(x.actual),
          C.m(x.diff),
          C.p(x.pct, true),
          C.t(rec?.reason || 'ثبت نشده'),
          C.t(rec?.action || ''),
          C.t(rec?.comment || ''),
        ]);
      }
    }
  } else if (r.type === 'payroll') {
    out.cols = ['واحد', 'تعداد پرسنل', 'بودجه', 'عملکرد', 'اختلاف', 'درصد اختلاف', 'سهم از کل هزینه', 'وضعیت'];
    const E = L.totalsBy(rows, isExp);
    const py = rows.filter((x) => x.type === 'payroll');
    const P = L.totalsBy(py, () => true);
    out.rows = py.map((x) => [
      C.t(L.cName(x.center)),
      C.t(fa(v!.payroll.find((q) => q.center === x.center)?.headcount || '—')),
      C.m(x.budget),
      C.m(x.actual),
      C.m(x.diff),
      C.p(x.pct, true),
      C.p(ratio(x.actual, E.actual)),
      C.s(x.status),
    ]);
    out.foot = [C.t('جمع'), C.t(fa(sumB(v!.payroll.map((q) => q.headcount)))), C.m(P.budget), C.m(P.actual), C.m(P.diff), C.p(P.pct, true), C.p(ratio(P.actual, E.actual)), C.s(P.status)];
    out.note = 'HR Cost Ratio = هزینه منابع انسانی ÷ کل هزینه × ۱۰۰';
  } else if (r.type === 'investment') {
    const vv = v || L.openV(p.id);
    out.cols = ['پروژه', 'واحد', 'ماه اجرا', 'اولویت', 'وضعیت', 'پیشرفت', 'مصوب', 'واقعی', 'مصرف بودجه'];
    out.rows = (vv?.investments || [])
      .filter((x) => !r.cost || x.center === r.cost)
      .map((x) => {
        const t = L.d.inv[x.id] || { status: 'planned' as const, progress: 0, actual: '0' };
        return [
          C.t(x.title),
          C.t(L.cName(x.center)),
          C.t(ms[x.month] ? MONTHS[ms[x.month]!.jm - 1] : ''),
          C.t(PRIORITY[x.priority] || ''),
          C.t(INV_STATUS[t.status]),
          C.p(t.progress),
          C.m(x.amount),
          C.m(t.actual),
          C.p(ratio(t.actual, x.amount)),
        ];
      });
  } else if (r.type === 'compare') {
    const a = r.mi === 'all' ? 0 : +r.mi;
    const b = r.mb ?? Math.min(a + 1, ms.length - 1);
    const ra = L.analyze(p.id, [a]).rows;
    const rb = L.analyze(p.id, [b]).rows;
    out.scope = `${mName(ms[a]!.jy, ms[a]!.jm)} در برابر ${mName(ms[b]!.jy, ms[b]!.jm)}`;
    out.cols = ['شرح', `عملکرد ${MONTHS[ms[a]!.jm - 1]}`, `عملکرد ${MONTHS[ms[b]!.jm - 1]}`, 'تغییر', 'درصد تغییر'];
    const line = (label: string, f: (q: Row) => boolean) => {
      const x = sumB(ra.filter(f).filter(fC).map((q) => q.actual));
      const y = sumB(rb.filter(f).filter(fC).map((q) => q.actual));
      return [C.t(label), C.m(x), C.m(y), C.m(y - x), C.p(x === 0n ? null : ratio(y - x, x), true)];
    };
    out.rows = [
      ...L.revCenters(true)
        .filter((c) => !r.center || c.id === r.center)
        .map((c) => line(`درآمد · ${c.name}`, (q) => isRev(q) && q.center === c.id)),
      line('جمع درآمد', isRev),
      line('هزینه‌ها', (q) => q.type === 'expense'),
      line('حقوق و مزایا', (q) => q.type === 'payroll'),
      line('جمع هزینه', isExp),
    ];
    out.note = 'دو ماه از دوره جاری را مقایسه می‌کند. ماه دوم را از فیلتر «ماه مقایسه» انتخاب کنید.';
  }
  return out;
}

/* ------------------------------ خروجی ------------------------------ */

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const fileName = (kind: string, ext: string) => `budgetyar-${kind}-${localIso(new Date())}.${ext}`;

export function downloadText(name: string, text: string, type = 'application/json') {
  download(name, new Blob([text], { type }));
}

export async function exportXlsx(rep: Report, org: string, kind: string, summary?: string) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('گزارش', { views: [{ rightToLeft: true }] });
  const toCell = (c: Cell) => (c.num && typeof c.n === 'number' ? c.n : toEn(c.t));
  ws.addRow([`${org} — ${rep.title}`]).font = { bold: true, size: 14 };
  ws.addRow([toEn(rep.scope)]);
  if (summary) ws.addRow([`خلاصه (هوش مصنوعی): ${summary}`]);
  ws.addRow([]);
  const h = ws.addRow(rep.cols);
  h.font = { bold: true };
  h.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF0F5' } };
  });
  for (const r of rep.rows) ws.addRow(r.map(toCell));
  if (rep.foot) ws.addRow(rep.foot.map(toCell)).font = { bold: true };
  ws.columns.forEach((col, i) => {
    col.width = i ? 18 : 32;
    col.numFmt = '#,##0';
  });
  const buf = await wb.xlsx.writeBuffer();
  download(fileName(kind, 'xlsx'), new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

const ST_COL: Record<Status, [string, string]> = {
  ok: ['#15803d', '#f0fdf4'],
  warn: ['#a16207', '#fefce8'],
  bad: ['#b91c1c', '#fef2f2'],
  none: ['#66728c', '#edf0f5'],
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** PDF با هویت سایپا استوار: سربرگ سرمه‌ای با نوار نارنجی، جدول دفتری. */
export async function exportPdf(rep: Report, org: string, user: string, kind: string, summary?: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const td = (c: Cell) =>
    c.st
      ? `<td style="padding:7px 9px;border-bottom:1px solid #dde2eb"><span style="background:${ST_COL[c.st][1]};color:${ST_COL[c.st][0]};padding:1px 9px;border-radius:99px;font-size:11px">${STATUS_LABEL[c.st]}</span></td>`
      : `<td style="padding:7px 9px;border-bottom:1px solid #dde2eb;${c.num ? 'text-align:left;white-space:nowrap' : ''}">${esc(c.t)}</td>`;
  const node = document.createElement('div');
  node.dir = 'rtl';
  node.style.cssText =
    'position:fixed;left:-12000px;top:0;width:1100px;background:#fff;color:#1b2d52;padding:34px;font-family:Estedad,Tahoma,sans-serif;font-size:13px;line-height:1.7;font-feature-settings:"ss01"';
  node.innerHTML = `<div style="background:#0d2041;color:#fff;border-radius:16px;padding:18px 22px;margin-bottom:18px;position:relative;overflow:hidden">
    <div style="position:absolute;left:-20px;top:-30px;width:180px;height:14px;background:#ff7900;transform:rotate(45deg);transform-origin:left"></div>
    <div style="font-size:12px;color:#c3cbd8">${esc(org)} · بودجه‌یار</div>
    <div style="font-size:22px;font-weight:900">${esc(rep.title)}</div>
    <div style="font-size:12px;color:#c3cbd8">${esc(rep.scope)} · تهیه: ${todayFa()} · ${esc(user)}</div></div>
    ${summary ? `<div style="border:1px solid #ffcb9c;background:#fff5eb;border-radius:12px;padding:10px 14px;margin-bottom:14px;white-space:pre-wrap;font-size:12.5px;line-height:1.9"><b>خلاصه مدیریتی</b> <span style="font-size:10px;color:#b34e00">(نوشته هوش مصنوعی، بازبینی‌شده توسط تهیه‌کننده)</span>\n${esc(summary)}</div>` : ''}
    <table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#edf0f5;color:#4b5772">${rep.cols.map((c) => `<th style="padding:8px 9px;text-align:right;font-weight:500">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rep.rows.map((r) => `<tr>${r.map(td).join('')}</tr>`).join('')}${rep.foot ? `<tr style="font-weight:700;background:#f5f7fa">${rep.foot.map(td).join('')}</tr>` : ''}</tbody></table>
    ${rep.note ? `<p style="font-size:11px;color:#66728c;margin-top:12px">${esc(rep.note)}</p>` : ''}`;
  document.body.appendChild(node);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff', logging: false });
    const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const m = 8;
    const iw = pw - 2 * m;
    const ih = (canvas.height * iw) / canvas.width;
    const img = canvas.toDataURL('image/png');
    let y = 0;
    pdf.addImage(img, 'PNG', m, m, iw, ih);
    while (ih - y > ph - 2 * m) {
      y += ph - 2 * m;
      pdf.addPage();
      pdf.addImage(img, 'PNG', m, m - y, iw, ih);
    }
    download(fileName(kind, 'pdf'), pdf.output('blob'));
  } finally {
    node.remove();
  }
}
