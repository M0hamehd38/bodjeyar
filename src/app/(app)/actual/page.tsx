'use client';

import { useEffect, useState } from 'react';
import { AiButton, AiCard, AiState } from '@/components/ai-assist';
import { AmountInput, NoBudget, NoPeriod, PeriodSelect, SampleBanner, SmallNumberInput, StatusBadge } from '@/components/budget';
import { Icon } from '@/components/icons';
import { Alert, Badge, Button, Card, cx, EmptyState, ErrorText, Field, Input, Modal, PageHeader, Segmented, Select, TableWrap, Tabs, Textarea } from '@/components/ui';
import { fileToImage, toInt, useAiTask } from '@/lib/ai';
import { errMsg } from '@/lib/backend';
import { B, clone, digits, fa, mName, MONTHS, nf, pctFa, ratio, toEn, jParse } from '@/lib/format';
import { BILL_TYPES, favorable, monthsOf, TYPE_LABEL, vLabel, type Ledger } from '@/lib/ledger';
import { usePeriod, useStore } from '@/lib/store';
import type { Bill, BillType, Line, LineType, Month, Period, Version } from '@/lib/types';

type Tab = LineType | 'bills';

export default function ActualPage() {
  const { period: p, ledger: L, can, repo, toast } = usePeriod();
  const [mi, setMi] = useState(0);
  const [tab, setTab] = useState<Tab>('revenue');

  useEffect(() => setMi(0), [p?.id]);

  const head = (desc?: string) => <PageHeader eyebrow="عملکرد واقعی" title="ثبت عملکرد ماهانه" description={desc} actions={<PeriodSelect />} />;
  if (!p)
    return (
      <>
        {head()}
        <NoPeriod />
      </>
    );
  const hist = !L.activeV(p.id) && L.isHistory(p);
  const v = L.activeV(p.id) ?? (hist ? L.entryVersion(p) : null);
  if (!v)
    return (
      <>
        {head(p.title)}
        <NoBudget p={p} />
      </>
    );

  const ms = monthsOf(p);
  const m = ms[Math.min(mi, ms.length - 1)]!;
  const a = L.d.actuals[m.k];
  const closed = !!a?.closed;
  const ro = !can('actual') || closed;

  return (
    <>
      {head(hist ? `${p.title} · دوره‌ی مرجع (بدون بودجه)` : `${p.title} · مبنا: ${vLabel(v)}`)}
      <SampleBanner />
      {hist && (
        <Alert tone="info" className="mb-4">
          این دوره بودجه ندارد؛ ارقام <b>عملکرد واقعی</b> از فایل اطلاعات اولیه وارد شده‌اند و ماه‌ها بسته‌اند. ریز هر عدد در بخش «ریز اسناد» هست.
        </Alert>
      )}
      <Card>
        <Tabs
          label="ماه"
          value={m.i}
          onChange={setMi}
          items={ms.map((x) => ({
            value: x.i,
            label: (
              <>
                {MONTHS[x.jm - 1]}
                {L.hasActual(x.k) &&
                  (L.d.actuals[x.k]?.closed ? (
                    <Icon.lock size={13} className="text-slate-400" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  ))}
              </>
            ),
          }))}
        />
        <div className="my-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <b className="text-navy-900">{mName(m.jy, m.jm)}</b>
            {closed ? (
              <Badge tone="info">
                <Icon.lock size={12} />
                ماه بسته‌شده
              </Badge>
            ) : a?.saved_at ? (
              <Badge tone="ok">ثبت‌شده · {a.updated_by}</Badge>
            ) : (
              <Badge tone="attention">ثبت نشده</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can('actual') && !closed && a?.saved_at && (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await repo.setClosed(m.k, true);
                    toast('ماه بسته شد.', 'ok');
                  } catch (e) {
                    toast(errMsg(e), 'bad');
                  }
                }}
              >
                <Icon.lock size={14} />
                بستن ماه
              </Button>
            )}
            {closed && can('reopen') && (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    await repo.setClosed(m.k, false);
                    toast('ماه باز شد.');
                  } catch (e) {
                    toast(errMsg(e), 'bad');
                  }
                }}
              >
                بازکردن ماه
              </Button>
            )}
            {closed && !can('reopen') && <span className="text-xs text-slate-500">بازکردن ماه با مدیر است.</span>}
          </div>
        </div>

        {!ro && <DocReader key={m.k} L={L} p={p} m={m} v={v} />}

        <div className="mb-4">
          <Segmented
            label="بخش"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'revenue', label: 'درآمدها' },
              { value: 'expense', label: 'هزینه‌ها' },
              { value: 'payroll', label: 'حقوق و مزایا' },
              { value: 'bills', label: 'قبوض' },
            ]}
          />
        </div>
        {tab === 'bills' ? <BillsPanel key={m.k} L={L} p={p} m={m} ro={ro} /> : <ActualTable key={`${m.k}-${tab}-${a?.rev ?? 0}`} L={L} p={p} v={v} m={m} type={tab} ro={ro} noBudget={hist} />}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */

