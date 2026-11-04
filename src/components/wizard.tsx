'use client';

/**
 * ویزارد شش‌مرحله‌ای تدوین بودجه: دوره، درآمدها، هزینه‌ها، حقوق و مزایا،
 * سرمایه‌گذاری، بررسی و ارسال. رفتن به مرحله‌ی دیگر خودکار ذخیره می‌کند.
 */

import { useEffect, useRef, useState } from 'react';
import { AiButton, AiCard, AiChip, AiState, ChatLog } from '@/components/ai-assist';
import { AmountInput, VersionBadge } from '@/components/budget';
import { CompareTable } from '@/components/compare';
import { Icon } from '@/components/icons';
import {
  Alert,
  Button,
  Card,
  cx,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  TableWrap,
  Textarea,
} from '@/components/ui';
import { AI_RULE_FA, aiReference, aiStructure, toAmt, toInt, useAiTask } from '@/lib/ai';
import { errMsg } from '@/lib/backend';
import { B, clone, compact, fa, jFa, mName, MONTHS, nf, nowIso, pctFa, ratio, sumB, tm, uid } from '@/lib/format';
import {
  monthsOf,
  PAY_FIELDS,
  payMonthly,
  PERIOD_TYPE,
  PRIORITY,
  periodRange,
  V_STATUS,
  vLabel,
  type Ledger,
} from '@/lib/ledger';
import { useStore } from '@/lib/store';
import type { Period, Priority, Version } from '@/lib/types';
import { ApprovalPanel } from '@/components/approval';

export const WZ_STEPS = ['تنظیم دوره', 'درآمدها', 'هزینه‌ها', 'حقوق و مزایا', 'سرمایه‌گذاری', 'بررسی و ارسال'];

