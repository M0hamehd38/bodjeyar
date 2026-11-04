'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ApprovalPanel } from '@/components/approval';
import { PeriodSelect, SampleBanner, VersionBadge } from '@/components/budget';
import { Icon } from '@/components/icons';
import { Alert, Button, Card, CardHeader, EmptyState, ErrorText, Field, Input, Modal, PageHeader, Segmented, Select, Stat, TableWrap } from '@/components/ui';
import { Wizard } from '@/components/wizard';
import { errMsg } from '@/lib/backend';
import { compact, fa, jFa, MONTHS, nf, pctFa, tm, today } from '@/lib/format';
import { periodRange, vLabel, type Ledger } from '@/lib/ledger';
import { usePeriod, useStore } from '@/lib/store';
import type { PeriodType, Version } from '@/lib/types';

export default function BudgetPage() {
  return (
    <Suspense>
      <Budget />
    </Suspense>
  );
}

function Budget() {
  const sp = useSearchParams();
  const router = useRouter();
  const vid = sp.get('v');
  const step = sp.get('step');
  if (vid)
    return <Wizard key={vid} vid={vid} initialStep={step !== null ? +step : undefined} onClose={() => router.push('/budget')} />;
  return <BudgetHome open={(id, s) => router.push(`/budget?v=${id}${s !== undefined ? `&step=${s}` : ''}`)} />;
}

