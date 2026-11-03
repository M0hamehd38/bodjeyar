'use client';

/**
 * نمودار ماهانه‌ی بودجه در برابر عملکرد — SVG درون‌خطی، بدون کتابخانه.
 * ماه ثبت‌نشده هرگز صفر کشیده نمی‌شود: ستون ندارد و «ثبت نشده» می‌گیرد.
 */

import { bmax, compact, MONTHS, tm } from '@/lib/format';
import { isExp, isRev, monthsOf, type Ledger } from '@/lib/ledger';
import type { Period } from '@/lib/types';

function niceStep(raw: number) {
  if (!(raw > 0)) return 1e6;
  const e = 10 ** Math.floor(Math.log10(raw));
  const f = raw / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}

const C = {
  rev: '#FF7900',
  exp: '#8F9AB0',
  budget: '#0D2041',
  grid: '#DDE2EB',
  muted: '#66728C',
  fg: '#0D2041',
};

export function MonthlyChart({ L, p, upto }: { L: Ledger; p: Period; upto: number }) {
  const v = L.activeV(p.id);
  if (!v) return null;
  const t = L.versionTotals(v);
  const ms = monthsOf(p);
  const data = ms.map((m) => {
    const { rows } = L.analyze(p.id, [m.i]);
    const has = L.hasActual(m.k);
    return {
      m,
      rB: t.rev[m.i]!,
      eB: t.exp[m.i]! + t.pay[m.i]!,
      rA: has ? L.totalsBy(rows, isRev).actual : null,
      eA: has ? L.totalsBy(rows, isExp).actual : null,
    };
  });
  const maxV = Number(bmax(data.flatMap((d) => [d.rB, d.eB, d.rA ?? 0n, d.eA ?? 0n])));
  const W = 700;
  const H = 260;
  const pl = 10;
  const pr = 74;
  const pt = 14;
  const pb = 34;
  const cw = W - pl - pr;
  const ch = H - pt - pb;
  const step = niceStep(maxV / 4);
  const top = Math.max(step * 4, step * Math.ceil(maxV / step) || 1);
  const y = (val: number) => pt + ch - (val / top) * ch;
  const slot = cw / ms.length;
  const bw = Math.min(26, slot * 0.26);
  const grid: number[] = [];
  for (let g = 0; g <= top + 1; g += step) grid.push(g);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" style={{ direction: 'ltr' }} role="img" aria-label="بودجه در برابر عملکرد ماهانه">
      {grid.map((g) => (
        <g key={g}>
          <line x1={pl} x2={W - pr} y1={y(g)} y2={y(g)} stroke={C.grid} strokeDasharray={g ? '3 4' : undefined} />
          <text x={W - pr + 8} y={y(g) + 4} fontSize="11" fill={C.muted}>
            {compact(BigInt(Math.round(g)))}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = W - pr - slot * (i + 0.5);
        const xr = cx + 2;
        const xe = cx - bw - 2;
        const dim = i > upto ? 0.35 : 1;
        const name = MONTHS[d.m.jm - 1];
        return (
          <g key={d.m.k}>
            {d.rA !== null && (
              <rect x={xr} y={y(Number(d.rA))} width={bw} height={Math.max(1, y(0) - y(Number(d.rA)))} rx="3" fill={C.rev} opacity={dim}>
                <title>{`${name} درآمد: ${tm(d.rA)} / بودجه ${tm(d.rB)}`}</title>
              </rect>
            )}
            {d.eA !== null && (
              <rect x={xe} y={y(Number(d.eA))} width={bw} height={Math.max(1, y(0) - y(Number(d.eA)))} rx="3" fill={C.exp} opacity={dim}>
                <title>{`${name} هزینه: ${tm(d.eA)} / بودجه ${tm(d.eB)}`}</title>
              </rect>
            )}
            <line x1={xr - 3} x2={xr + bw + 3} y1={y(Number(d.rB))} y2={y(Number(d.rB))} stroke={C.budget} strokeWidth="2.5" strokeLinecap="round" />
            <line x1={xe - 3} x2={xe + bw + 3} y1={y(Number(d.eB))} y2={y(Number(d.eB))} stroke={C.budget} strokeWidth="2.5" strokeLinecap="round" />
            <text x={cx} y={H - pb + 20} fontSize="11.5" textAnchor="middle" fill={i === upto ? C.fg : C.muted} fontWeight={i === upto ? 700 : 400}>
              {name}
            </text>
            {d.rA === null && (
              <text x={cx} y={y(0) - 6} fontSize="10" textAnchor="middle" fill={C.muted}>
                ثبت نشده
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function ChartLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <i className="h-2.5 w-2.5 rounded-sm" style={{ background: C.rev }} />
        درآمد واقعی
      </span>
      <span className="flex items-center gap-1.5">
        <i className="h-2.5 w-2.5 rounded-sm" style={{ background: C.exp }} />
        هزینه واقعی
      </span>
      <span className="flex items-center gap-1.5">
        <i className="h-0.5 w-4 rounded" style={{ background: C.budget }} />
        بودجه
      </span>
    </div>
  );
}
