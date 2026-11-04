'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AiButton, AiState } from '@/components/ai-assist';
import { NoBudget, NoPeriod, PeriodSelect, SampleBanner, VersionBadge } from '@/components/budget';
import { CompareTable } from '@/components/compare';
import { Icon } from '@/components/icons';
import { Alert, Button, Card, CardHeader, cx, ErrorText, Field, PageHeader, Select, TableWrap, Textarea } from '@/components/ui';
import { aiPeriodData, toAmt, useAiTask } from '@/lib/ai';
import { errMsg } from '@/lib/backend';
import { B, clone, fa, jFa, nf, pctFa, ratio, signed, sumB } from '@/lib/format';
import { monthsOf, V_STATUS, vLabel, type Ledger } from '@/lib/ledger';
import { usePeriod, useStore } from '@/lib/store';
import type { LineType, Period } from '@/lib/types';

export default function RevisionsPage() {
  const { period: p, ledger: L, can, repo } = usePeriod();
  const router = useRouter();
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const head = (title: string) => (
    <PageHeader
      eyebrow="اصلاحیه بودجه"
      title={title}
      description="بودجه اولیه هیچ‌وقت حذف یا بازنویسی نمی‌شود؛ هر تغییر یک اصلاحیه با دلیل و تأیید مدیر است."
      actions={<PeriodSelect />}
    />
  );
  if (!p)
    return (
      <>
        {head('نسخه‌ها و اصلاحیه‌ها')}
        <NoPeriod />
      </>
    );
  const vs = L.versionsOf(p.id);
  if (!vs.length)
    return (
      <>
        {head(`نسخه‌های ${p.title}`)}
        <NoBudget p={p} />
      </>
    );
  const av = L.activeV(p.id);
  const ov = L.openV(p.id);
  const va = vs.find((x) => x.id === a) || (vs.length > 1 ? vs.at(-2)! : vs[0]!);
  const vb = vs.find((x) => x.id === b) || vs.at(-1)!;
  const canNew = can('revision') && av && !ov;
  const openWz = (id: string, step?: number) => router.push(`/budget?v=${id}${step !== undefined ? `&step=${step}` : ''}`);

  return (
    <>
      {head(`نسخه‌های ${p.title}`)}
      <SampleBanner />
      {canNew && (
        <Card className="mb-6">
          <CardHeader
            title={`ایجاد اصلاحیه ${fa(Math.max(...vs.map((x) => x.number)) + 1)}`}
            subtitle={`اصلاحیه از روی ${vLabel(av)} (نسخه فعال) کپی می‌شود. ارقام را در ویزارد تغییر دهید و برای تأیید بفرستید.`}
            icon={<Icon.edit size={18} />}
          />
          <Field label="دلیل اصلاحیه" htmlFor="rv-reason" required>
            <Textarea id="rv-reason" rows={3} maxLength={400} placeholder="مثلاً افزایش قیمت خرید قطعات از تیرماه" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="mt-3">
            <ErrorText>{err}</ErrorText>
          </div>
          <Button
            variant="primary"
            className="mt-3"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr('');
              try {
                const v = await repo.createRevision(p.id, reason);
                openWz(v.id, 1);
              } catch (e) {
                setErr(errMsg(e));
                setBusy(false);
              }
            }}
          >
            ایجاد اصلاحیه
          </Button>
          <RevisionAi L={L} p={p} onCreated={(id) => openWz(id, 1)} />
        </Card>
      )}
      {!canNew && ov && (
        <Alert
          tone="info"
          className="mb-6"
          action={
            <Button size="sm" onClick={() => openWz(ov.id)}>
              باز کردن
            </Button>
          }
        >
          {vLabel(ov)} در وضعیت «{V_STATUS[L.vStatus(ov)]}» است. تا تعیین تکلیف آن، اصلاحیه جدید ساخته نمی‌شود.
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader title="تاریخچه نسخه‌ها" icon={<Icon.archive size={18} />} />
        <TableWrap>
          <table className="ledger">
            <thead>
              <tr>
                <th>نسخه</th>
                <th>تاریخ</th>
                <th>ایجادکننده</th>
                <th>دلیل</th>
                <th>وضعیت</th>
                <th className="n">اثر مالی بر نتیجه</th>
              </tr>
            </thead>
            <tbody>
              {vs.map((v, i) => {
                const prev = i ? vs.slice(0, i).filter((x) => x.status === 'approved').at(-1) || vs[i - 1] : null;
                const t = L.versionTotals(v);
                const pt = prev ? L.versionTotals(prev) : null;
                const d = pt ? t.net - pt.net : 0n;
                return (
                  <tr key={v.id}>
                    <td>
                      <b className="text-navy-900">{vLabel(v)}</b>
                    </td>
                    <td className="text-xs">{jFa(v.created_at)}</td>
                    <td className="text-xs" dir="ltr">
                      {v.created_by}
                    </td>
                    <td className="max-w-72 text-xs">{v.reason || (v.number === 0 ? 'بودجه مبنا' : '—')}</td>
                    <td>
                      <VersionBadge v={v} />
                    </td>
                    <td className={cx('n', pt && (d >= 0n ? 'text-ok' : 'text-danger'))}>{pt ? signed(d) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card>
        <CardHeader
          title="مقایسه دو نسخه"
          icon={<Icon.graph size={18} />}
          action={
            <div className="flex items-center gap-2">
              <Select compact aria-label="نسخه مبنا" value={va.id} onChange={(e) => setA(e.target.value)} className="w-auto">
                {vs.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vLabel(v)}
                  </option>
                ))}
              </Select>
              <span className="text-slate-400">←</span>
              <Select compact aria-label="نسخه مقایسه" value={vb.id} onChange={(e) => setB(e.target.value)} className="w-auto">
                {vs.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vLabel(v)}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        <CompareTable L={L} a={va} b={vb} />
      </Card>
    </>
  );
}

interface Change {
  type: LineType;
  key: string;
  label: string;
  months: Record<number, string>;
  old: bigint;
  nw: bigint;
  why: string;
  on: boolean;
}

/** پیشنهاد اصلاحیه برای ماه‌های باقی‌مانده بر پایه‌ی روند عملکرد. */
function RevisionAi({ L, p, onCreated }: { L: Ledger; p: Period; onCreated: (id: string) => void }) {
  const { ai, repo, toast, audit } = useStore();
  const task = useAiTask('revision_suggest');
  const [R, setR] = useState<{ reason: string; summary: string; changes: Change[] } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!ai.on) return null;

  async function propose() {
    const v = L.activeV(p.id)!;
    const ms = monthsOf(p);
    const withA = ms.filter((m) => L.hasActual(m.k));
    const last = withA.length ? withA.at(-1)!.i : -1;
    const remaining = ms.filter((m) => m.i > last);
    if (!withA.length) return task.setError('هنوز عملکرد واقعی ثبت نشده؛ پیشنهاد اصلاحیه بر پایه عملکرد ساخته می‌شود.');
    if (!remaining.length) return task.setError('ماهی از این دوره باقی نمانده که اصلاح شود.');
    const data = aiPeriodData(L, p) as { lines?: { type: string }[] };
    data.lines = (data.lines || []).filter((l) => l.type !== 'payroll');
    const prompt = `تو تحلیلگر بودجه هستی. بر اساس عملکرد واقعی ماه‌های گذشته، پیشنهاد اصلاحیه بودجه برای ماه‌های باقی‌مانده دوره بده.
- فقط ماه‌هایی با index ${remaining.map((m) => m.i).join(', ')} قابل تغییرند. ماه‌های گذشته را تغییر نده.
- فقط ردیف‌هایی را تغییر بده که روند واقعی به‌طور معنادار و تکرارشونده با بودجه فرق دارد (معمولاً بیش از ${L.d.settings.green}٪ در چند ماه). انحراف یک‌باره دلیل اصلاح نیست.
- حقوق و مزایا را تغییر نده.
- type یکی از revenue یا expense و key دقیقاً همان key ردیف در داده است.
- مبالغ عدد صحیح به تومان، مبلغ کل همان ماه برای آن ردیف.
- reason: دلیل کلی اصلاحیه در یک جمله فارسی. summary: اثر کلی در دو جمله. why: دلیل هر ردیف کوتاه.
فقط یک شیء JSON برگردان:
{"reason":"","summary":"","changes":[{"type":"expense","key":"h_parts|cc3","months":[{"index":${remaining[0]!.i},"amount":0}],"why":""}]}

داده دوره (budget و actual آرایه‌های ماهانه به ترتیب index؛ actual=null یعنی ثبت نشده):
${JSON.stringify(data)}`;
    const res = await task.run({ messages: [{ role: 'user', content: prompt }], json: true, complex: true });
    if (!res) return;
    const j = res.json as { reason?: string; summary?: string; changes?: Record<string, unknown>[] } | null;
    if (!j || typeof j !== 'object') return task.setError('پاسخ هوش مصنوعی ساختار درستی نداشت.');
    const lines = new Map(L.linesOf(v).map((l) => [`${l.type}:${l.key}`, l]));
    const remIdx = new Set(remaining.map((m) => m.i));
    const changes: Change[] = [];
    for (const c of j.changes || []) {
      const type = String(c.type) as LineType;
      if (!['revenue', 'expense'].includes(type)) continue;
      const l = lines.get(`${type}:${String(c.key)}`);
      if (!l) continue;
      const mm: Record<number, string> = {};
      for (const x of (c.months as { index: number; amount: unknown }[]) || []) if (remIdx.has(+x.index)) mm[+x.index] = toAmt(x.amount);
      if (!Object.keys(mm).length) continue;
      const old = sumB([...remIdx].map((i) => l.months[i]));
      const nw = sumB([...remIdx].map((i) => (mm[i] !== undefined ? B(mm[i]) : l.months[i])));
      if (old === nw) continue;
      changes.push({
        type,
        key: l.key,
        label: type === 'revenue' ? L.cName(l.center) : `${l.label} · ${L.cName(l.center)}`,
        months: mm,
        old,
        nw,
        why: String(c.why || '').slice(0, 200),
        on: true,
      });
    }
    setR({ reason: String(j.reason || '').slice(0, 400), summary: String(j.summary || '').slice(0, 600), changes });
    audit('ai', 'revision', p.id, `پیشنهاد اصلاحیه: ${fa(changes.length)} ردیف`);
  }

  async function apply() {
    const sel = R!.changes.filter((c) => c.on);
    if (!sel.length) return toast('هیچ ردیفی انتخاب نشده.', 'bad');
    setBusy(true);
    try {
      const v = await repo.createRevision(p.id, `${R!.reason || 'اصلاح بر اساس روند عملکرد'} (پیشنهاد هوش مصنوعی)`);
      const d = clone(v);
      for (const c of sel) {
        const row = c.type === 'revenue' ? d.revenue.find((r) => r.center === c.key) : d.expense.find((r) => `${r.head}|${r.center}` === c.key);
        if (!row) continue;
        Object.entries(c.months).forEach(([i, amt]) => (row.months[+i] = amt));
        (d.ai_notes ||= {})[`${c.type}:${c.key}`] = c.why;
      }
      await repo.saveVersion(d);
      toast('اصلاحیه پیش‌نویس ساخته شد؛ بازبینی و ارسال کنید.', 'ok');
      onCreated(d.id);
    } catch (e) {
      toast(errMsg(e), 'bad');
      setBusy(false);
    }
  }

  return (
    <div className="ai-surface mt-5 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <AiButton pending={task.busy} disabled={task.busy} onClick={() => void propose()}>
          پیشنهاد اصلاحیه از روی عملکرد
        </AiButton>
        <span className="text-xs text-slate-500">هوش مصنوعی روند ماه‌های گذشته را می‌خواند و ماه‌های باقی‌مانده را پیشنهاد می‌دهد.</span>
      </div>
      <AiState busy={task.busy} error={task.error} label="در حال تحلیل روند… ممکن است یک تا دو دقیقه طول بکشد." onStop={task.stop} />
      {R &&
        (R.changes.length ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm">
              <b>دلیل پیشنهادی:</b> {R.reason}
            </p>
            {R.summary && <p className="text-sm text-slate-500">{R.summary}</p>}
            <TableWrap>
              <table className="ledger">
                <thead>
                  <tr>
                    <th />
                    <th>ردیف</th>
                    <th className="n">بودجه فعلی ماه‌های باقی‌مانده</th>
                    <th className="n">پیشنهاد</th>
                    <th className="n">تغییر</th>
                    <th>دلیل</th>
                  </tr>
                </thead>
                <tbody>
                  {R.changes.map((c, i) => (
                    <tr key={c.key}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label="انتخاب"
                          className="h-4 w-4 accent-brand-600"
                          checked={c.on}
                          onChange={(e) => setR({ ...R, changes: R.changes.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)) })}
                        />
                      </td>
                      <td>
                        <b className="text-navy-900">{c.label}</b>
                      </td>
                      <td className="n">{nf(c.old)}</td>
                      <td className="n">{nf(c.nw)}</td>
                      <td className="n">
                        {signed(c.nw - c.old)} ({pctFa(ratio(c.nw - c.old, c.old), true)})
                      </td>
                      <td className="text-xs">{c.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={busy} onClick={() => void apply()}>
                ساخت اصلاحیه با ردیف‌های انتخاب‌شده
              </Button>
              <Button variant="ghost" onClick={() => setR(null)}>
                رد پیشنهاد
              </Button>
            </div>
            <p className="text-xs text-slate-500">اصلاحیه به‌صورت پیش‌نویس ساخته می‌شود؛ پیش از ارسال برای تأیید می‌توانید هر رقم را تغییر دهید.</p>
          </div>
        ) : (
          <Alert
            tone="ok"
            className="mt-4"
            action={
              <Button size="sm" onClick={() => setR(null)}>
                بستن
              </Button>
            }
          >
            هوش مصنوعی دلیلی برای اصلاح بودجه ماه‌های باقی‌مانده پیدا نکرد.{R.summary ? ` ${R.summary}` : ''}
          </Alert>
        ))}
    </div>
  );
}