function BudgetHome({ open }: { open: (id: string, step?: number) => void }) {
  const { period: p, ledger: L, can, repo, toast, setPid } = usePeriod();
  const [newPeriod, setNewPeriod] = useState(false);
  const [busy, setBusy] = useState(false);

  const actions = (
    <>
      <PeriodSelect />
      {can('edit_budget') && (
        <Button variant="primary" onClick={() => setNewPeriod(true)}>
          <Icon.plus size={16} />
          دوره جدید
        </Button>
      )}
    </>
  );

  const modal = newPeriod && <PeriodModal onClose={() => setNewPeriod(false)} />;

  if (!p)
    return (
      <>
        <PageHeader
          eyebrow="بودجه‌ریزی و تأیید"
          title="بودجه‌ریزی"
          description="دوره بودجه را تعریف کنید، ارقام را مرحله‌به‌مرحله وارد کنید و برای تأیید مدیر بفرستید."
          actions={actions}
        />
        <SampleBanner />
        <EmptyState
          title="هنوز دوره‌ای نیست"
          icon={<Icon.calendar size={20} />}
          action={
            can('edit_budget') ? (
              <Button variant="primary" onClick={() => setNewPeriod(true)}>
                ساخت دوره
              </Button>
            ) : undefined
          }
        >
          {can('edit_budget') ? 'برای شروع، یک دوره بودجه بسازید. پیشنهاد نسخه اول: شش‌ماهه دوم سال.' : 'ساخت دوره با نقش حسابدار است.'}
        </EmptyState>
        {modal}
      </>
    );

  const vs = L.versionsOf(p.id);
  const av = L.activeV(p.id);
  const ov = L.openV(p.id);
  const t = av ? L.versionTotals(av) : null;

  return (
    <>
      <PageHeader eyebrow="بودجه‌ریزی و تأیید" title={p.title} description={`${periodRange(p)} · ${fa(p.months)} ماه`} actions={actions} />
      <SampleBanner />
      {ov && ov.status === 'submitted' && <ApprovalPanel v={ov} onReview={() => open(ov.id)} />}

      {!vs.length && L.isHistory(p) && (() => {
        const nx = L.d.periods.find((q) => q.id !== p.id && (L.openV(q.id) || L.activeV(q.id)));
        return (
          <Alert
            tone="info"
            className="mb-4"
            action={
              nx ? (
                <Button size="sm" variant="primary" onClick={() => setPid(nx.id)}>
                  رفتن به {nx.title}
                </Button>
              ) : undefined
            }
          >
            «{p.title}» دوره‌ی مرجع است: عملکرد واقعی دارد و مبنای بودجه‌ی دوره‌ی بعد است.
            {nx ? ` پیش‌نویس بودجه‌ی ${nx.title} از روی همین عملکرد آماده است.` : ''}
          </Alert>
        );
      })()}
      {!vs.length && (
        <EmptyState
          title={can('edit_budget') ? 'بودجه این دوره هنوز تدوین نشده' : 'بودجه‌ای ثبت نشده'}
          icon={<Icon.table size={20} />}
          action={
            can('edit_budget') ? (
              <Button
                variant="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const v = await repo.createInitial(p.id);
                    open(v.id, 0);
                  } catch (e) {
                    toast(errMsg(e), 'bad');
                    setBusy(false);
                  }
                }}
              >
                شروع تدوین بودجه
              </Button>
            ) : undefined
          }
        >
          {can('edit_budget')
            ? 'ویزارد شش مرحله دارد: دوره، درآمدها، هزینه‌ها، حقوق و مزایا، سرمایه‌گذاری، بررسی و ارسال. هر مرحله ذخیره موقت دارد.'
            : 'تدوین بودجه با نقش حسابدار است. پس از ارسال، برای تأیید اینجا نمایش داده می‌شود.'}
        </EmptyState>
      )}

      {t && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="درآمد بودجه" icon={<Icon.arrowUp size={20} />} value={compact(t.R)} hint={tm(t.R)} />
          <Stat label="هزینه + حقوق بودجه" icon={<Icon.arrowDown size={20} />} value={compact(t.E + t.P)} hint={tm(t.E + t.P)} />
          <Stat label="نتیجه بودجه‌شده" icon={<Icon.chart size={20} />} tone={t.net < 0n ? 'bad' : 'brand'} value={compact(t.net)} hint={tm(t.net)} />
          <Stat label="سرمایه‌گذاری مصوب" icon={<Icon.target size={20} />} value={compact(t.inv)} hint={tm(t.inv)} />
        </div>
      )}

      {vs.length > 0 && (
        <Card className="mb-6">
          <CardHeader
            title="نسخه‌های بودجه این دوره"
            icon={<Icon.archive size={18} />}
            action={
              av && can('revision') && !ov ? (
                <Link href="/revisions">
                  <Button size="sm">ایجاد اصلاحیه</Button>
                </Link>
              ) : undefined
            }
          />
          <TableWrap>
            <table className="ledger">
              <thead>
                <tr>
                  <th>نسخه</th>
                  <th>وضعیت</th>
                  <th>ایجادکننده</th>
                  <th>ارسال</th>
                  <th>تصمیم مدیر</th>
                  <th className="n">نتیجه بودجه‌شده</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {vs
                  .slice()
                  .reverse()
                  .map((v) => (
                    <VersionRow key={v.id} v={v} L={L} canEdit={can('edit_budget')} onOpen={() => open(v.id)} />
                  ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}

      {av && <ScenarioCard L={L} v={av} />}
      {modal}
    </>
  );
}

function VersionRow({ v, L, canEdit, onOpen }: { v: Version; L: Ledger; canEdit: boolean; onOpen: () => void }) {
  const tt = L.versionTotals(v);
  const editable = canEdit && ['draft', 'rejected'].includes(v.status);
  return (
    <tr>
      <td>
        <b className="text-navy-900">{vLabel(v)}</b>
        {v.reason && <div className="text-xs text-slate-500">{v.reason}</div>}
      </td>
      <td>
        <VersionBadge v={v} />
      </td>
      <td className="text-xs">
        <span dir="ltr">{v.created_by}</span>
        <div className="text-slate-400">{jFa(v.created_at)}</div>
      </td>
      <td className="text-xs">{v.submitted_at ? jFa(v.submitted_at) : '—'}</td>
      <td className="text-xs">
        {v.decided_by ? (
          <>
            <span dir="ltr">{v.decided_by}</span> · {jFa(v.decided_at)}
            {v.decision_note && <div className="text-slate-400">{v.decision_note}</div>}
          </>
        ) : (
          '—'
        )}
      </td>
      <td className="n">{nf(tt.net)}</td>
      <td className="whitespace-nowrap">
        <Button size="sm" variant={editable ? 'primary' : 'secondary'} onClick={onOpen}>
          {editable ? 'ادامه ویرایش' : 'مشاهده'}
        </Button>
      </td>
    </tr>
  );
}

function ScenarioCard({ L, v }: { L: Ledger; v: Version }) {
  const t = L.versionTotals(v);
  const sc = L.scenarios(t);
  const cfg = L.d.settings.scen;
  const rows = [
    ['cons', 'محافظه‌کارانه', cfg.cons],
    ['likely', 'محتمل (Base)', null],
    ['opt', 'خوش‌بینانه', cfg.opt],
  ] as const;
  return (
    <Card>
      <CardHeader title="سناریوهای بودجه" subtitle="بر پایه ارقام Base و درصدهای تنظیمات" icon={<Icon.graph size={18} />} />
      <TableWrap>
        <table className="ledger">
          <thead>
            <tr>
              <th>سناریو</th>
              <th className="n">درآمد</th>
              <th className="n">هزینه + حقوق</th>
              <th className="n">نتیجه</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, label, c]) => (
              <tr key={k}>
                <td>
                  <b className="text-navy-900">{label}</b>
                  <div className="text-xs text-slate-500">
                    درآمد {pctFa(c ? c.rev : 0, true)} · هزینه {pctFa(c ? c.exp : 0, true)}
                  </div>
                </td>
                <td className="n">{nf(sc[k].R)}</td>
                <td className="n">{nf(sc[k].C)}</td>
                <td className={`n font-bold ${sc[k].net < 0n ? 'text-rose-700' : 'text-navy-900'}`}>{nf(sc[k].net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}

function PeriodModal({ onClose }: { onClose: () => void }) {
  const { data, repo, setPid, toast } = useStore();
  const T = today();
  const [f, setF] = useState<{ type: PeriodType; year: number; start: number; len: number; title: string }>({
    type: 'half2',
    year: T.jy,
    start: T.jm,
    len: 6,
    title: '',
  });
  const [err, setErr] = useState('');

  async function save() {
    const spec = { half1: [1, 6, 'شش‌ماهه اول'], half2: [7, 6, 'شش‌ماهه دوم'], annual: [1, 12, 'سال'], custom: [f.start, f.len, 'دوره سفارشی'] }[f.type] as [
      number,
      number,
      string,
    ];
    const title = f.title.trim() || `${spec[2]} ${fa(f.year)}`;
    const startAbs = f.year * 12 + spec[0];
    const endAbs = startAbs + spec[1] - 1;
    if (
      data.periods.some((p) => {
        const s = p.start_jy * 12 + p.start_jm;
        const e = s + p.months - 1;
        return !(endAbs < s || startAbs > e);
      })
    )
      return setErr('این بازه با یک دوره موجود هم‌پوشانی دارد.');
    try {
      const p = await repo.createPeriod({ title, type: f.type, start_jy: f.year, start_jm: spec[0], months: spec[1] });
      setPid(p.id);
      toast('دوره ساخته شد.', 'ok');
      onClose();
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  return (
    <Modal title="دوره جدید بودجه" onClose={onClose}>
      <div className="space-y-4">
        <Field label="نوع دوره">
          <Segmented
            value={f.type}
            onChange={(type) => setF({ ...f, type })}
            options={[
              { value: 'half2', label: 'شش‌ماهه دوم' },
              { value: 'half1', label: 'شش‌ماهه اول' },
              { value: 'annual', label: 'سالانه' },
              { value: 'custom', label: 'سفارشی' },
            ]}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="سال" htmlFor="pf-year">
            <Select id="pf-year" value={f.year} onChange={(e) => setF({ ...f, year: +e.target.value })}>
              {[T.jy - 1, T.jy, T.jy + 1].map((y) => (
                <option key={y} value={y}>
                  {fa(y)}
                </option>
              ))}
            </Select>
          </Field>
          {f.type === 'custom' && (
            <>
              <Field label="ماه شروع" htmlFor="pf-start">
                <Select id="pf-start" value={f.start} onChange={(e) => setF({ ...f, start: +e.target.value })}>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="تعداد ماه" htmlFor="pf-len">
                <Select id="pf-len" value={f.len} onChange={(e) => setF({ ...f, len: +e.target.value })}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {fa(n)}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        </div>
        <Field label="عنوان دوره" htmlFor="pf-title" hint="خالی بماند تا از نوع و سال ساخته شود.">
          <Input id="pf-title" maxLength={60} value={f.title} placeholder="خودکار از نوع و سال" onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <ErrorText>{err}</ErrorText>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => void save()}>
            ساخت دوره
          </Button>
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
        </div>
      </div>
    </Modal>
  );
}
