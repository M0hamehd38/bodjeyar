'use client';

import { useState } from 'react';
import { AiButton, AiCard, AiChip, AiState } from '@/components/ai-assist';
import { NoBudget, NoPeriod, PeriodSelect, SampleBanner, StatusBadge } from '@/components/budget';
import { Alert, Button, Card, cx, EmptyState, ErrorText, Field, Input, PageHeader, Segmented, Select, TableWrap } from '@/components/ui';
import { CONF, useAiTask } from '@/lib/ai';
import { errMsg } from '@/lib/backend';
import { fa, jFa, mName, MONTHS, nf, pctFa } from '@/lib/format';
import { monthsOf, REASONS, TYPE_LABEL, varId, vLabel, type Ledger } from '@/lib/ledger';
import { usePeriod, useStore } from '@/lib/store';
import type { Month, Period, Row, VarianceNote } from '@/lib/types';

type VRow = Row & { m: Month };
interface Suggestion {
  reason: string;
  action: string;
  comment: string;
  confidence?: string;
}

/** ردیف‌های انحراف یک دوره با فیلتر؛ بحرانی‌ها اول. */
function varianceRows(L: Ledger, p: Period, f: { mi: string; type: string; only: boolean; skipExplained?: boolean }) {
  const rows: VRow[] = [];
  for (const m of monthsOf(p)) {
    if (f.mi !== 'all' && +f.mi !== m.i) continue;
    if (!L.hasActual(m.k)) continue;
    for (const r of L.analyze(p.id, [m.i]).rows) {
      if (f.type && r.type !== f.type) continue;
      if (f.only && r.status === 'ok') continue;
      if (f.skipExplained && (r.status === 'ok' || L.d.variances[varId({ ...r, m })])) continue;
      rows.push({ ...r, m });
    }
  }
  return rows.sort((a, b) => Number(b.status === 'bad') - Number(a.status === 'bad') || Math.abs(b.pct ?? 999) - Math.abs(a.pct ?? 999));
}

