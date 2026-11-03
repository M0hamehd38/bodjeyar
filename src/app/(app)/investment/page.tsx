'use client';

import { useState } from 'react';
import { AmountInput, NoBudget, NoPeriod, PeriodSelect, SampleBanner, SmallNumberInput } from '@/components/budget';
import { Icon } from '@/components/icons';
import { Badge, Button, Card, CardHeader, cx, EmptyState, ErrorText, Field, Meter, PageHeader, Select, Stat } from '@/components/ui';
import { errMsg } from '@/lib/backend';
import { compact, fa, mName, MONTHS, pctFa, ratio, sumB, tm } from '@/lib/format';
import { INV_STATUS, INV_TONE, monthsOf, PRIORITY, vLabel } from '@/lib/ledger';
import { usePeriod, useStore } from '@/lib/store';
import type { Investment, InvStatus, InvTrack } from '@/lib/types';

export default function InvestmentPage() {
  const { period: p, ledger: L, can } = usePeriod();
  const [editing, setEditing] = useState<string | null>(null);

  const head = (title: string, desc?: string) => <PageHeader eyebrow="سرمایه‌گذاری" title={title} description={desc} actions={<PeriodSelect />} />;
  if (!p)
    return (
      <>
        {head('پروژه‌های سرمایه‌گذاری')}
        <NoPeriod />
      </>
    );
  const v = L.activeV(p.id) || L.openV(p.id);
  if (!v)
    return (
      <>
        {head('پروژه‌های سرمایه‌گذاری', p.title)}
        <NoBudget p={p} />
      </>
    );

  const ms = monthsOf(p);
  const list = v.investments || [];
  const approved = v.status === 'approved';
  const tr = (id: string): InvTrack => L.d.inv[id] || { id, status: 'planned', progress: 0, actual: '0' };
  const totB = sumB(list.map((x) => x.amount));
  const totA = sumB(list.map((x) => tr(x.id).actual));

  return (
    <>
      {head(`پروژه‌های ${p.title}`, approved ? `مبنا: ${vLabel(v)} تأییدشده` : `${vLabel(v)} هنوز تأیید نشده؛ پروژه‌ها در حد برنامه‌اند.`)}
      <SampleBanner />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="بودجه مصوب" icon={<Icon.file size={20} />} value={compact(totB)} hint={tm(totB)} />
        <Stat label="هزینه واقعی" icon={<Icon.pulse size={20} />} value={compact(totA)} hint={tm(totA)} />
        <Stat
          label="مصرف بودجه سرمایه‌گذاری"
          icon={<Icon.target size={20} />}
          tone="brand"
          value={pctFa(ratio(totA, totB))}
          footer={
            <div className="mt-3">
              <Meter value={ratio(totA, totB)} tone="brand" />
            </div>
          }
        />
        <Stat
          label="پروژه‌ها"
          icon={<Icon.kanban size={20} />}
          value={fa(list.length)}
          hint={(Object.entries(INV_STATUS) as [InvStatus, string][]).map(([k, l]) => `${l} ${fa(list.filter((x) => tr(x.id).status === k).length)}`).join(' · ')}
        />
      </div>

      {list.length ? (
        <>
          <Card className="mb-6">
            <CardHeader title="زمان‌بندی اجرا" icon={<Icon.calendar size={18} />} />
            <div className="overflow-x-auto">
              <div className="min-w-[640px] space-y-1.5" style={{ minWidth: 180 + ms.length * 64 }}>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `minmax(140px,1.4fr) repeat(${ms.length}, minmax(52px,1fr))` }}>
                  <span />
                  {ms.map((m) => (
                    <span key={m.i} className="text-center text-xs text-slate-500">
                      {MONTHS[m.jm - 1]}
                    </span>
                  ))}
                </div>
                {list.map((x) => {
                  const t = tr(x.id);
                  return (
                    <div key={x.id} className="grid items-center gap-1.5" style={{ gridTemplateColumns: `minmax(140px,1.4fr) repeat(${ms.length}, minmax(52px,1fr))` }}>
                      <span className="truncate text-sm font-semibold text-navy-900">{x.title}</span>
                      {ms.map((m) =>
                        m.i === x.month ? (
                          <span
                            key={m.i}
                            title={x.title}
                            className={cx(
                              'grid h-8 place-items-center rounded-lg text-[11px] font-bold',
                              t.status === 'done' ? 'bg-emerald-600 text-white' : t.status === 'running' ? 'bg-brand-500 text-white' : t.status === 'stopped' ? 'bg-slate-300 text-slate-700' : 'bg-navy-900 text-white',
                            )}
                          >
                            {compact(x.amount)}
                          </span>
                        ) : (
                          <span key={m.i} className="h-8 rounded-lg bg-slate-50" />
                        ),
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((x) => (
              <ProjectCard
                key={x.id}
                x={x}
                t={tr(x.id)}
                month={ms[x.month] ? mName(ms[x.month]!.jy, ms[x.month]!.jm) : '—'}
                center={L.cName(x.center)}
                editing={editing === x.id}
                canEdit={can('investment') && approved}
                onEdit={() => setEditing(x.id)}
                onDone={() => setEditing(null)}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState title="پروژه‌ای تعریف نشده" icon={<Icon.target size={20} />}>
          پروژه‌های سرمایه‌گذاری در مرحله پنجم ویزارد بودجه اضافه می‌شوند.
        </EmptyState>
      )}
    </>
  );
}

function ProjectCard({
  x,
  t,
  month,
  center,
  editing,
  canEdit,
  onEdit,
  onDone,
}: {
  x: Investment;
  t: InvTrack;
  month: string;
  center: string;
  editing: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onDone: () => void;
}) {
  const { repo, toast } = useStore();
  const [f, setF] = useState({ status: t.status, progress: t.progress, actual: t.actual });
  const [err, setErr] = useState('');
  const use = ratio(t.actual, x.amount);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-navy-900">{x.title}</h3>
        <Badge tone={INV_TONE[t.status]}>{INV_STATUS[t.status]}</Badge>
      </div>
      <p className="text-xs text-slate-500">
        {center} · {x.type || '—'} · اولویت {PRIORITY[x.priority] || '—'} · {month}
      </p>
      {x.description && <p className="text-sm text-slate-600">{x.description}</p>}
      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>پیشرفت</span>
          <span className="font-bold text-navy-900">{fa(t.progress)}٪</span>
        </div>
        <Meter value={t.progress} tone="navy" />
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <span>
          مصوب <b className="text-navy-900">{compact(x.amount)}</b>
        </span>
        <span>
          واقعی <b className="text-navy-900">{compact(t.actual)}</b>
        </span>
        <span className={use !== null && use > 100 ? 'font-bold text-rose-700' : ''}>{pctFa(use)}</span>
      </div>
      {editing ? (
        <div className="space-y-3 rounded-xl bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="وضعیت" htmlFor={`iv-st-${x.id}`}>
              <Select id={`iv-st-${x.id}`} compact value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as InvStatus })}>
                {Object.entries(INV_STATUS).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="پیشرفت ٪" htmlFor={`iv-pr-${x.id}`}>
              <SmallNumberInput id={`iv-pr-${x.id}`} value={f.progress} onValue={(n) => setF({ ...f, progress: n })} />
            </Field>
            <Field label="هزینه واقعی (تومان)" className="col-span-2">
              <AmountInput value={f.actual} onValue={(v) => setF({ ...f, actual: v || '0' })} />
            </Field>
          </div>
          <ErrorText>{err}</ErrorText>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                if (f.progress > 100) return setErr('پیشرفت بین ۰ تا ۱۰۰ باشد.');
                try {
                  await repo.saveInv(x.id, f);
                  toast('وضعیت پروژه به‌روز شد.', 'ok');
                  onDone();
                } catch (e) {
                  setErr(errMsg(e));
                }
              }}
            >
              ذخیره
            </Button>
            <Button size="sm" onClick={onDone}>
              انصراف
            </Button>
          </div>
        </div>
      ) : (
        canEdit && (
          <div className="mt-auto">
            <Button size="sm" onClick={onEdit}>
              به‌روزرسانی وضعیت
            </Button>
          </div>
        )
      )}
    </Card>
  );
}