export function Wizard({ vid, initialStep, onClose }: { vid: string; initialStep?: number; onClose: () => void }) {
  const { ledger: L, can, repo, toast, audit, ai } = useStore();
  const src = L.d.versions.find((x) => x.id === vid);
  const editable0 = !!src && ['draft', 'rejected'].includes(src.status) && can('edit_budget');
  const [d, setD] = useState<Version | null>(() => (src ? clone(src) : null));
  const [step, setStep] = useState(() => initialStep ?? (editable0 ? Math.min(src?.wizard_step || 0, 5) : 5));
  const [dirty, setDirty] = useState(false);
  const [aiOpen, setAiOpen] = useState(
    () => editable0 && !(src?.revenue || []).some((r) => r.months.some((x) => B(x) > 0n)),
  );
  const [cmp, setCmp] = useState<{ a: string; b: string } | null>(null);
  const dRef = useRef(d);
  dRef.current = d;

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  if (!d || !src) return <EmptyState title="نسخه پیدا نشد" action={<Button onClick={onClose}>بازگشت</Button>} />;
  const p = L.periodById(d.period_id)!;
  const live = L.d.versions.find((x) => x.id === vid)!;
  const ro = !(can('edit_budget') && ['draft', 'rejected'].includes(live.status));

  const upd = (fn: (x: Version) => void) => {
    setD((cur) => {
      const n = clone(cur!);
      fn(n);
      return n;
    });
    setDirty(true);
  };

  async function persist(silent: boolean, nextStep?: number) {
    if (ro) {
      setDirty(false);
      return true;
    }
    try {
      const cur = dRef.current!;
      const saved = await repo.saveVersion({ ...cur, wizard_step: Math.max(cur.wizard_step || 0, nextStep ?? step) });
      setD(clone(saved));
      setDirty(false);
      if (!silent) toast('پیش‌نویس ذخیره شد.', 'ok');
      return true;
    } catch (e) {
      toast(errMsg(e), 'bad');
      if ((e as { conflict?: boolean }).conflict) {
        const cur = L.d.versions.find((x) => x.id === vid);
        if (cur) setD(clone(cur));
        setDirty(false);
      }
      return false;
    }
  }

  async function go(i: number) {
    if (dirty || (!ro && i > (d!.wizard_step || 0))) {
      if (!(await persist(true, i))) return;
    }
    setStep(i);
    window.scrollTo(0, 0);
  }

  async function close() {
    if (dirty && !(await persist(true))) return;
    onClose();
  }

  const reachedDone = (i: number) => i < (d.wizard_step ?? 0) || (ro && i !== step);
  const body = [
    <StepPeriod key="0" d={d} p={p} ro={ro} upd={upd} L={L} />,
    <StepRevenue key="1" d={d} p={p} ro={ro} upd={upd} L={L} />,
    <StepExpense key="2" d={d} p={p} ro={ro} upd={upd} L={L} />,
    <StepPayroll key="3" d={d} p={p} ro={ro} upd={upd} L={L} />,
    <StepInvest key="4" d={d} p={p} ro={ro} upd={upd} L={L} />,
    <StepReview
      key="5"
      d={d}
      p={p}
      ro={ro}
      L={L}
      live={live}
      onCompare={(a, b) => setCmp({ a, b })}
      onSubmit={async () => {
        try {
          await repo.submit({ ...d });
          setDirty(false);
          toast('برای تأیید مدیر ارسال شد.', 'ok');
          onClose();
        } catch (e) {
          toast(errMsg(e), 'bad');
        }
      }}
      onDecided={onClose}
    />,
  ][step];

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            {p.title} · {vLabel(d)} · {V_STATUS[L.vStatus(live)]}
          </>
        }
        title={`مرحله ${fa(step + 1)} از ${fa(6)}: ${WZ_STEPS[step]}`}
        description={
          ro
            ? 'این نسخه فقط‌خواندنی است.'
            : 'با «ذخیره موقت» می‌توانید هر وقت خواستید ادامه دهید. رفتن به مرحله دیگر هم خودکار ذخیره می‌کند.'
        }
        actions={
          <Button onClick={() => void close()}>
            <Icon.close size={16} />
            بستن ویزارد
          </Button>
        }
      />

      {/* مراحل */}
      <ol className="no-print mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6" role="list">
        {WZ_STEPS.map((s, i) => {
          const on = i === step;
          const done = reachedDone(i);
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => void go(i)}
                aria-current={on ? 'step' : undefined}
                className={cx(
                  'flex w-full flex-col gap-1.5 rounded-xl border px-3 py-2 text-start text-xs transition',
                  on ? 'border-brand-300 bg-white font-bold text-navy-900 shadow-card' : 'border-transparent text-slate-500 hover:bg-white/70',
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cx(
                      'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold',
                      on ? 'bg-brand-600 text-white' : done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600',
                    )}
                  >
                    {done && !on ? <Icon.check size={13} /> : fa(i + 1)}
                  </span>
                  <span className="truncate">{s}</span>
                </span>
                <span className={cx('h-1 rounded-full', on ? 'bg-brand-500' : done ? 'bg-emerald-600' : 'bg-slate-200')} />
              </button>
            </li>
          );
        })}
      </ol>

      {ai.on && !ro && (
        <ChatPanel
          d={d}
          p={p}
          L={L}
          open={aiOpen}
          setOpen={setAiOpen}
          upd={upd}
          onBuilt={async (next) => {
            setD(next);
            setDirty(true);
            audit('ai', 'budget', next.id, 'ساخت پیش‌نویس بودجه با هوش مصنوعی');
            try {
              const saved = await repo.saveVersion({ ...next, wizard_step: Math.max(next.wizard_step || 0, 1) });
              setD(clone(saved));
              setDirty(false);
              toast('پیش‌نویس ساخته شد. ارقام را مرحله‌به‌مرحله بازبینی کنید.', 'ok');
            } catch (e) {
              toast(errMsg(e), 'bad');
            }
            setAiOpen(false);
            setStep(1);
            window.scrollTo(0, 0);
          }}
          onPersist={() => persist(true)}
        />
      )}
      {d.ai_built_at && step > 0 && step < 5 && !ro && (
        <Alert tone="info" className="mb-4">
          <AiChip /> ارقام این نسخه را دستیار پیشنهاد داده است. هر ردیف را بازبینی کنید؛ توضیح دستیار زیر نام ردیف آمده.
        </Alert>
      )}

      <Card className="mb-24">{body}</Card>

      {/* نوار پایین */}
      <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur lg:pr-64">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex gap-2">
            {step > 0 && <Button onClick={() => void go(step - 1)}>→ مرحله قبل</Button>}
            {step < 5 && (
              <Button variant="navy" onClick={() => void go(step + 1)}>
                مرحله بعد ←
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {dirty ? 'تغییرات ذخیره نشده' : d.updated_at ? `آخرین ذخیره: ${jFa(d.updated_at)}` : ''}
            </span>
            {!ro && <Button onClick={() => void persist(false)}>ذخیره موقت</Button>}
          </div>
        </div>
      </div>

      {cmp && (
        <Modal title="مقایسه نسخه‌ها" size="2xl" onClose={() => setCmp(null)}>
          <CompareTable L={L} a={L.d.versions.find((x) => x.id === cmp.a)} b={L.d.versions.find((x) => x.id === cmp.b)} />
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

interface StepProps {
  d: Version;
  p: Period;
  ro: boolean;
  L: Ledger;
  upd: (fn: (x: Version) => void) => void;
}

const AiNote = ({ d, k }: { d: Version; k: string }) =>
  d.ai_notes?.[k] ? <div className="mt-1 text-xs leading-relaxed text-brand-700">{d.ai_notes[k]}</div> : null;

function MonthHeads({ p }: { p: Period }) {
  return (
    <>
      {monthsOf(p).map((m) => (
        <th key={m.i} className="n">
          {MONTHS[m.jm - 1]}
        </th>
      ))}
    </>
  );
}

function FillBtn({ ro, onClick }: { ro: boolean; onClick: () => void }) {
  if (ro) return null;
  return (
    <Button size="sm" variant="ghost" title="رقم ماه اول را در همه ماه‌ها تکرار کن" onClick={onClick}>
      تکرار
    </Button>
  );
}

function DelBtn({ ro, onClick, label = 'حذف ردیف' }: { ro: boolean; onClick: () => void; label?: string }) {
  if (ro) return null;
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700">
      <Icon.trash size={16} />
    </button>
  );
}

function StepTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <h2 className="font-bold text-navy-900">{title}</h2>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </div>
  );
}

function StepPeriod({ d, p, ro, upd, L }: StepProps) {
  const sc = L.d.settings.scen;
  return (
    <div className="space-y-5">
      <StepTitle title="دوره و مشخصات نسخه" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="دوره">
          <Input value={p.title} readOnly />
        </Field>
        <Field label="بازه">
          <Input value={periodRange(p)} readOnly />
        </Field>
        <Field label="نوع دوره">
          <Input value={PERIOD_TYPE[p.type] || p.type} readOnly />
        </Field>
        <Field label="عنوان نسخه" htmlFor="wz-title" className="sm:col-span-3">
          <Input id="wz-title" maxLength={80} value={d.title || ''} readOnly={ro} onChange={(e) => upd((x) => void (x.title = e.target.value))} />
        </Field>
        {d.number > 0 && (
          <Field label="دلیل اصلاحیه" required htmlFor="wz-reason" className="sm:col-span-3">
            <Textarea id="wz-reason" rows={3} maxLength={400} value={d.reason || ''} readOnly={ro} onChange={(e) => upd((x) => void (x.reason = e.target.value))} />
          </Field>
        )}
      </div>
      {!ro && d.number === 0 && (
        <p className="text-xs text-slate-500">برای تغییر بازه دوره، دوره جدید بسازید؛ دوره پس از ساخت ثابت می‌ماند تا ارقام ماه‌ها جابه‌جا نشوند.</p>
      )}
      <details className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">درصدهای سناریو</summary>
        <p className="mt-2 leading-relaxed text-slate-500">
          محافظه‌کارانه: درآمد {pctFa(sc.cons.rev, true)}، هزینه {pctFa(sc.cons.exp, true)} · خوش‌بینانه: درآمد {pctFa(sc.opt.rev, true)}، هزینه{' '}
          {pctFa(sc.opt.exp, true)}. شما فقط عدد Base (محتمل) را وارد می‌کنید؛ این درصدها در تنظیمات قابل تغییر است.
        </p>
      </details>
      {d.decision_note && d.status !== 'approved' && <Alert tone="warn">یادداشت مدیر: {d.decision_note}</Alert>}
    </div>
  );
}

function StepRevenue({ d, p, ro, upd, L }: StepProps) {
  const ms = monthsOf(p);
  const missing = L.revCenters().filter((c) => !d.revenue.find((r) => r.center === c.id));
  return (
    <>
      <StepTitle title="بودجه درآمد به تفکیک مرکز درآمد" hint="مبالغ به تومان · فروش خودرو فقط کمیسیون" />
      <TableWrap>
        <table className="ledger">
          <thead>
            <tr>
              <th>مرکز درآمد</th>
              <MonthHeads p={p} />
              <th className="n">جمع دوره</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d.revenue.map((r, i) => (
              <tr key={r.center}>
                <td className="min-w-40 font-semibold text-navy-900">
                  {L.cName(r.center)}
                  <AiNote d={d} k={`revenue:${r.center}`} />
                </td>
                {ms.map((m) => (
                  <td key={m.i}>
                    <AmountInput
                      aria-label={`${L.cName(r.center)} ${MONTHS[m.jm - 1]}`}
                      value={r.months[m.i]}
                      onValue={ro ? undefined : (v) => upd((x) => void (x.revenue[i]!.months[m.i] = v || '0'))}
                    />
                  </td>
                ))}
                <td className="n font-bold text-navy-900">{nf(sumB(r.months))}</td>
                <td>
                  <FillBtn ro={ro} onClick={() => upd((x) => void (x.revenue[i]!.months = x.revenue[i]!.months.map(() => x.revenue[i]!.months[0]!)))} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>جمع</td>
              {ms.map((m) => (
                <td key={m.i} className="n">
                  {nf(sumB(d.revenue.map((r) => r.months[m.i])))}
                </td>
              ))}
              <td className="n">{nf(sumB(d.revenue.flatMap((r) => r.months)))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </TableWrap>
      {!ro && missing.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {missing.map((c) => (
            <Button key={c.id} size="sm" onClick={() => upd((x) => void x.revenue.push({ center: c.id, months: Array(p.months).fill('0') }))}>
              <Icon.plus size={14} />
              {c.name}
            </Button>
          ))}
        </div>
      )}
    </>
  );
}

function StepExpense({ d, p, ro, upd, L }: StepProps) {
  const ms = monthsOf(p);
  const heads = L.d.heads.filter((h) => !h.payroll);
  const groups: ['fixed' | 'variable', string][] = [
    ['fixed', 'هزینه‌های ثابت'],
    ['variable', 'هزینه‌های متغیر'],
  ];
  return (
    <>
      <StepTitle title="بودجه هزینه به تفکیک سرفصل و مرکز هزینه" hint="حقوق و مزایا در مرحله بعد · قبض مشترک را به چند ردیف با مراکز مختلف تقسیم کنید" />
      <TableWrap>
        <table className="ledger">
          <thead>
            <tr>
              <th>سرفصل</th>
              <th>مرکز هزینه</th>
              <MonthHeads p={p} />
              <th className="n">جمع دوره</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.map(([k, label]) => {
              const rs = d.expense.map((r, i) => [r, i] as const).filter(([r]) => (L.headById(r.head)?.kind || 'fixed') === k);
              return [
                <tr key={k} className="group">
                  <td colSpan={ms.length + 4}>
                    {label} · {nf(sumB(rs.flatMap(([r]) => r.months)))} تومان
                  </td>
                </tr>,
                ...rs.map(([r, i]) => (
                  <tr key={`${k}-${i}`}>
                    <td className="min-w-40">
                      <Select compact aria-label="سرفصل" disabled={ro} value={r.head} onChange={(e) => upd((x) => void (x.expense[i]!.head = e.target.value))}>
                        {heads
                          .filter((h) => h.active || h.id === r.head)
                          .map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.name}
                            </option>
                          ))}
                      </Select>
                      <AiNote d={d} k={`expense:${r.head}|${r.center}`} />
                    </td>
                    <td className="min-w-36">
                      <Select compact aria-label="مرکز هزینه" disabled={ro} value={r.center} onChange={(e) => upd((x) => void (x.expense[i]!.center = e.target.value))}>
                        {L.costCenters(true)
                          .filter((c) => c.active || c.id === r.center)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </Select>
                    </td>
                    {ms.map((m) => (
                      <td key={m.i}>
                        <AmountInput
                          aria-label={`${L.hName(r.head)} ${MONTHS[m.jm - 1]}`}
                          value={r.months[m.i]}
                          onValue={ro ? undefined : (v) => upd((x) => void (x.expense[i]!.months[m.i] = v || '0'))}
                        />
                      </td>
                    ))}
                    <td className="n font-bold text-navy-900">{nf(sumB(r.months))}</td>
                    <td className="whitespace-nowrap">
                      <FillBtn ro={ro} onClick={() => upd((x) => void (x.expense[i]!.months = x.expense[i]!.months.map(() => x.expense[i]!.months[0]!)))} />
                      <DelBtn ro={ro} onClick={() => upd((x) => void x.expense.splice(i, 1))} />
                    </td>
                  </tr>
                )),
              ];
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>جمع</td>
              {ms.map((m) => (
                <td key={m.i} className="n">
                  {nf(sumB(d.expense.map((r) => r.months[m.i])))}
                </td>
              ))}
              <td className="n">{nf(sumB(d.expense.flatMap((r) => r.months)))}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </TableWrap>
      {!ro && (
        <div className="mt-3">
          <Button
            size="sm"
            onClick={() =>
              upd((x) => {
                const h = L.d.heads.find((y) => y.active && !y.payroll);
                x.expense.push({ head: h?.id || '', center: h?.default_center || L.costCenters()[0]?.id || '', months: Array(p.months).fill('0') });
              })
            }
          >
            <Icon.plus size={14} />
            افزودن ردیف هزینه
          </Button>
        </div>
      )}
    </>
  );
}

function StepPayroll({ d, p, ro, upd, L }: StepProps) {
  const n = BigInt(p.months);
  return (
    <>
      <StepTitle title="بودجه منابع انسانی به تفکیک واحد" hint="مبالغ ماهانه کل واحد (تومان)؛ برای همه ماه‌های دوره یکسان در نظر گرفته می‌شود" />
      <TableWrap>
        <table className="ledger">
          <thead>
            <tr>
              <th>واحد</th>
              <th className="n">تعداد پرسنل</th>
              {PAY_FIELDS.map(([, l]) => (
                <th key={l} className="n">
                  {l}
                </th>
              ))}
              <th className="n">جمع ماهانه</th>
              <th className="n">جمع دوره</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {d.payroll.map((r, i) => (
              <tr key={i}>
                <td className="min-w-36">
                  <Select compact aria-label="واحد" disabled={ro} value={r.center} onChange={(e) => upd((x) => void (x.payroll[i]!.center = e.target.value))}>
                    {L.costCenters(true)
                      .filter((c) => c.active || c.id === r.center)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </Select>
                  <AiNote d={d} k={`payroll:${r.center}`} />
                </td>
                <td>
                  <AmountInput
                    className="min-w-16"
                    aria-label="تعداد پرسنل"
                    value={r.headcount}
                    onValue={ro ? undefined : (v) => upd((x) => void (x.payroll[i]!.headcount = v || '0'))}
                  />
                </td>
                {PAY_FIELDS.map(([k, l]) => (
                  <td key={k}>
                    <AmountInput aria-label={l} value={r[k]} onValue={ro ? undefined : (v) => upd((x) => void (x.payroll[i]![k] = v || '0'))} />
                  </td>
                ))}
                <td className="n font-bold text-navy-900">{nf(payMonthly(r))}</td>
                <td className="n">{nf(payMonthly(r) * n)}</td>
                <td>
                  <DelBtn ro={ro} onClick={() => upd((x) => void x.payroll.splice(i, 1))} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>جمع</td>
              <td className="n">{nf(sumB(d.payroll.map((r) => r.headcount)))}</td>
              {PAY_FIELDS.map(([k]) => (
                <td key={k} className="n">
                  {nf(sumB(d.payroll.map((r) => r[k])))}
                </td>
              ))}
              <td className="n">{nf(sumB(d.payroll.map(payMonthly)))}</td>
              <td className="n">{nf(sumB(d.payroll.map(payMonthly)) * n)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </TableWrap>
      {!ro && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              upd((x) =>
                void x.payroll.push({ center: L.costCenters()[0]?.id || '', headcount: '0', base: '0', overtime: '0', benefits: '0', bonus: '0', insurance: '0', eidi: '0', other: '0' }),
              )
            }
          >
            <Icon.plus size={14} />
            افزودن واحد
          </Button>
          <Button size="sm" variant="ghost" onClick={() => upd((x) => x.payroll.forEach((r) => (r.insurance = String((B(r.base) * 23n) / 100n))))}>
            محاسبه بیمه سهم کارفرما (۲۳٪ حقوق پایه)
          </Button>
        </div>
      )}
    </>
  );
}

function StepInvest({ d, p, ro, upd, L }: StepProps) {
  const ms = monthsOf(p);
  return (
    <>
      <StepTitle title="پروژه‌های سرمایه‌گذاری" hint={`جمع: ${tm(sumB(d.investments.map((x) => x.amount)))}`} />
      {d.investments.length ? (
        <div className="space-y-4">
          {d.investments.map((x, i) => {
            const set = <K extends keyof (typeof d.investments)[number]>(k: K, v: (typeof d.investments)[number][K]) =>
              upd((y) => void (y.investments[i]![k] = v));
            return (
              <div key={x.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="عنوان" htmlFor={`inv-${i}-t`} className="sm:col-span-2">
                    <Input id={`inv-${i}-t`} maxLength={80} value={x.title} readOnly={ro} onChange={(e) => set('title', e.target.value)} />
                  </Field>
                  <Field label="واحد">
                    <Select disabled={ro} value={x.center} onChange={(e) => set('center', e.target.value)}>
                      {L.costCenters(true).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="نوع" htmlFor={`inv-${i}-ty`}>
                    <Input id={`inv-${i}-ty`} maxLength={40} placeholder="تجهیزات، ساختمان، نرم‌افزار…" value={x.type} readOnly={ro} onChange={(e) => set('type', e.target.value)} />
                  </Field>
                  <Field label="مبلغ (تومان)">
                    <AmountInput className="min-h-11 rounded-xl" value={x.amount} onValue={ro ? undefined : (v) => set('amount', v || '0')} />
                  </Field>
                  <Field label="ماه اجرا">
                    <Select disabled={ro} value={x.month} onChange={(e) => set('month', +e.target.value)}>
                      {ms.map((m) => (
                        <option key={m.i} value={m.i}>
                          {mName(m.jy, m.jm)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="اولویت">
                    <Select disabled={ro} value={x.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
                      {Object.entries(PRIORITY).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="توضیح" htmlFor={`inv-${i}-d`} className="sm:col-span-2 lg:col-span-4">
                    <Input id={`inv-${i}-d`} maxLength={300} value={x.description || ''} readOnly={ro} onChange={(e) => set('description', e.target.value)} />
                  </Field>
                </div>
                {!ro && (
                  <div className="mt-3">
                    <Button size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50" onClick={() => upd((y) => void y.investments.splice(i, 1))}>
                      <Icon.trash size={14} />
                      حذف پروژه
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="پروژه‌ای نیست" icon={<Icon.target size={20} />}>
          پروژه سرمایه‌گذاری‌ای برای این دوره تعریف نشده.
        </EmptyState>
      )}
      {!ro && (
        <div className="mt-3">
          <Button
            size="sm"
            onClick={() =>
              upd((y) => void y.investments.push({ id: uid('i_'), title: '', center: L.costCenters()[0]?.id || '', type: '', amount: '0', month: 0, priority: 'mid', description: '' }))
            }
          >
            <Icon.plus size={14} />
            افزودن پروژه
          </Button>
        </div>
      )}
    </>
  );
}

function StepReview({
  d,
  p,
  ro,
  L,
  live,
  onCompare,
  onSubmit,
  onDecided,
}: Omit<StepProps, 'upd'> & {
  live: Version;
  onCompare: (a: string, b: string) => void;
  onSubmit: () => Promise<void>;
  onDecided: () => void;
}) {
  const { can } = useStore();
  const [busy, setBusy] = useState(false);
  const t = L.versionTotals(d);
  const ms = monthsOf(p);
  const errs = L.validateVersion(d);
  const sc = L.scenarios(t);
  const zeroRows = d.expense.filter((r) => sumB(r.months) === 0n).length + d.revenue.filter((r) => sumB(r.months) === 0n).length;
  const base = d.base_version_id ? L.d.versions.find((x) => x.id === d.base_version_id) : null;
  const line = (label: string, arr: bigint[], tot: bigint) => (
    <tr>
      <td>{label}</td>
      {ms.map((m) => (
        <td key={m.i} className="n">
          {compact(arr[m.i])}
        </td>
      ))}
      <td className="n font-bold text-navy-900">{nf(tot)}</td>
    </tr>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-navy-900">بررسی نهایی</h2>
        <VersionBadge v={live} />
      </div>
      <TableWrap>
        <table className="ledger">
          <thead>
            <tr>
              <th>شرح</th>
              <MonthHeads p={p} />
              <th className="n">جمع دوره</th>
            </tr>
          </thead>
          <tbody>
            {line('درآمد', t.rev, t.R)}
            {line('هزینه‌ها', t.exp, t.E)}
            {line('حقوق و مزایا', t.pay, t.P)}
          </tbody>
          <tfoot>
            <tr>
              <td>نتیجه مالی</td>
              {ms.map((m) => (
                <td key={m.i} className="n">
                  {compact(t.rev[m.i]! - t.exp[m.i]! - t.pay[m.i]!)}
                </td>
              ))}
              <td className="n">{nf(t.net)}</td>
            </tr>
          </tfoot>
        </table>
      </TableWrap>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ['سناریو محافظه‌کارانه', sc.cons.net],
            ['سناریو محتمل', sc.likely.net],
            ['سناریو خوش‌بینانه', sc.opt.net],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">{l}</div>
            <div className={`mt-0.5 text-xl font-black ${v < 0n ? 'text-rose-700' : 'text-navy-900'}`}>{compact(v)}</div>
            <div className="text-xs text-slate-500">نتیجه</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-600">
        سرمایه‌گذاری مصوب پیشنهادی: <b className="text-navy-900">{tm(t.inv)}</b> در {fa(d.investments.length)} پروژه · سهم حقوق از کل هزینه: {pctFa(ratio(t.P, t.E + t.P))}
      </p>
      {base && (
        <Button size="sm" variant="ghost" onClick={() => onCompare(base.id, d.id)}>
          مقایسه با {vLabel(base)} ←
        </Button>
      )}
      {errs.length ? (
        <Alert tone="warn" title="پیش از ارسال اصلاح کنید:">
          <ul className="list-inside list-disc">
            {errs.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <Alert tone="ok">نسخه کامل است و می‌تواند برای تأیید ارسال شود.</Alert>
      )}
      {(d.ai_assumptions?.length || d.ai_questions?.length) && (
        <div className="ai-surface p-4 text-sm">
          <h3 className="flex items-center gap-2 font-bold text-navy-900">
            <AiChip /> فرض‌ها و پرسش‌های باز دستیار
          </h3>
          {!!d.ai_assumptions?.length && (
            <>
              <p className="mt-2 font-medium">فرض‌ها:</p>
              <ul className="mt-1 list-inside list-disc text-slate-600">
                {d.ai_assumptions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
          {!!d.ai_questions?.length && (
            <>
              <p className="mt-2 font-medium">پیش از ارسال بررسی کنید:</p>
              <ul className="mt-1 list-inside list-disc text-slate-600">
                {d.ai_questions.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {zeroRows > 0 && <p className="text-xs text-slate-500">{fa(zeroRows)} ردیف درآمد/هزینه جمع صفر دارد. اگر عمدی نیست، بازبینی کنید.</p>}
      {ro ? (
        live.status === 'submitted' && can('approve') ? <ApprovalPanel v={live} onDone={onDecided} hideReview /> : null
      ) : (
        <Button
          variant="primary"
          size="lg"
          disabled={!!errs.length || busy}
          onClick={async () => {
            setBusy(true);
            await onSubmit();
            setBusy(false);
          }}
        >
          <Icon.send size={16} />
          ارسال برای تأیید مدیر
        </Button>
      )}
    </div>
  );
}

/* --------------------------- دستیار گفت‌وگو --------------------------- */

function ChatPanel({
  d,
  p,
  L,
  open,
  setOpen,
  upd,
  onBuilt,
  onPersist,
}: {
  d: Version;
  p: Period;
  L: Ledger;
  open: boolean;
  setOpen: (v: boolean) => void;
  upd: (fn: (x: Version) => void) => void;
  onBuilt: (next: Version) => Promise<void>;
  onPersist: () => Promise<boolean>;
}) {
  const chat = useAiTask('budget_chat');
  const build = useAiTask('budget_build');
  const [text, setText] = useState('');
  const [askClear, setAskClear] = useState(false);
  const log = (d.ai_chat || []).filter((t) => t.content && t.content.trim());
  const has = log.some((t) => t.role === 'user');

  const rules = () => {
    const ref = aiReference(L, p);
    return `تو «دستیار بودجه‌ریزی» در سامانه بودجه‌یار هستی و با حسابدار یا مدیری صحبت می‌کنی که ممکن است بودجه‌ریزی بلد نباشد.
هدف: با گفت‌وگوی کوتاه، اطلاعات لازم برای بودجه دوره «${p.title}» (${monthsOf(p).length} ماه) را جمع کنی: درآمد هر مرکز درآمد در ماه، فصلی بودن کار، هزینه‌های ثابت و متغیر، تعداد پرسنل و حقوق هر واحد، و پروژه‌های سرمایه‌گذاری.
قواعد گفت‌وگو:
- هر بار حداکثر دو سؤال ساده بپرس، بدون اصطلاح تخصصی، و کوتاه بنویس (حداکثر ۶ خط).
- اگر کاربر عدد دقیق ندارد، یک تخمین معقول پیشنهاد بده (اگر داده دوره قبل هست از آن کمک بگیر) و بپرس قبول دارد یا نه.
- چیزی را که کاربر گفته دوباره نپرس.
- وقتی اطلاعات برای یک پیش‌نویس معقول کافی شد، خلاصه فرض‌ها را در چند خط بگو و بگو دکمه «ساخت پیش‌نویس بودجه» را بزند. لازم نیست همه‌چیز کامل باشد؛ کاربر بعداً جدول‌ها را اصلاح می‌کند.
- خودت عددی را در سامانه ثبت نمی‌کنی؛ فقط گفت‌وگو می‌کنی.
${AI_RULE_FA}

ساختار سازمان (JSON):
${JSON.stringify(aiStructure(L, p))}
${ref ? `\nداده دوره قبل برای مرجع (JSON):\n${JSON.stringify(ref)}` : '\nداده دوره قبلی در سامانه نیست.'}
${d.number > 0 ? `\nاین یک اصلاحیه است. دلیل: ${d.reason || '—'}` : ''}`;
  };

  async function send() {
    const msg = text.trim().slice(0, 3000);
    if (!msg || chat.busy) return;
    setText('');
    const turns = [...log, { role: 'user' as const, content: msg }];
    upd((x) => void (x.ai_chat = turns));
    const res = await chat.run({ system: rules(), messages: turns.slice(-16).filter((t, i) => i > 0 || t.role === 'user'), effort: 'low' });
    if (res?.text) {
      upd((x) => void (x.ai_chat = [...turns, { role: 'assistant' as const, content: res.text!.slice(0, 4000) }].slice(-30)));
      setTimeout(() => void onPersist(), 50);
    }
  }

  async function buildDraft() {
    const n = p.months;
    const ref = aiReference(L, p);
    const convo = log.map((t) => (t.role === 'user' ? 'کاربر: ' : 'دستیار: ') + t.content).join('\n');
    const prompt = `بر اساس گفت‌وگوی زیر، پیش‌نویس بودجه دوره «${p.title}» را بساز. فقط و فقط یک شیء JSON برگردان.

قواعد:
- همه مبالغ عدد صحیح به تومان (نه ریال) و نامنفی‌اند. مبلغ هر ماه را جدا بده.
- فقط از شناسه‌های (id) داده‌شده در ساختار استفاده کن.
- آرایه months دقیقاً ${n} عضو دارد، به ترتیب index ماه‌ها.
- برای هر مرکز درآمد که کاربر درباره‌اش چیزی گفته یا قابل تخمین است یک ردیف revenue بده.
- هزینه‌ها: ترکیب head و center؛ برای سرفصل‌های قبض (paid_by_utility_bill) هم بودجه بده. حقوق و مزایا را در expense نیاور.
- payroll: مبالغ ماهانه کل واحد (نه هر نفر). اگر بیمه سهم کارفرما را نگفته، ۲۳٪ حقوق پایه بگذار؛ اگر عیدی و سنوات را نگفته، حدود یک‌ششم حقوق پایه در ماه.
- investments فقط اگر کاربر پروژه‌ای گفته. month_index شماره ماه اجرا (از صفر).
- note: توضیح خیلی کوتاه فارسی که عدد از کجا آمده (مثلاً «۴۰ خودرو × ۲۴ میلیون کمیسیون»).
- assumptions: فرض‌های مهمی که خودت گذاشتی. questions: چیزهایی که هنوز معلوم نیست و کاربر باید بررسی کند.

شکل خروجی:
{"revenue":[{"center":"rc1","months":[0],"note":""}],"expense":[{"head":"h_parts","center":"cc3","months":[0],"note":""}],"payroll":[{"center":"cc1","headcount":0,"base":0,"overtime":0,"benefits":0,"bonus":0,"insurance":0,"eidi":0,"other":0,"note":""}],"investments":[{"title":"","center":"cc1","type":"","amount":0,"month_index":0,"priority":"high|mid|low","description":""}],"assumptions":[""],"questions":[""]}

ساختار سازمان:
${JSON.stringify(aiStructure(L, p))}
${ref ? `داده دوره قبل (میانگین ماهانه):\n${JSON.stringify(ref)}` : ''}

گفت‌وگو:
${convo}`;
    const res = await build.run({ messages: [{ role: 'user', content: prompt }], json: true });
    if (!res) return;
    const r = applyAiDraft(L, clone(d), res.json, p);
    if (!r.ok) return build.setError(r.error);
    await onBuilt(r.d);
  }

  return (
    <AiCard
      title="دستیار بودجه‌ریزی"
      subtitle="کسب‌وکار را به زبان ساده توضیح دهید؛ دستیار جدول‌ها را پیشنهاد می‌دهد و شما بازبینی می‌کنید."
      action={
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
          {open ? 'بستن' : 'باز کردن'}
        </Button>
      }
    >
      {open && (
        <>
          <ChatLog
            turns={log}
            live={chat.busy}
            empty="سلام. برای شروع بگویید ماهانه حدوداً چند خودرو فروش می‌رود، تعمیرگاه چقدر کار دارد و چند نفر پرسنل دارید. هر عددی را که نمی‌دانید بگویید «نمی‌دانم»؛ با هم تخمین می‌زنیم."
          />
          <AiState busy={chat.busy} error={chat.error} label="دستیار در حال فکر کردن است…" onStop={chat.stop} />
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Textarea
              rows={2}
              className="min-w-64 flex-1"
              placeholder="مثلاً: ماهی حدود ۴۰ خودرو می‌فروشیم و کمیسیون هر کدام حدود ۲۴ میلیون تومان است…"
              value={text}
              disabled={chat.busy}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button variant="navy" disabled={chat.busy || build.busy || !text.trim()} onClick={() => void send()}>
              <Icon.send size={16} />
              ارسال
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AiButton pending={build.busy} disabled={!has || chat.busy || build.busy} onClick={() => void buildDraft()}>
              ساخت پیش‌نویس بودجه از این گفت‌وگو
            </AiButton>
            {log.length > 0 &&
              (askClear ? (
                <span className="flex items-center gap-2 text-xs">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      upd((x) => void (x.ai_chat = []));
                      setAskClear(false);
                    }}
                  >
                    پاک شود
                  </Button>
                  <Button size="sm" onClick={() => setAskClear(false)}>
                    انصراف
                  </Button>
                </span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setAskClear(true)}>
                  پاک کردن گفت‌وگو
                </Button>
              ))}
          </div>
          <AiState busy={build.busy} error={build.error} label="در حال ساخت پیش‌نویس… این کار ممکن است تا یک دقیقه طول بکشد." onStop={build.stop} />
          <p className="mt-3 text-xs text-slate-500">با ساخت پیش‌نویس، ارقام فعلی این نسخه با پیشنهاد دستیار جایگزین می‌شود.</p>
        </>
      )}
    </AiCard>
  );
}

/** پاسخ JSON دستیار → ردیف‌های نسخه؛ هر شناسه‌ی ناشناخته کنار گذاشته می‌شود. */
function applyAiDraft(L: Ledger, d: Version, j: unknown, p: Period): { ok: true; d: Version } | { ok: false; error: string } {
  if (!j || typeof j !== 'object') return { ok: false, error: 'پاسخ هوش مصنوعی ساختار درستی نداشت.' };
  const J = j as Record<string, Record<string, unknown>[] | string[] | undefined>;
  const n = p.months;
  const notes: Record<string, string> = {};
  const months = (arr: unknown) => {
    const a = Array.isArray(arr) ? arr : [];
    return Array.from({ length: n }, (_, i) => toAmt(a[i] ?? a[a.length - 1] ?? 0));
  };
  const rows = (k: string) => ((J[k] as Record<string, unknown>[] | undefined) || []).filter((x) => x && typeof x === 'object');
  const rev: Version['revenue'] = [];
  for (const r of rows('revenue')) {
    const c = L.centerById(String(r.center));
    if (!c || c.kind !== 'revenue' || rev.find((x) => x.center === c.id)) continue;
    rev.push({ center: c.id, months: months(r.months) });
    if (r.note) notes[`revenue:${c.id}`] = String(r.note).slice(0, 160);
  }
  if (!rev.some((r) => r.months.some((x) => x !== '0')))
    return { ok: false, error: 'هوش مصنوعی هنوز رقم درآمدی پیشنهاد نداد. در گفت‌وگو درباره درآمدها بیشتر توضیح دهید.' };
  const exp: Version['expense'] = [];
  for (const r of rows('expense')) {
    const h = L.headById(String(r.head));
    const c = L.centerById(String(r.center));
    if (!h || h.payroll || !h.active || !c || c.kind !== 'cost') continue;
    const m = months(r.months);
    const ex = exp.find((x) => x.head === h.id && x.center === c.id);
    if (ex) ex.months = ex.months.map((v, i) => String(B(v) + B(m[i])));
    else exp.push({ head: h.id, center: c.id, months: m });
    if (r.note) notes[`expense:${h.id}|${c.id}`] = String(r.note).slice(0, 160);
  }
  const pay: Version['payroll'] = [];
  for (const r of rows('payroll')) {
    const c = L.centerById(String(r.center));
    if (!c || c.kind !== 'cost' || pay.find((x) => x.center === c.id)) continue;
    const row = { center: c.id, headcount: String(toInt(r.headcount)) } as Version['payroll'][number];
    PAY_FIELDS.forEach(([k]) => (row[k] = toAmt(r[k])));
    pay.push(row);
    if (r.note) notes[`payroll:${c.id}`] = String(r.note).slice(0, 160);
  }
  const inv: Version['investments'] = [];
  for (const x of rows('investments')) {
    if (String(x.title || '').trim().length < 2 || toInt(x.amount) <= 0) continue;
    inv.push({
      id: uid('i_'),
      title: String(x.title).slice(0, 80),
      center: L.centerById(String(x.center))?.kind === 'cost' ? String(x.center) : L.costCenters()[0]?.id || '',
      type: String(x.type || '').slice(0, 40),
      amount: toAmt(x.amount),
      month: Math.max(0, Math.min(n - 1, toInt(x.month_index))),
      priority: (['high', 'mid', 'low'].includes(String(x.priority)) ? x.priority : 'mid') as Priority,
      description: String(x.description || '').slice(0, 300),
    });
  }
  for (const c of L.revCenters()) if (!rev.find((r) => r.center === c.id)) rev.push({ center: c.id, months: Array(n).fill('0') });
  d.revenue = rev;
  if (exp.length) d.expense = exp;
  if (pay.length) d.payroll = pay;
  if (inv.length) d.investments = [...(d.investments || []).filter((x) => String(x.title || '').trim()), ...inv];
  d.ai_notes = notes;
  d.ai_assumptions = ((J.assumptions as unknown[]) || []).map(String).filter(Boolean).slice(0, 12);
  d.ai_questions = ((J.questions as unknown[]) || []).map(String).filter(Boolean).slice(0, 12);
  d.ai_built_at = nowIso();
  d.wizard_step = Math.max(d.wizard_step || 0, 1);
  return { ok: true, d };
}