export default function VariancePage() {
  const { period: p, ledger: L, can, ai, repo, toast, audit } = usePeriod();
  const [f, setF] = useState({ mi: 'all', type: '', only: true });
  const [editing, setEditing] = useState<string | null>(null);
  const [sug, setSug] = useState<Record<string, Suggestion>>({});
  const task = useAiTask('variance_reason');

  const head = (title: string, desc?: string) => <PageHeader eyebrow="گزارش انحراف" title={title} description={desc} actions={<PeriodSelect />} />;
  if (!p)
    return (
      <>
        {head('انحراف و علت آن')}
        <NoPeriod />
      </>
    );
  const v = L.activeV(p.id);
  if (!v)
    return (
      <>
        {head('انحراف و علت آن', p.title)}
        <NoBudget p={p} />
      </>
    );

  const ms = monthsOf(p);
  const rows = varianceRows(L, p, f);
  const miss = L.missingMonths(p);
  const explained = rows.filter((r) => L.d.variances[varId(r)]).length;

  async function saveVar(r: VRow, x: Suggestion & { ai?: boolean }) {
    const id = varId(r);
    const rec: Omit<VarianceNote, 'by' | 'at'> = {
      id,
      month: r.m.k,
      type: r.type,
      key: r.key,
      label: r.type === 'revenue' ? L.cName(r.center) : `${r.label} · ${L.cName(r.center)}`,
      reason: x.reason,
      action: x.action || '',
      comment: x.comment || '',
      ai: !!x.ai,
      budget: String(r.budget),
      actual: String(r.actual),
    };
    if (!REASONS.includes(rec.reason)) throw { user: 'علت انحراف را انتخاب کنید.' };
    await repo.saveVariance(rec);
    setSug((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });
  }

  async function suggest() {
    const todo = varianceRows(L, p!, { ...f, only: false, skipExplained: true }).slice(0, 30);
    const items = todo.map((r) => {
      const trend = ms
        .filter((m) => L.hasActual(m.k))
        .map((m) => {
          const x = L.analyze(p!.id, [m.i]).rows.find((q) => q.type === r.type && q.key === r.key);
          return { month: MONTHS[m.jm - 1], budget: Number(x?.budget || 0n), actual: Number(x?.actual || 0n) };
        });
      return {
        id: varId(r),
        line: r.type === 'revenue' ? L.cName(r.center) : r.label,
        unit: L.cName(r.center),
        type: TYPE_LABEL[r.type],
        month: MONTHS[r.m.jm - 1],
        budget: Number(r.budget),
        actual: Number(r.actual),
        variance: Number(r.diff),
        variance_pct: r.pct,
        favorable: r.fav,
        from_utility_bills: !!L.headById(r.head)?.utility,
        trend,
      };
    });
    const prompt = `تو تحلیلگر مالی یک ${L.d.org.name} هستی. برای هر انحراف بودجه در فهرست زیر، محتمل‌ترین علت را از فهرست مجاز انتخاب کن، یک اقدام پیشنهادی عملی و کوتاه بده، و یک توضیح یک‌جمله‌ای بنویس که به عدد و روند اشاره کند.
علت‌های مجاز (دقیقاً یکی از این‌ها): ${JSON.stringify(REASONS)}
- به روند (trend) ماه‌های قبل نگاه کن: انحراف تکرارشونده معمولاً «پیش‌بینی غیرواقعی» یا «افزایش قیمت خرید» است، انحراف یک‌باره معمولاً رویداد موقت.
- برای درآمد، کمتر از بودجه نامطلوب است؛ برای هزینه، بیشتر از بودجه.
- confidence: high یا medium یا low.
- متن‌ها فارسی و کوتاه (اقدام حداکثر ۱۵ کلمه، توضیح حداکثر ۲۵ کلمه).
- اصلاحیه‌ها و توضیح‌های قبلی: ${JSON.stringify(L.versionsOf(p!.id).filter((x) => x.reason).map((x) => `${vLabel(x)}: ${x.reason}`))}
فقط یک آرایه JSON برگردان: [{"id":"...","reason":"...","action":"...","comment":"...","confidence":"medium"}]

انحراف‌ها:
${JSON.stringify(items)}`;
    const res = await task.run({ messages: [{ role: 'user', content: prompt }], json: true });
    if (!res) return;
    if (!Array.isArray(res.json)) return task.setError('پاسخ هوش مصنوعی ساختار درستی نداشت.');
    const next: Record<string, Suggestion> = { ...sug };
    let n = 0;
    for (const s of res.json as Record<string, unknown>[]) {
      if (!s || !items.find((i) => i.id === s.id)) continue;
      next[String(s.id)] = {
        reason: REASONS.includes(String(s.reason)) ? String(s.reason) : 'سایر',
        action: String(s.action || '').slice(0, 200),
        comment: String(s.comment || '').slice(0, 400),
        confidence: String(s.confidence || ''),
      };
      n++;
    }
    setSug(next);
    audit('ai', 'variance', '-', `پیشنهاد علت برای ${n} انحراف`);
    toast(`${fa(n)} پیشنهاد آماده شد؛ هر کدام را بپذیرید یا ویرایش کنید.`, 'ok');
  }

  const todoCount = rows.filter((r) => r.status !== 'ok' && !L.d.variances[varId(r)]).length;
  const sugRows = rows.filter((r) => sug[varId(r)] && !L.d.variances[varId(r)]);

  return (
    <>
      {head(`انحراف‌های ${p.title}`, 'هر انحراف مهم را با علت، اقدام پیشنهادی و توضیح ثبت کنید تا دلیل تصمیم‌ها بماند.')}
      <SampleBanner />
      {miss.length > 0 && (
        <Alert tone="attention" className="mb-4">
          داده ناقص: عملکرد {miss.map((m) => MONTHS[m.jm - 1]).join('، ')} ثبت نشده است.
        </Alert>
      )}

      <Card className="mb-4 flex flex-wrap items-end gap-4">
        <Field label="ماه" htmlFor="vf-m">
          <Select id="vf-m" compact value={f.mi} onChange={(e) => setF({ ...f, mi: e.target.value })}>
            <option value="all">همه ماه‌ها</option>
            {ms.map((m) => (
              <option key={m.i} value={m.i}>
                {mName(m.jy, m.jm)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="نوع" htmlFor="vf-t">
          <Select id="vf-t" compact value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="">همه</option>
            {Object.entries(TYPE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="نمایش">
          <Segmented
            value={f.only ? 1 : 0}
            onChange={(x) => setF({ ...f, only: x === 1 })}
            options={[
              { value: 1, label: 'فقط انحراف مهم' },
              { value: 0, label: 'همه ردیف‌ها' },
            ]}
          />
        </Field>
      </Card>

      {ai.on && can('variance') && (
        <AiCard title="پیشنهاد علت انحراف" subtitle="هوش مصنوعی روند ماه‌ها را می‌خواند و علت، اقدام و توضیح پیشنهاد می‌دهد؛ ثبت با شماست.">
          <div className="flex flex-wrap items-center gap-2">
            <AiButton pending={task.busy} disabled={!todoCount || task.busy} onClick={() => void suggest()}>
              پیشنهاد علت برای {fa(Math.min(todoCount, 30))} انحراف بدون علت
            </AiButton>
            {sugRows.length > 0 && (
              <Button
                variant="primary"
                onClick={async () => {
                  let n = 0;
                  for (const r of sugRows) {
                    try {
                      await saveVar(r, { ...sug[varId(r)]!, ai: true });
                      n++;
                    } catch {
                      /* ردیف بعدی */
                    }
                  }
                  toast(`${fa(n)} علت ثبت شد.`, 'ok');
                }}
              >
                پذیرفتن همه پیشنهادها ({fa(sugRows.length)})
              </Button>
            )}
          </div>
          <AiState busy={task.busy} error={task.error} label="در حال تحلیل انحراف‌ها…" onStop={task.stop} />
        </AiCard>
      )}

      <p className="mb-3 text-sm text-slate-500">
        {fa(rows.length)} ردیف · {fa(explained)} علت ثبت‌شده · محدوده سبز تا ±{fa(L.d.settings.green)}٪، زرد تا ±{fa(L.d.settings.yellow)}٪
      </p>
      <Card>
        <TableWrap>
          <table className="ledger">
            <thead>
              <tr>
                <th>بخش</th>
                <th>ماه</th>
                <th>نوع</th>
                <th className="n">بودجه</th>
                <th className="n">عملکرد</th>
                <th className="n">اختلاف</th>
                <th className="n">درصد</th>
                <th>وضعیت</th>
                <th>علت / اقدام</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState title="انحرافی نیست">
                      {L.monthsWithActual(p).length ? 'انحراف مهمی در این فیلتر نیست.' : 'هنوز عملکرد واقعی ثبت نشده است.'}
                    </EmptyState>
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const id = varId(r);
                const rec = L.d.variances[id];
                const s = sug[id];
                return (
                  <tr key={id} data-st={r.status}>
                    <td>
                      <b className="text-navy-900">{r.type === 'expense' ? r.label : L.cName(r.center)}</b>
                      {r.type === 'expense' && <div className="text-xs text-slate-500">{L.cName(r.center)}</div>}
                    </td>
                    <td className="text-xs">{MONTHS[r.m.jm - 1]}</td>
                    <td className="text-xs">{TYPE_LABEL[r.type]}</td>
                    <td className="n">{nf(r.budget)}</td>
                    <td className="n">{nf(r.actual)}</td>
                    <td className={cx('n', r.fav ? 'text-ok' : 'text-danger')}>{nf(r.diff)}</td>
                    <td className="n">{pctFa(r.pct, true)}</td>
                    <td className="whitespace-nowrap">
                      <StatusBadge st={r.status} /> <span className={cx('text-xs', r.fav ? 'text-ok' : 'text-danger')}>{r.fav ? 'مطلوب' : 'نامطلوب'}</span>
                    </td>
                    <td className="min-w-56">
                      {editing === id ? (
                        <VarForm
                          initial={rec || s}
                          onCancel={() => setEditing(null)}
                          onSave={async (x) => {
                            await saveVar(r, { ...x, ai: !!s && !rec });
                            setEditing(null);
                            toast('علت انحراف ثبت شد.', 'ok');
                          }}
                        />
                      ) : rec ? (
                        <div className="text-sm">
                          <b className="text-navy-900">{rec.reason}</b>
                          {rec.action && ` · ${rec.action}`}
                          {rec.comment && <div className="text-xs text-slate-500">{rec.comment}</div>}
                          <div className="text-xs text-slate-400">
                            <span dir="ltr">{rec.by}</span> · {jFa(rec.at)}
                            {rec.ai && ' · با پیشنهاد هوش مصنوعی'}
                          </div>
                          {can('variance') && (
                            <Button size="sm" variant="ghost" className="-ms-2 mt-1" onClick={() => setEditing(id)}>
                              ویرایش
                            </Button>
                          )}
                        </div>
                      ) : s && can('variance') ? (
                        <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-2.5 text-sm">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <AiChip />
                            <b className="text-navy-900">{s.reason}</b>
                            {s.confidence && <span className="text-xs text-slate-500">{CONF[s.confidence] || ''}</span>}
                          </div>
                          {s.action && <div className="mt-1 text-xs">اقدام: {s.action}</div>}
                          {s.comment && <div className="text-xs text-slate-500">{s.comment}</div>}
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={async () => {
                                try {
                                  await saveVar(r, { ...s, ai: true });
                                  toast('علت ثبت شد.', 'ok');
                                } catch (e) {
                                  toast(errMsg(e), 'bad');
                                }
                              }}
                            >
                              پذیرفتن
                            </Button>
                            <Button size="sm" onClick={() => setEditing(id)}>
                              ویرایش
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setSug((x) => {
                                  const n = { ...x };
                                  delete n[id];
                                  return n;
                                })
                              }
                            >
                              رد
                            </Button>
                          </div>
                        </div>
                      ) : can('variance') && r.status !== 'ok' ? (
                        <Button size="sm" onClick={() => setEditing(id)}>
                          ثبت علت
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </>
  );
}

function VarForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Suggestion>;
  onSave: (x: Suggestion) => Promise<void>;
  onCancel: () => void;
}) {
  const [x, setX] = useState<Suggestion>({ reason: initial?.reason || '', action: initial?.action || '', comment: initial?.comment || '' });
  const [err, setErr] = useState('');
  return (
    <div className="space-y-2">
      <Select compact aria-label="علت" value={x.reason} onChange={(e) => setX({ ...x, reason: e.target.value })}>
        <option value="">علت…</option>
        {REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>
      <Input compact maxLength={200} placeholder="اقدام پیشنهادی" value={x.action} onChange={(e) => setX({ ...x, action: e.target.value })} />
      <Input compact maxLength={400} placeholder="توضیح" value={x.comment} onChange={(e) => setX({ ...x, comment: e.target.value })} />
      <ErrorText>{err}</ErrorText>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="primary"
          onClick={async () => {
            try {
              await onSave({ ...x, action: x.action.trim(), comment: x.comment.trim() });
            } catch (e) {
              setErr(errMsg(e));
            }
          }}
        >
          ذخیره
        </Button>
        <Button size="sm" onClick={onCancel}>
          انصراف
        </Button>
      </div>
    </div>
  );
}

