'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AiButton, AiCard, AiState, ChatLog } from '@/components/ai-assist';
import {
  DashboardHero,
  METER_TONE,
  NoBudget,
  NoPeriod,
  PeriodSelect,
  SampleBanner,
  StatusBadge,
} from '@/components/budget';
import { ChartLegend, MonthlyChart } from '@/components/charts';
import { Icon } from '@/components/icons';
import { Alert, Button, Card, CardHeader, EmptyState, Input, Meter, Segmented, Select, Stat, TableWrap } from '@/components/ui';
import { AI_RULE_FA, aiPeriodData, useAiTask } from '@/lib/ai';
import { absB, compact, fa, jFa, mName, MONTHS, pctFa, ratio, signed, tm } from '@/lib/format';
import { auditText, isExp, isRev, monthsOf, STATUS_LABEL, TYPE_LABEL, vLabel } from '@/lib/ledger';
import { usePeriod } from '@/lib/store';
import type { Ledger } from '@/lib/ledger';
import type { Period, Status } from '@/lib/types';

const STAT_TONE: Record<Status, 'good' | 'warn' | 'bad' | 'neutral'> = { ok: 'good', warn: 'warn', bad: 'bad', none: 'neutral' };

export default function DashboardPage() {
  const { period: p, ledger: L, can } = usePeriod();
  const [uptoSel, setUpto] = useState<number | null>(null);
  const [single, setSingle] = useState(false);

  if (!p)
    return (
      <>
        <DashboardHero title="وضعیت مالی در یک نگاه" badge="داشبورد مدیریتی" />
        <NoPeriod />
      </>
    );

  const v = L.activeV(p.id);
  const ms = monthsOf(p);
  const withAct = L.monthsWithActual(p);
  const upto = Math.min(uptoSel ?? (withAct.length ? withAct.at(-1)!.i : 0), ms.length - 1);
  const idxs = single ? [upto] : ms.filter((m) => m.i <= upto).map((m) => m.i);
  const mu = ms[upto]!;
  const scopeLabel = single ? mName(mu.jy, mu.jm) : `از ${MONTHS[ms[0]!.jm - 1]} تا ${mName(mu.jy, mu.jm)}`;
  const pending = can('approve') ? L.pendingCount() : 0;

  const tools = (
    <>
      <PeriodSelect />
      <Select compact aria-label="ماه" value={upto} onChange={(e) => setUpto(+e.target.value)} className="w-auto">
        {ms.map((m) => (
          <option key={m.i} value={m.i}>
            {single ? '' : 'تا '}
            {mName(m.jy, m.jm)}
          </option>
        ))}
      </Select>
      <Segmented
        label="بازه"
        value={single ? 1 : 0}
        onChange={(x) => setSingle(x === 1)}
        options={[
          { value: 0, label: 'تجمعی' },
          { value: 1, label: 'همان ماه' },
        ]}
      />
    </>
  );

  const pendAlert = pending ? (
    <Alert
      tone="info"
      className="mb-4"
      action={
        <Link href="/budget">
          <Button variant="primary" size="sm">
            بررسی و تأیید
          </Button>
        </Link>
      }
    >
      <b>{fa(pending)} نسخه بودجه</b> منتظر تأیید شماست.
    </Alert>
  ) : null;

  if (!v)
    return (
      <>
        <DashboardHero title="وضعیت مالی در یک نگاه" badge={`${p.title} · ${scopeLabel}`} actions={tools} />
        <SampleBanner />
        {pendAlert}
        <NoBudget p={p} />
      </>
    );

  const { rows } = L.analyze(p.id, idxs);
  const R = L.totalsBy(rows, isRev);
  const E = L.totalsBy(rows, isExp);
  const P = L.totalsBy(rows, (r) => r.type === 'payroll');
  const netA = R.actual - E.actual;
  const netB = R.budget - E.budget;
  const netSt = L.statusOf(netB, netA);
  const miss = L.missingMonths(p).filter((m) => idxs.includes(m.i));
  const crit = rows
    .filter((r) => r.status === 'bad' && !r.fav && (r.budget > 0n || r.actual > 0n))
    .sort((a, b) => (absB(b.diff) > absB(a.diff) ? 1 : absB(b.diff) < absB(a.diff) ? -1 : 0));
  const revRows = rows.filter(isRev).sort((a, b) => (b.actual > a.actual ? 1 : -1));
  const units = L.costCenters(true)
    .map((c) => ({ c, ...L.totalsBy(rows, (r) => isExp(r) && r.center === c.id) }))
    .filter((u) => u.budget > 0n || u.actual > 0n);

  return (
    <>
      <DashboardHero
        badge={`${p.title} · ${scopeLabel}`}
        title="وضعیت مالی در یک نگاه"
        subtitle={`مبنای مقایسه: ${vLabel(v)} تأییدشده`}
        actions={tools}
        stats={[
          { label: 'تحقق درآمد', value: pctFa(R.ach) },
          { label: 'نتیجه مالی', value: compact(netA) },
        ]}
      />
      <SampleBanner />
      {pendAlert}
      {miss.length > 0 && (
        <Alert
          tone="attention"
          className="mb-4"
          action={
            can('actual') ? (
              <Link href="/actual">
                <Button size="sm">ثبت عملکرد</Button>
              </Link>
            ) : undefined
          }
        >
          عملکرد واقعی <b>{miss.map((m) => MONTHS[m.jm - 1]).join('، ')}</b> هنوز ثبت نشده؛ ارقام این بازه ناقص است.
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="درآمد کل"
          icon={<Icon.arrowUp size={20} />}
          value={compact(R.actual)}
          tone={STAT_TONE[R.status]}
          hint={`بودجه ${compact(R.budget)} · تحقق ${pctFa(R.ach)} · ${STATUS_LABEL[R.status]}`}
        />
        <Stat
          label="هزینه کل (با حقوق)"
          icon={<Icon.arrowDown size={20} />}
          value={compact(E.actual)}
          tone={STAT_TONE[E.status]}
          hint={`بودجه ${compact(E.budget)} · تحقق ${pctFa(E.ach)} · ${STATUS_LABEL[E.status]}`}
        />
        <Stat
          label="نتیجه مالی"
          icon={<Icon.chart size={20} />}
          value={compact(netA)}
          tone={netA < 0n ? 'bad' : STAT_TONE[netSt]}
          hint={`بودجه ${compact(netB)} · اختلاف ${compact(netA - netB)}`}
        />
        <Stat
          label="درصد تحقق بودجه درآمد"
          icon={<Icon.target size={20} />}
          tone="brand"
          value={pctFa(R.ach)}
          hint={`تحقق هزینه ${pctFa(E.ach)} · سهم حقوق از هزینه ${pctFa(ratio(P.actual, E.actual))}`}
          footer={
            <div className="mt-3">
              <Meter value={R.ach} tone={METER_TONE[R.status]} label={pctFa(R.ach)} />
            </div>
          }
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="بودجه در برابر عملکرد · ماهانه" icon={<Icon.chart size={18} />} action={<ChartLegend />} />
          <MonthlyChart L={L} p={p} upto={upto} />
        </Card>
        <Card>
          <CardHeader title="سه هشدار مهم" subtitle="بیشترین انحراف نامطلوب" icon={<Icon.alert size={18} />} />
          {crit.length ? (
            <>
              <ul className="space-y-2">
                {crit.slice(0, 3).map((r) => (
                  <li key={`${r.type}:${r.key}`} className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm">
                    <div className="font-bold text-navy-900">{r.label}</div>
                    <div className="mt-0.5 flex flex-wrap justify-between gap-2 text-xs text-danger">
                      <span>{r.type === 'expense' ? L.cName(r.center) : `${TYPE_LABEL[r.type]} ${L.cName(r.center)}`}</span>
                      <span>
                        {signed(r.diff, compact)} ({pctFa(r.pct, true)})
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{fa(crit.length)} هشدار بحرانی در این بازه</span>
                <Link href="/variance" className="text-xs font-medium text-brand-700 hover:text-brand-800">
                  همه انحراف‌ها ←
                </Link>
              </div>
            </>
          ) : (
            <EmptyState title="هشداری نیست">هشدار بحرانی نامطلوبی در این بازه نیست.</EmptyState>
          )}
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="سهم درآمد بخش‌ها" subtitle={`جمع ${tm(R.actual)}`} icon={<Icon.grid size={18} />} />
          {revRows.length ? (
            <ul className="space-y-3">
              {revRows.map((r) => {
                const s = ratio(r.actual, R.actual) || 0;
                return (
                  <li key={r.key} title={`${r.label}: ${tm(r.actual)}`} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3 text-sm">
                    <span className="truncate text-slate-700">{r.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.max(0, Math.min(100, s))}%` }} />
                    </span>
                    <span className="text-end text-xs font-bold text-navy-900">{pctFa(s)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="درآمدی نیست">برای این بازه درآمدی ثبت نشده است.</EmptyState>
          )}
        </Card>
        <Card>
          <CardHeader title="وضعیت واحدها" subtitle="هزینه + حقوق هر مرکز هزینه" icon={<Icon.building size={18} />} />
          <TableWrap>
            <table className="ledger">
              <thead>
                <tr>
                  <th>واحد</th>
                  <th className="n">بودجه</th>
                  <th className="n">واقعی</th>
                  <th className="n">تحقق</th>
                  <th>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.c.id} data-st={u.status}>
                    <td>{u.c.name}</td>
                    <td className="n">{compact(u.budget)}</td>
                    <td className="n">{compact(u.actual)}</td>
                    <td className="n">{pctFa(u.ach)}</td>
                    <td>
                      <StatusBadge st={u.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>

      <AskPanel L={L} p={p} />

      <Card>
        <CardHeader title="آخرین فعالیت‌ها" icon={<Icon.clock size={18} />} />
        <ul className="divide-y divide-slate-100">
          {L.recentAudit(6).map((a, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="text-slate-700">{auditText(a)}</span>
              <span className="text-xs text-slate-400">
                <span dir="ltr">{a.user}</span> · {jFa(a.at)}
              </span>
            </li>
          ))}
          {L.recentAudit(1).length === 0 && <li className="py-3 text-sm text-slate-400">فعالیتی ثبت نشده.</li>}
        </ul>
      </Card>
    </>
  );
}

const CHIPS = [
  'چرا نتیجه مالی با بودجه فرق دارد؟',
  'کدام واحد بیشترین انحراف نامطلوب را دارد؟',
  'وضعیت سرمایه‌گذاری‌ها چطور است؟',
  'اگر روند همین بماند، پایان دوره چه می‌شود؟',
];

/** پرسش مدیر از داده‌ها — جواب فقط بر پایه‌ی ارقام همین دوره. */
function AskPanel({ L, p }: { L: Ledger; p: Period }) {
  const { ai } = usePeriod();
  const task = useAiTask();
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  if (!ai.on) return null;

  async function ask(question: string) {
    const text = question.trim();
    if (!text || task.busy) return;
    const next = [...turns.slice(-6), { role: 'user' as const, content: text }];
    setTurns(next);
    setQ('');
    const rules = `تو تحلیلگر مالی کنار مدیر ${L.d.org.name} هستی و فقط بر اساس داده‌های JSON زیر جواب می‌دهی. جواب را کوتاه و مستقیم بده (حداکثر ۸ خط)، اول جواب اصلی بعد دلیل با عدد. اگر داده برای جواب کافی نیست بگو چه داده‌ای کم است. تصمیم نگیر؛ گزینه‌ها و اثرشان را بگو.
${AI_RULE_FA}

داده‌ها (budget و actual آرایه‌های ماهانه به ترتیب index ماه؛ actual=null یعنی ثبت نشده؛ حقوق و مزایا جزء هزینه است):
${JSON.stringify(aiPeriodData(L, p))}`;
    const res = await task.run({ system: rules, messages: next, effort: 'low' });
    if (res?.text) setTurns([...next, { role: 'assistant', content: res.text }]);
    else setTurns(turns);
  }

  return (
    <AiCard
      title="از داده‌ها بپرسید"
      subtitle="جواب فقط بر پایه ارقام همین دوره"
      action={
        turns.length ? (
          <Button size="sm" variant="ghost" onClick={() => setTurns([])}>
            گفت‌وگوی تازه
          </Button>
        ) : undefined
      }
    >
      {turns.length || task.busy ? (
        <ChatLog turns={turns} live={task.busy} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <AiButton key={c} soft onClick={() => void ask(c)}>
              {c}
            </AiButton>
          ))}
        </div>
      )}
      <AiState busy={task.busy} error={task.error} label="در حال بررسی ارقام…" onStop={task.stop} />
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <Input
          className="min-w-60 flex-1"
          maxLength={400}
          placeholder="مثلاً: چرا هزینه برق در خرداد بالا رفت؟"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={task.busy}
        />
        <AiButton type="submit" disabled={task.busy || !q.trim()}>
          بپرس
        </AiButton>
      </form>
    </AiCard>
  );
}
