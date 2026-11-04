'use client';

/**
 * ریز اسناد — هر ردیف فایل حسابداری با شرح اصلی، همان‌طور که وارد شده.
 * عدد ماهانه‌ی «عملکرد واقعی» جمع همین ردیف‌هاست؛ اینجا معلوم است از کجا آمده.
 */

import { useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Stat, TableWrap } from '@/components/ui';
import { B, compact, mkLabel, nf, sumB } from '@/lib/format';
import { TYPE_LABEL } from '@/lib/ledger';
import { useStore } from '@/lib/store';
import type { LineType } from '@/lib/types';

const PAGE = 150;

export default function EntriesPage() {
  const { data, ledger: L } = useStore();
  const [q, setQ] = useState('');
  const [type, setType] = useState<'' | LineType>('');
  const [month, setMonth] = useState('');
  const [center, setCenter] = useState('');
  const [head, setHead] = useState('');
  const [sort, setSort] = useState<'month' | 'amount'>('month');
  const [limit, setLimit] = useState(PAGE);

  const months = useMemo(() => [...new Set(data.entries.map((e) => e.month))].sort(), [data.entries]);
  const list = useMemo(() => {
    const t = q.trim();
    const xs = data.entries.filter(
      (e) =>
        (!type || e.type === type) &&
        (!month || e.month === month) &&
        (!center || e.center === center) &&
        (!head || e.head === head || (head === 'h_pay' && e.type === 'payroll')) &&
        (!t || e.desc.includes(t) || L.cName(e.center).includes(t) || L.hName(e.head).includes(t) || (e.note || '').includes(t)),
    );
    return sort === 'amount' ? [...xs].sort((a, b) => (B(b.amount) > B(a.amount) ? 1 : B(b.amount) < B(a.amount) ? -1 : 0)) : xs;
  }, [data.entries, q, type, month, center, head, sort, L]);

  if (!data.entries.length)
    return (
      <>
        <PageHeader eyebrow="عملکرد و تحلیل" title="ریز اسناد" />
        <EmptyState title="سندی وارد نشده" icon={<Icon.list size={20} />}>
          از تنظیمات › داده‌ها فایل اکسل اطلاعات اولیه را وارد کنید تا ریز هر درآمد و هزینه اینجا بیاید.
        </EmptyState>
      </>
    );

  const sum = (t: LineType) => sumB(list.filter((e) => e.type === t).map((e) => e.amount));

  return (
    <>
      <PageHeader
        eyebrow="عملکرد و تحلیل"
        title="ریز اسناد"
        description="هر ردیف شیت‌های درآمد و هزینه با شرح اصلی؛ سرفصل استاندارد بودجه کنار آن آمده. عدد هر ماه در «عملکرد واقعی» جمع همین ردیف‌هاست."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="ردیف‌ها" value={nf(list.length)} icon={<Icon.list size={18} />} hint={`از ${nf(data.entries.length)} ردیف`} />
        <Stat label="درآمد" value={compact(sum('revenue'))} tone="good" icon={<Icon.arrowUp size={18} />} />
        <Stat label="هزینه" value={compact(sum('expense'))} tone="warn" icon={<Icon.arrowDown size={18} />} hint="بدون قبوض آب و برق" />
        <Stat label="حقوق و بیمه" value={compact(sum('payroll'))} tone="bad" icon={<Icon.users size={18} />} />
      </div>
      <Card>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <Input compact placeholder="جست‌وجو در شرح…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} className="lg:col-span-2" aria-label="جست‌وجو" />
          <Select compact aria-label="نوع" value={type} onChange={(e) => setType(e.target.value as '' | LineType)}>
            <option value="">همه‌ی انواع</option>
            {(['revenue', 'expense', 'payroll'] as LineType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select compact aria-label="ماه" value={month} onChange={(e) => setMonth(e.target.value)}>
            <option value="">همه‌ی ماه‌ها</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {mkLabel(m)}
              </option>
            ))}
          </Select>
          <Select compact aria-label="مرکز" value={center} onChange={(e) => setCenter(e.target.value)}>
            <option value="">همه‌ی مراکز</option>
            {data.centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.kind === 'revenue' ? 'درآمد · ' : ''}
                {c.name}
              </option>
            ))}
          </Select>
          <Select compact aria-label="سرفصل" value={head} onChange={(e) => setHead(e.target.value)}>
            <option value="">همه‌ی سرفصل‌ها</option>
            {data.heads.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          مرتب‌سازی:
          <button type="button" className={sort === 'month' ? 'font-bold text-navy-900' : 'hover:text-navy-900'} onClick={() => setSort('month')}>
            ماه
          </button>
          ·
          <button type="button" className={sort === 'amount' ? 'font-bold text-navy-900' : 'hover:text-navy-900'} onClick={() => setSort('amount')}>
            مبلغ
          </button>
        </div>
        <TableWrap>
          <table className="ledger">
            <thead>
              <tr>
                <th>ماه</th>
                <th>نوع</th>
                <th>شرح اصلی</th>
                <th>سرفصل بودجه</th>
                <th>مرکز</th>
                <th className="n">مبلغ</th>
                <th>منبع</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, limit).map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-xs">{mkLabel(e.month)}</td>
                  <td>
                    <Badge tone={e.type === 'revenue' ? 'ok' : e.type === 'payroll' ? 'info' : 'neutral'}>{TYPE_LABEL[e.type]}</Badge>
                  </td>
                  <td>
                    <b className="text-navy-900">{e.desc}</b>
                    {(e.status || e.note || e.kind) && (
                      <div className="text-[11px] text-slate-500">
                        {[e.kind === 'fixed' ? 'ثابت' : e.kind === 'variable' ? 'متغیر' : '', e.shared ? 'مشترک' : '', e.status, e.note].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="text-xs text-slate-600">{e.type === 'revenue' ? (L.centerById(e.center)?.group ?? '—') : e.type === 'payroll' ? 'حقوق و مزایا' : L.hName(e.head)}</td>
                  <td className="text-xs text-slate-600">{L.cName(e.center)}</td>
                  <td className="n">{nf(e.amount)}</td>
                  <td className="text-[11px] text-slate-400">{e.source.split('›').slice(-2).join('›')}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="ردیفی پیدا نشد" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
        {list.length > limit && (
          <div className="mt-3 text-center">
            <Button size="sm" onClick={() => setLimit((x) => x + PAGE)}>
              نمایش {nf(Math.min(PAGE, list.length - limit))} ردیف دیگر
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
