'use client';

/**
 * داشبورد دوره‌ی مرجع — دوره‌ای که عملکرد واقعی دارد ولی بودجه ندارد (مثل شش‌ماهه
 * اول ۱۴۰۵ که از فایل اطلاعات اولیه وارد شده). به‌جای «بودجه در برابر عملکرد»،
 * سود و زیان ماهانه، ترکیب درآمد، هزینه‌ی واحدها و حساب‌ها را نشان می‌دهد.
 */

import Link from 'next/link';
import { DashboardHero, MiniStat, PeriodSelect } from '@/components/budget';
import { Icon } from '@/components/icons';
import { Alert, Button, Card, CardHeader, Meter, Stat, TableWrap } from '@/components/ui';
import { B, bmax, compact, mName, MONTHS, nf, pctFa, ratio, sumB, tm } from '@/lib/format';
import { monthsOf, type Ledger } from '@/lib/ledger';
import type { Period } from '@/lib/types';

function PnlChart({ L, p }: { L: Ledger; p: Period }) {
  const ms = monthsOf(p);
  const rows = ms.map((m) => ({ m, has: L.hasActual(m.k), ...L.actualTotals(m.k) }));
  const max = Number(bmax(rows.flatMap((r) => [r.R, r.E + r.P]))) || 1;
  const W = 640;
  const H = 230;
  const pad = 34;
  const bw = (W - pad * 2) / ms.length;
  const y = (v: bigint) => H - 28 - (Number(v) / max) * (H - 60);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="درآمد و هزینه‌ی ماهانه">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={pad} x2={W - pad} y1={H - 28 - f * (H - 60)} y2={H - 28 - f * (H - 60)} stroke="#DDE2EB" strokeDasharray={f ? '3 4' : undefined} />
            <text x={W - pad + 4} y={H - 24 - f * (H - 60)} fontSize="9" fill="#66728C" textAnchor="start">
              {compact(BigInt(Math.round(max * f)))}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x = W - pad - (i + 1) * bw;
          const w = Math.min(22, bw / 3);
          const cx = x + bw / 2;
          return (
            <g key={r.m.k}>
              {r.has ? (
                <>
                  <rect x={cx + 2} y={y(r.R)} width={w} height={H - 28 - y(r.R)} rx="3" fill="#FF7900">
                    <title>{`درآمد ${mName(r.m.jy, r.m.jm)}: ${tm(r.R)}`}</title>
                  </rect>
                  <rect x={cx - w - 2} y={y(r.P)} width={w} height={H - 28 - y(r.P)} rx="3" fill="#0D2041">
                    <title>{`حقوق: ${tm(r.P)}`}</title>
                  </rect>
                  <rect x={cx - w - 2} y={y(r.E + r.P)} width={w} height={y(r.P) - y(r.E + r.P)} rx="3" fill="#8F9AB0">
                    <title>{`هزینه (بدون حقوق): ${tm(r.E)}`}</title>
                  </rect>
                  <text x={cx} y={Math.min(y(r.R), y(r.E + r.P)) - 6} fontSize="10" fontWeight="700" textAnchor="middle" fill={r.net >= 0n ? '#0E7A4F' : '#C0262D'}>
                    {compact(r.net)}
                  </text>
                </>
              ) : (
                <text x={cx} y={H - 40} fontSize="10" textAnchor="middle" fill="#66728C">
                  ثبت نشده
                </text>
              )}
              <text x={cx} y={H - 10} fontSize="11" textAnchor="middle" fill="#0D2041">
                {MONTHS[r.m.jm - 1]}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#FF7900]" />درآمد</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#8F9AB0]" />هزینه</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#0D2041]" />حقوق و مزایا</span>
        <span>عدد بالای ستون: نتیجه‌ی ماه</span>
      </figcaption>
    </figure>
  );
}

