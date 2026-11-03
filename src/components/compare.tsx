'use client';

import { EmptyState, TableWrap } from '@/components/ui';
import { compact, nf, pctFa, ratio, signed, sumB } from '@/lib/format';
import { TYPE_LABEL, vLabel, type Ledger } from '@/lib/ledger';
import type { Version } from '@/lib/types';

/** مقایسه‌ی دو نسخه‌ی بودجه — اثر کلی و ردیف‌به‌ردیف. */
export function CompareTable({ L, a, b }: { L: Ledger; a?: Version | null; b?: Version | null }) {
  if (!a || !b) return <EmptyState title="نسخه‌ای برای مقایسه نیست" />;
  const la = new Map(L.linesOf(a).map((l) => [`${l.type}:${l.key}`, l]));
  const lb = new Map(L.linesOf(b).map((l) => [`${l.type}:${l.key}`, l]));
  const keys = [...new Set([...la.keys(), ...lb.keys()])];
  const rows = keys
    .map((k) => {
      const x = la.get(k);
      const y = lb.get(k);
      const l = (y || x)!;
      const old = x ? sumB(x.months) : 0n;
      const nw = y ? sumB(y.months) : 0n;
      return { k, l, old, nw, d: nw - old };
    })
    .filter((r) => r.old !== 0n || r.nw !== 0n)
    .sort((r1, r2) => Number(r2.d !== 0n) - Number(r1.d !== 0n));
  const ta = L.versionTotals(a);
  const tb = L.versionTotals(b);
  const effect = (label: string, o: bigint, n: bigint) => (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-black ${n - o > 0n ? 'text-navy-900' : n - o < 0n ? 'text-navy-900' : 'text-slate-500'}`}>
        {signed(n - o, compact)}
      </div>
      <div className="text-xs text-slate-500">
        {compact(o)} ← {compact(n)} ({pctFa(o === 0n ? null : ratio(n - o, o), true)})
      </div>
    </div>
  );
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {effect('درآمد', ta.R, tb.R)}
        {effect('هزینه', ta.E, tb.E)}
        {effect('حقوق و مزایا', ta.P, tb.P)}
        {effect('نتیجه مالی', ta.net, tb.net)}
      </div>
      <TableWrap>
        <table className="ledger">
          <thead>
            <tr>
              <th>ردیف</th>
              <th>نوع</th>
              <th className="n">رقم قبلی ({vLabel(a)})</th>
              <th className="n">رقم جدید ({vLabel(b)})</th>
              <th className="n">مبلغ تغییر</th>
              <th className="n">درصد تغییر</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k} className={r.d === 0n ? 'text-slate-400' : ''}>
                <td>
                  <b className={r.d === 0n ? 'font-medium' : 'text-navy-900'}>{r.l.type === 'revenue' ? L.cName(r.l.center) : r.l.label}</b>
                  {r.l.type !== 'revenue' && <div className="text-xs text-slate-500">{L.cName(r.l.center)}</div>}
                </td>
                <td className="text-xs">{TYPE_LABEL[r.l.type]}</td>
                <td className="n">{nf(r.old)}</td>
                <td className="n">{nf(r.nw)}</td>
                <td className={`n ${r.d === 0n ? '' : 'font-bold text-navy-900'}`}>{signed(r.d)}</td>
                <td className="n">{r.d === 0n ? '—' : pctFa(r.old === 0n ? null : ratio(r.d, r.old), true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </>
  );
}