function ActualTable({ L, p, v, m, type, ro, noBudget }: { L: Ledger; p: Period; v: Version; m: Month; type: LineType; ro: boolean; noBudget?: boolean }) {
  const { repo, toast } = useStore();
  const saved = L.d.actuals[m.k]?.[type] || {};
  const [vals, setVals] = useState<Record<string, string>>(() => ({ ...saved }));
  const [extra, setExtra] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [ux, setUx] = useState(() => ({
    head: L.d.heads.find((h) => !h.payroll && !h.utility && h.active)?.id || '',
    center: L.costCenters()[0]?.id || '',
  }));

  const lines = L.linesOf(v).filter((l) => l.type === type);
  const extraKeys = [...new Set([...Object.keys(saved).filter((k) => B(saved[k]) !== 0n), ...extra])].filter((k) => !lines.find((l) => l.key === k));
  const all: Line[] = [
    ...lines,
    ...extraKeys.map((k) => ({
      type,
      key: k,
      head: type === 'expense' ? k.split('|')[0] : undefined,
      center: type === 'expense' ? k.split('|')[1]! : k,
      label: type === 'expense' ? L.hName(k.split('|')[0]) : L.cName(k),
      months: Array(p.months).fill(0n),
      unbudgeted: true,
    })),
  ];
  const has = L.hasActual(m.k);

  async function save() {
    setBusy(true);
    const clean: Record<string, string> = {};
    for (const [k, x] of Object.entries(vals)) if (x !== '' && x !== undefined) clean[k] = x;
    try {
      await repo.saveActual(m.k, { [type]: clean });
      toast(`${TYPE_LABEL[type]} ${MONTHS[m.jm - 1]} ذخیره شد.`, 'ok');
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
    setBusy(false);
  }

  return (
    <>
      <TableWrap>
        <table className="ledger">
          <thead>
            <tr>
              <th>{type === 'revenue' ? 'مرکز درآمد' : type === 'payroll' ? 'واحد' : 'سرفصل / مرکز'}</th>
              {!noBudget && <th className="n">بودجه ماه</th>}
              <th>عملکرد واقعی</th>
              {noBudget ? (
                <th className="n">ریز اسناد</th>
              ) : (
                <>
                  <th className="n">اختلاف</th>
                  <th className="n">درصد تحقق</th>
                  <th>وضعیت</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {all.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState title="ردیفی نیست">ردیفی در بودجه نیست.</EmptyState>
                </td>
              </tr>
            )}
            {all.map((l) => {
              const budget = l.months[m.i] || 0n;
              const util = type === 'expense' && !!L.headById(l.head)?.utility;
              const entered = vals[l.key];
              const val = util ? L.actualValue(type, l.key, m.k) : B(entered);
              const show = has || util || (entered !== undefined && entered !== '');
              const st = show ? L.statusOf(budget, val) : 'none';
              const diff = val - budget;
              return (
                <tr key={l.key} data-st={noBudget ? undefined : st}>
                  <td>
                    <b className="text-navy-900">{type === 'revenue' ? L.cName(l.center) : l.label}</b>
                    {type === 'revenue' && L.centerById(l.center)?.group && <div className="text-xs text-slate-500">{L.centerById(l.center)?.group}</div>}
                    {type !== 'revenue' && (
                      <div className="text-xs text-slate-500">
                        {L.cName(l.center)}
                        {l.unbudgeted && !noBudget && ' · بدون بودجه'}
                      </div>
                    )}
                  </td>
                  {!noBudget && <td className="n">{nf(budget)}</td>}
                  <td className="min-w-40">
                    {util ? (
                      <span className="flex items-center gap-2">
                        <span>{nf(val)}</span>
                        <Badge tone="neutral">از قبوض</Badge>
                      </span>
                    ) : (
                      <AmountInput
                        aria-label={`عملکرد ${l.label}`}
                        placeholder="۰"
                        value={entered}
                        onValue={ro ? undefined : (x) => setVals((cur) => ({ ...cur, [l.key]: x }))}
                      />
                    )}
                  </td>
                  {noBudget ? (
                    <td className="n text-xs text-slate-500">
                      {(() => {
                        const n = L.d.entries.filter((e) => e.month === m.k && e.type === type && e.key === l.key).length;
                        return n ? `${nf(n)} ردیف` : util ? 'قبوض' : '—';
                      })()}
                    </td>
                  ) : (
                    <>
                      <td className={cx('n', show && (favorable(type, diff) ? 'text-ok' : 'text-danger'))}>{show ? nf(diff) : '—'}</td>
                      <td className="n">{pctFa(ratio(val, budget))}</td>
                      <td>
                        <StatusBadge st={st} />
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>

      {type === 'expense' && !ro && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="ردیف بدون بودجه · سرفصل" htmlFor="ux-head">
            <Select id="ux-head" compact value={ux.head} onChange={(e) => setUx({ ...ux, head: e.target.value })}>
              {L.d.heads
                .filter((h) => !h.payroll && !h.utility && h.active)
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="مرکز هزینه" htmlFor="ux-center">
            <Select id="ux-center" compact value={ux.center} onChange={(e) => setUx({ ...ux, center: e.target.value })}>
              {L.costCenters().map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button size="sm" onClick={() => setExtra((x) => [...x, `${ux.head}|${ux.center}`])}>
            <Icon.plus size={14} />
            افزودن ردیف
          </Button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {ro ? (
          <p className="text-xs text-slate-500">{L.d.actuals[m.k]?.closed ? 'ماه بسته است؛ ارقام فقط‌خواندنی‌اند.' : 'ثبت عملکرد با نقش حسابدار است.'}</p>
        ) : (
          <>
            <Button variant="primary" disabled={busy} onClick={() => void save()}>
              ذخیره {TYPE_LABEL[type]} {MONTHS[m.jm - 1]}
            </Button>
            {!noBudget && <span className="text-xs text-slate-500">فرمول: اختلاف = واقعی − بودجه · تحقق = واقعی ÷ بودجه × ۱۰۰</span>}
          </>
        )}
      </div>
    </>
  );
}

/* ------------------------------ قبوض ------------------------------ */

function BillsPanel({ L, p, m, ro }: { L: Ledger; p: Period; m: Month; ro: boolean }) {
  const { repo, toast } = useStore();
  const [edit, setEdit] = useState<Bill | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const list = L.d.bills.filter((b) => b.month === m.k);
  const first = L.costCenters()[0]?.id || '';

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-navy-900">قبوض {mName(m.jy, m.jm)}</h3>
        {!ro && (
          <Button
            size="sm"
            variant="navy"
            onClick={() => setEdit({ id: '', type: 'power', amount: '', month: m.k, mode: 'direct', center: first, alloc: [{ center: first, pct: 100 }] })}
          >
            <Icon.plus size={14} />
            ثبت قبض
          </Button>
        )}
      </div>
      <TableWrap>
        <table className="ledger">
          <thead>
            <tr>
              <th>نوع</th>
              <th>اشتراک / کنتور</th>
              <th>محل مصرف</th>
              <th className="n">مبلغ</th>
              <th>پرداخت</th>
              <th>تخصیص</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState title="قبضی نیست">قبضی برای این ماه ثبت نشده.</EmptyState>
                </td>
              </tr>
            )}
            {list.map((b) => (
              <tr key={b.id}>
                <td>
                  <b className="text-navy-900">{BILL_TYPES[b.type]}</b>
                </td>
                <td className="text-xs">
                  <span dir="ltr">{b.subscription || '—'}</span>
                  <div className="text-slate-400">{b.meter}</div>
                </td>
                <td className="text-xs">{b.location || '—'}</td>
                <td className="n">{nf(b.amount)}</td>
                <td className="text-xs">{b.pay_date ? fa(toEn(b.pay_date)) : '—'}</td>
                <td className="text-xs">
                  {b.mode === 'direct' ? `مستقیم · ${L.cName(b.center)}` : `مشترک · ${b.alloc.map((a) => `${L.cName(a.center)} ${fa(a.pct)}٪`).join('، ')}`}
                </td>
                <td className="whitespace-nowrap">
                  {!ro &&
                    (ask === b.id ? (
                      <span className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            try {
                              await repo.deleteBill(b.id);
                              setAsk(null);
                              toast('قبض حذف شد.');
                            } catch (e) {
                              toast(errMsg(e), 'bad');
                            }
                          }}
                        >
                          حذف
                        </Button>
                        <Button size="sm" onClick={() => setAsk(null)}>
                          انصراف
                        </Button>
                      </span>
                    ) : (
                      <span className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEdit(clone({ ...b, alloc: b.alloc?.length ? b.alloc : [{ center: b.center || first, pct: 100 }] }))}
                        >
                          ویرایش
                        </Button>
                        <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setAsk(b.id)}>
                          حذف
                        </Button>
                      </span>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <p className="mt-3 text-xs text-slate-500">
        قبض‌ها مستقیم به سرفصل‌های آب، برق، تلفن و اینترنت در عملکرد واقعی وارد می‌شوند. قبض مشترک به نسبت درصدها بین مراکز تقسیم می‌شود.
      </p>
      {edit && <BillModal L={L} p={p} initial={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function BillModal({ L, p, initial, onClose }: { L: Ledger; p: Period; initial: Bill; onClose: () => void }) {
  const { repo, toast } = useStore();
  const [b, setB] = useState<Bill>({ ...initial, pay_date: initial.pay_date ? fa(toEn(initial.pay_date)) : '' });
  const [err, setErr] = useState('');
  const set = <K extends keyof Bill>(k: K, v: Bill[K]) => setB((x) => ({ ...x, [k]: v }));
  const sum = b.alloc.reduce((t, a) => t + Number(a.pct || 0), 0);

  async function save() {
    const rec: Bill = { ...b, amount: digits(b.amount) || '0', pay_date: toEn(b.pay_date || '').trim() };
    if (rec.mode === 'direct') rec.alloc = [];
    if (rec.pay_date && !jParse(rec.pay_date)) return setErr('تاریخ پرداخت را به شکل ۱۴۰۵/۰۷/۱۰ بنویسید.');
    try {
      await repo.saveBill(rec);
      toast('قبض ذخیره شد.', 'ok');
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  return (
    <Modal title={initial.id ? 'ویرایش قبض' : 'ثبت قبض'} size="xl" onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نوع قبض" htmlFor="bl-type">
          <Select id="bl-type" value={b.type} onChange={(e) => set('type', e.target.value as BillType)}>
            {Object.entries(BILL_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="مبلغ (تومان)" htmlFor="bl-amount">
          <AmountInput id="bl-amount" className="min-h-11 rounded-xl" value={b.amount} onValue={(v) => set('amount', v)} />
        </Field>
        <Field label="شماره اشتراک" htmlFor="bl-sub">
          <Input id="bl-sub" dir="ltr" maxLength={30} value={b.subscription || ''} onChange={(e) => set('subscription', e.target.value)} />
        </Field>
        <Field label="شماره کنتور / خط" htmlFor="bl-meter">
          <Input id="bl-meter" maxLength={30} value={b.meter || ''} onChange={(e) => set('meter', e.target.value)} />
        </Field>
        <Field label="محل مصرف" htmlFor="bl-loc">
          <Input id="bl-loc" maxLength={60} value={b.location || ''} onChange={(e) => set('location', e.target.value)} />
        </Field>
        <Field label="دوره مصرف" htmlFor="bl-month">
          <Select id="bl-month" value={b.month} onChange={(e) => set('month', e.target.value)}>
            {monthsOf(p).map((m) => (
              <option key={m.k} value={m.k}>
                {mName(m.jy, m.jm)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="تاریخ پرداخت" htmlFor="bl-date">
          <Input id="bl-date" dir="ltr" placeholder="۱۴۰۵/۰۷/۱۰" value={b.pay_date || ''} onChange={(e) => set('pay_date', e.target.value)} />
        </Field>
        <Field label="نوع تخصیص">
          <Segmented
            value={b.mode}
            onChange={(mode) => set('mode', mode)}
            options={[
              { value: 'direct', label: 'مستقیم' },
              { value: 'shared', label: 'مشترک' },
            ]}
          />
        </Field>
        {b.mode === 'direct' ? (
          <Field label="مرکز هزینه" htmlFor="bl-center" className="sm:col-span-2">
            <Select id="bl-center" value={b.center} onChange={(e) => set('center', e.target.value)}>
              {L.costCenters().map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-sm font-medium text-slate-700">تخصیص درصدی (جمع باید ۱۰۰ باشد)</p>
            <div className="space-y-2">
              {b.alloc.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    compact
                    className="flex-1"
                    value={a.center}
                    onChange={(e) => set('alloc', b.alloc.map((x, j) => (j === i ? { ...x, center: e.target.value } : x)))}
                  >
                    {L.costCenters().map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <SmallNumberInput
                    aria-label="درصد"
                    className="w-20"
                    value={a.pct || ''}
                    onValue={(n) => set('alloc', b.alloc.map((x, j) => (j === i ? { ...x, pct: n } : x)))}
                  />
                  <span className="text-sm">٪</span>
                  <button
                    type="button"
                    aria-label="حذف"
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                    onClick={() => set('alloc', b.alloc.filter((_, j) => j !== i))}
                  >
                    <Icon.close size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <Button
                size="sm"
                onClick={() =>
                  set('alloc', [
                    ...b.alloc,
                    { center: L.costCenters().find((c) => !b.alloc.some((a) => a.center === c.id))?.id || L.costCenters()[0]?.id || '', pct: 0 },
                  ])
                }
              >
                <Icon.plus size={14} />
                مرکز
              </Button>
              <span className={cx('text-xs', sum === 100 ? 'text-ok' : 'text-slate-500')}>جمع: {fa(sum)}٪</span>
            </div>
          </div>
        )}
      </div>
      <div className="mt-4">
        <ErrorText>{err}</ErrorText>
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={() => void save()}>
          ذخیره قبض
        </Button>
        <Button variant="ghost" onClick={onClose}>
          انصراف
        </Button>
      </div>
    </Modal>
  );
}

/* ------------------------- ثبت از روی سند (AI) ------------------------- */

interface DocItem {
  kind: LineType | 'bill' | 'unmatched';
  key?: string;
  label: string;
  amount?: string;
  source?: string;
  on: boolean;
  bill?: Bill;
}

function DocReader({ L, p, m, v }: { L: Ledger; p: Period; m: Month; v: Version }) {
  const { ai, repo, toast, audit } = useStore();
  const task = useAiTask('doc_read');
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [res, setRes] = useState<{ items: DocItem[]; unmatched: string[]; notes: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!ai.on) return null;

  async function read() {
    if (!files.length && !text.trim()) return task.setError('عکس سند را انتخاب کنید یا متن آن را بچسبانید.');
    const Ls = L.linesOf(v);
    const catalog = {
      month: `${MONTHS[m.jm - 1]} ${m.jy}`,
      revenue_lines: Ls.filter((l) => l.type === 'revenue').map((l) => ({ center: l.center, name: L.cName(l.center) })),
      expense_heads: L.d.heads.filter((h) => h.active && !h.payroll && !h.utility).map((h) => ({ head: h.id, name: h.name, default_center: h.default_center })),
      budgeted_expense_lines: Ls.filter((l) => l.type === 'expense' && !L.headById(l.head)?.utility).map((l) => ({ head: l.head, center: l.center, name: `${l.label} · ${L.cName(l.center)}` })),
      cost_centers: L.costCenters().map((c) => ({ id: c.id, name: c.name })),
      payroll_units: Ls.filter((l) => l.type === 'payroll').map((l) => ({ center: l.center, name: L.cName(l.center) })),
      bill_types: BILL_TYPES,
    };
    const src = [files.length ? 'تصویر(های) پیوست' : '', text ? 'متن زیر' : ''].filter(Boolean).join(' و ');
    const prompt = `تو دستیار ورود اطلاعات مالی هستی. از ${src} مبالغ عملکرد واقعی ماه «${catalog.month}» را استخراج کن و هر مبلغ را به یکی از ردیف‌های سامانه وصل کن.
قواعد:
- مبالغ را به تومان برگردان. اگر سند به ریال است، تقسیم بر ۱۰ کن و در notes بنویس.
- قبض آب، برق، تلفن و اینترنت را فقط در bills بیاور (نه در items).
- kind یکی از revenue، expense، payroll است. برای revenue فیلد center از revenue_lines؛ برای expense فیلدهای head و center (center از cost_centers؛ اگر معلوم نیست default_center همان head)؛ برای payroll فیلد center از payroll_units.
- چیزی که مطمئن نیستی به کدام ردیف می‌خورد در unmatched با مبلغ و توضیح بنویس. چیزی از خودت نساز.
- source: چند کلمه از سند که مبلغ را از آن خواندی.
فقط یک شیء JSON برگردان:
{"items":[{"kind":"expense","head":"h_parts","center":"cc3","amount":0,"source":""}],"bills":[{"type":"power","amount":0,"subscription":"","meter":"","location":"","pay_date":"1405/07/10","center":""}],"unmatched":[""],"notes":""}

ردیف‌های سامانه:
${JSON.stringify(catalog)}
${text ? `\nمتن سند:\n${text.slice(0, 20000)}` : ''}`;
    const images = await Promise.all(files.slice(0, 5).map(fileToImage));
    const r = await task.run({ messages: [{ role: 'user', content: prompt }], json: true, images });
    const j = r?.json as Record<string, unknown> | undefined;
    if (!r) return;
    if (!j || typeof j !== 'object') return task.setError('پاسخ هوش مصنوعی ساختار درستی نداشت.');
    const items: DocItem[] = [];
    for (const x of (j.items as Record<string, unknown>[]) || []) {
      const amt = toInt(x.amount);
      if (amt <= 0) continue;
      const c = L.centerById(String(x.center));
      const h = L.headById(String(x.head));
      if (x.kind === 'revenue' && c?.kind === 'revenue') items.push({ kind: 'revenue', key: c.id, label: c.name, amount: String(amt), source: String(x.source || ''), on: true });
      else if (x.kind === 'payroll' && c?.kind === 'cost')
        items.push({ kind: 'payroll', key: c.id, label: `حقوق و مزایا · ${c.name}`, amount: String(amt), source: String(x.source || ''), on: true });
      else if (x.kind === 'expense' && h && !h.utility && !h.payroll) {
        const cc = c?.kind === 'cost' ? c.id : h.default_center;
        items.push({ kind: 'expense', key: `${h.id}|${cc}`, label: `${h.name} · ${L.cName(cc)}`, amount: String(amt), source: String(x.source || ''), on: true });
      } else items.push({ kind: 'unmatched', label: `${x.source || 'ردیف'} — ${nf(amt)} تومان`, on: false });
    }
    for (const bx of (j.bills as Record<string, unknown>[]) || []) {
      const amt = toInt(bx.amount);
      const type = String(bx.type) as BillType;
      if (!BILL_TYPES[type] || amt <= 0) continue;
      const head = L.d.heads.find((h) => h.utility === type);
      const c = L.centerById(String(bx.center))?.kind === 'cost' ? String(bx.center) : head?.default_center || L.costCenters()[0]?.id || '';
      const pd = String(bx.pay_date || '');
      items.push({
        kind: 'bill',
        label: `قبض ${BILL_TYPES[type]} · ${L.cName(c)}`,
        amount: String(amt),
        source: [bx.subscription, bx.location].filter(Boolean).join(' · '),
        on: true,
        bill: {
          id: '',
          type,
          amount: String(amt),
          subscription: String(bx.subscription || '').slice(0, 30),
          meter: String(bx.meter || '').slice(0, 30),
          location: String(bx.location || '').slice(0, 60),
          month: m.k,
          pay_date: jParse(pd) ? toEn(pd) : '',
          mode: 'direct',
          center: c,
          alloc: [],
        },
      });
    }
    setRes({
      items,
      unmatched: ((j.unmatched as unknown[]) || []).map(String).filter(Boolean).slice(0, 20),
      notes: String(j.notes || '').slice(0, 400),
    });
    audit('ai', 'actual', m.k, `خواندن سند: ${fa(items.length)} مورد`);
  }

  async function apply() {
    if (!res) return;
    setBusy(true);
    const sel = res.items.filter((x) => x.on && x.kind !== 'unmatched');
    const cur = L.d.actuals[m.k];
    const patch: Partial<Record<LineType, Record<string, string>>> = {};
    for (const t of ['revenue', 'expense', 'payroll'] as const) {
      const rows = sel.filter((x) => x.kind === t);
      if (!rows.length) continue;
      const vals = { ...(cur?.[t] || {}) };
      const sums: Record<string, bigint> = {};
      rows.forEach((x) => (sums[x.key!] = (sums[x.key!] || 0n) + B(x.amount)));
      Object.entries(sums).forEach(([k, val]) => (vals[k] = String(val)));
      patch[t] = vals;
    }
    try {
      if (Object.keys(patch).length) await repo.saveActual(m.k, patch);
      for (const x of sel.filter((y) => y.kind === 'bill')) await repo.saveBill({ ...x.bill! });
      setRes(null);
      toast(`${fa(sel.length)} مورد از سند ثبت شد.`, 'ok');
    } catch (e) {
      toast(errMsg(e), 'bad');
    }
    setBusy(false);
  }

  return (
    <AiCard
      title="ثبت از روی سند"
      subtitle="عکس فاکتور و قبض یا متن خروجی سپیدار"
      action={
        <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
          {open || res ? 'بستن' : 'باز کردن'}
        </Button>
      }
    >
      {(open || res || task.busy) && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="عکس سند (حداکثر ۵ تصویر)" htmlFor="ai-doc-files">
              <input
                id="ai-doc-files"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="field-input text-sm"
                onChange={(e) => setFiles([...(e.target.files || [])])}
              />
            </Field>
            <Field label="یا متن سند را اینجا بچسبانید" htmlFor="ai-doc-text">
              <Textarea id="ai-doc-text" rows={3} placeholder="مثلاً ردیف‌های گزارش هزینه ماه از سپیدار" value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AiButton pending={task.busy} disabled={task.busy} onClick={() => void read()}>
              خواندن سند
            </AiButton>
            <span className="text-xs text-slate-500">هیچ رقمی تا پیش از تأیید شما ثبت نمی‌شود.</span>
          </div>
          <AiState busy={task.busy} error={task.error} label="در حال خواندن سند…" onStop={task.stop} />
          {res && (
            <>
              <TableWrap>
                <table className="ledger">
                  <thead>
                    <tr>
                      <th />
                      <th>ردیف سامانه</th>
                      <th className="n">مبلغ (تومان)</th>
                      <th>منبع در سند</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.items.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          <EmptyState title="مبلغی پیدا نشد" />
                        </td>
                      </tr>
                    )}
                    {res.items.map((x, i) =>
                      x.kind === 'unmatched' ? (
                        <tr key={i} className="text-slate-400">
                          <td />
                          <td colSpan={3}>
                            {x.label} <Badge tone="neutral">نامشخص</Badge>
                          </td>
                        </tr>
                      ) : (
                        <tr key={i}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label="انتخاب"
                              className="h-4 w-4 accent-brand-600"
                              checked={x.on}
                              onChange={(e) => setRes({ ...res, items: res.items.map((y, j) => (j === i ? { ...y, on: e.target.checked } : y)) })}
                            />
                          </td>
                          <td>
                            <b className="text-navy-900">{x.label}</b> <Badge tone="info">{x.kind === 'bill' ? 'قبض' : TYPE_LABEL[x.kind]}</Badge>
                          </td>
                          <td className="n">{nf(x.amount)}</td>
                          <td className="text-xs text-slate-500">{x.source}</td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </TableWrap>
              {res.unmatched.length > 0 && (
                <Alert tone="attention">
                  <b>موارد نامشخص:</b> {res.unmatched.join('، ')}
                </Alert>
              )}
              {res.notes && <p className="text-sm text-slate-600">{res.notes}</p>}
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" disabled={busy || !res.items.some((x) => x.on && x.kind !== 'unmatched')} onClick={() => void apply()}>
                  ثبت موارد انتخاب‌شده در {MONTHS[m.jm - 1]}
                </Button>
                <Button variant="ghost" onClick={() => setRes(null)}>
                  کنار گذاشتن
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                مبلغ ردیف‌های درآمد، هزینه و حقوق جایگزین رقم فعلی همان ردیف در این ماه می‌شود؛ قبض‌ها به‌عنوان قبض جدید ثبت می‌شوند.
              </p>
            </>
          )}
        </div>
      )}
    </AiCard>
  );
}