export function HistoryDashboard({ L, p }: { L: Ledger; p: Period }) {
  const ms = L.monthsWithActual(p);
  const T = ms.map((m) => L.actualTotals(m.k));
  const R = sumB(T.map((t) => t.R));
  const E = sumB(T.map((t) => t.E));
  const P = sumB(T.map((t) => t.P));
  const net = R - E - P;
  const idx = ms.map((m) => m.i);
  const { rows } = L.analyze(p.id, idx);

  const revRows = L.revCenters(true)
    .map((c) => ({ c, v: rows.filter((r) => r.type === 'revenue' && r.center === c.id).reduce((s, r) => s + r.actual, 0n) }))
    .filter((x) => x.v > 0n)
    .sort((a, b) => (b.v > a.v ? 1 : -1));
  const groups = new Map<string, bigint>();
  revRows.forEach((x) => groups.set(x.c.group || x.c.name, (groups.get(x.c.group || x.c.name) || 0n) + x.v));

  const units = L.costCenters(true)
    .map((c) => {
      const exp = rows.filter((r) => r.type === 'expense' && r.center === c.id).reduce((s, r) => s + r.actual, 0n);
      const pay = rows.filter((r) => r.type === 'payroll' && r.center === c.id).reduce((s, r) => s + r.actual, 0n);
      const rev = rows.filter((r) => r.type === 'revenue' && L.centerById(r.center)?.link === c.id).reduce((s, r) => s + r.actual, 0n);
      return { c, exp, pay, rev, cost: exp + pay };
    })
    .filter((u) => u.cost > 0n || u.rev > 0n)
    .sort((a, b) => (b.cost > a.cost ? 1 : -1));
  const heads = new Map<string, bigint>();
  rows.filter((r) => r.type === 'expense').forEach((r) => heads.set(r.head || '', (heads.get(r.head || '') || 0n) + r.actual));
  const topHeads = [...heads.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1)).slice(0, 8);

  const rec = sumB(L.d.accounts.filter((a) => a.kind === 'receivable' && a.status !== 'settled').map((a) => B(a.amount) - B(a.settled)));
  const pay = sumB(L.d.accounts.filter((a) => a.kind === 'payable' && a.status !== 'settled').map((a) => B(a.amount) - B(a.settled)));
  const capex = sumB(L.d.capex.filter((x) => monthsOf(p).some((m) => m.k === x.month)).map((x) => x.amount));
  const next = L.d.periods.find((q) => q.id !== p.id && !q.history && (L.openV(q.id) || L.activeV(q.id)));
  const nextV = next ? L.openV(next.id) || L.activeV(next.id) : null;
  const best = T.reduce((b, t, i) => (t.net > (T[b]?.net ?? 0n) ? i : b), 0);
  const worst = T.reduce((b, t, i) => (t.net < (T[b]?.net ?? 0n) ? i : b), 0);

  return (
    <>
      <DashboardHero
        badge={`${p.title} · دوره‌ی مرجع`}
        title="وضعیت مالی در یک نگاه"
        subtitle={`عملکرد واقعی ${ms.length.toLocaleString('fa-IR')} ماه از فایل اطلاعات اولیه؛ این دوره بودجه ندارد و مبنای بودجه‌ی دوره‌ی بعد است.`}
        actions={<PeriodSelect />}
        stats={[
          { label: 'درآمد', value: compact(R) },
          { label: 'نتیجه مالی', value: compact(net) },
          { label: 'حاشیه سود', value: pctFa(ratio(net, R)) },
        ]}
      />

      {next && nextV && (
        <Alert
          tone="info"
          className="mb-4"
          action={
            <Link href="/budget">
              <Button size="sm" variant="primary">
                بررسی پیش‌نویس
              </Button>
            </Link>
          }
        >
          پیش‌نویس <b>بودجه‌ی {next.title}</b> از روی میانگین همین عملکرد ساخته شده و منتظر بازبینی حسابدار و تأیید مدیر است. ایجنت مالی می‌تواند ارقامش را با فصلی‌بودن و تورم تنظیم کند.
        </Alert>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="درآمد کل" value={compact(R)} tone="good" icon={<Icon.arrowUp size={18} />} hint={`میانگین ماهانه ${compact(R / BigInt(ms.length || 1))}`} />
        <Stat label="هزینه‌ها (با قبوض)" value={compact(E)} tone="warn" icon={<Icon.arrowDown size={18} />} hint={`${pctFa(ratio(E, R))} از درآمد`} />
        <Stat label="حقوق و مزایا" value={compact(P)} tone="bad" icon={<Icon.users size={18} />} hint={`${pctFa(ratio(P, R))} از درآمد`} href="/staff" />
        <Stat label="نتیجه‌ی عملیاتی" value={compact(net)} tone={net >= 0n ? 'good' : 'bad'} icon={<Icon.pulse size={18} />} hint={ms.length ? `بهترین ${MONTHS[ms[best]!.jm - 1]} · ضعیف‌ترین ${MONTHS[ms[worst]!.jm - 1]}` : undefined} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader icon={<Icon.chart size={16} />} title="سود و زیان ماهانه" subtitle="درآمد در برابر هزینه و حقوق هر ماه" />
          <PnlChart L={L} p={p} />
        </Card>
        <Card>
          <CardHeader icon={<Icon.inbox size={16} />} title="حساب‌ها و سرمایه‌گذاری" action={<Link href="/accounts" className="text-xs text-brand-700 hover:underline">جزئیات</Link>} />
          <div className="grid gap-2">
            <MiniStat label="مطالبات باز" value={compact(rec)} sub="دریافتنی وصول‌نشده" />
            <MiniStat label="بدهی‌های باز" value={compact(pay)} sub="به تأمین‌کنندگان و اشخاص" />
            <MiniStat label="خالص حساب‌ها" value={compact(rec - pay)} />
            <MiniStat label="خرید سرمایه‌ای دوره" value={compact(capex)} sub={`${pctFa(ratio(capex, R))} از درآمد`} />
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Icon.car size={16} />} title="ترکیب درآمد" subtitle="سهم هر مرکز درآمد از کل" />
          <div className="mb-4 flex flex-wrap gap-2">
            {[...groups.entries()]
              .sort((a, b) => (b[1] > a[1] ? 1 : -1))
              .map(([g, v]) => (
                <span key={g} className="rounded-lg bg-navy-900 px-2.5 py-1 text-xs text-white">
                  {g} <b className="text-brand-400">{pctFa(ratio(v, R))}</b>
                </span>
              ))}
          </div>
          <ul className="space-y-2.5">
            {revRows.map(({ c, v }) => (
              <li key={c.id}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="text-navy-900">
                    {c.name}
                    {c.group && <span className="ms-1 text-xs text-slate-400">· {c.group}</span>}
                  </span>
                  <span className="text-slate-600">
                    {compact(v)} · {pctFa(ratio(v, R))}
                  </span>
                </div>
                <Meter value={ratio(v, revRows[0]!.v)} label={c.name} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader icon={<Icon.building size={16} />} title="هزینه و سهم واحدها" subtitle="هزینه + حقوق مستقیم هر واحد؛ درآمد مرتبط برای مقایسه" />
          <TableWrap>
            <table className="ledger">
              <thead>
                <tr>
                  <th>واحد</th>
                  <th className="n">درآمد مرتبط</th>
                  <th className="n">حقوق</th>
                  <th className="n">هزینه</th>
                  <th className="n">نتیجه</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.c.id}>
                    <td>
                      <b className="text-navy-900">{u.c.name}</b>
                    </td>
                    <td className="n">{u.rev ? compact(u.rev) : '—'}</td>
                    <td className="n">{compact(u.pay)}</td>
                    <td className="n">{compact(u.exp)}</td>
                    <td className={`n ${u.rev - u.cost >= 0n ? 'text-ok' : 'text-danger'}`}>{u.rev ? compact(u.rev - u.cost) : <span className="text-slate-400">پشتیبان</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Icon.list size={16} />} title="بزرگ‌ترین سرفصل‌های هزینه" subtitle="بدون حقوق" action={<Link href="/entries" className="text-xs text-brand-700 hover:underline">ریز اسناد</Link>} />
          <ul className="space-y-2.5">
            {topHeads.map(([h, v]) => (
              <li key={h}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="text-navy-900">{L.hName(h)}</span>
                  <span className="text-slate-600">
                    {compact(v)} · {pctFa(ratio(v, E))}
                  </span>
                </div>
                <Meter value={ratio(v, topHeads[0]![1])} tone="navy" label={L.hName(h)} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader icon={<Icon.table size={16} />} title="جدول ماهانه" />
          <TableWrap>
            <table className="ledger">
              <thead>
                <tr>
                  <th>ماه</th>
                  <th className="n">درآمد</th>
                  <th className="n">هزینه</th>
                  <th className="n">حقوق</th>
                  <th className="n">نتیجه</th>
                  <th className="n">حاشیه</th>
                </tr>
              </thead>
              <tbody>
                {ms.map((m, i) => (
                  <tr key={m.k}>
                    <td>{mName(m.jy, m.jm)}</td>
                    <td className="n">{nf(T[i]!.R)}</td>
                    <td className="n">{nf(T[i]!.E)}</td>
                    <td className="n">{nf(T[i]!.P)}</td>
                    <td className={`n ${T[i]!.net >= 0n ? 'text-ok' : 'text-danger'}`}>{nf(T[i]!.net)}</td>
                    <td className="n">{pctFa(ratio(T[i]!.net, T[i]!.R))}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td>جمع</td>
                  <td className="n">{nf(R)}</td>
                  <td className="n">{nf(E)}</td>
                  <td className="n">{nf(P)}</td>
                  <td className="n">{nf(net)}</td>
                  <td className="n">{pctFa(ratio(net, R))}</td>
                </tr>
              </tbody>
            </table>
          </TableWrap>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/agent">
              <Button size="sm" variant="primary">
                <Icon.sparkles size={14} />
                گزارش مدیریتی با ایجنت
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
