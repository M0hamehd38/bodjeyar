'use client';

/**
 * پرسنل و حقوق — شیت «حقوق و مزایا»: هر نفر در هر ماه با همه‌ی اجزا.
 * کنار آن، عدد حقوق حسابداری (شیت هزینه‌ها) تا فاصله‌ی دفتر حقوق و دفتر کل دیده شود.
 */

import { useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { Alert, Badge, Card, CardHeader, cx, EmptyState, PageHeader, Segmented, Select, Stat, TableWrap } from '@/components/ui';
import { B, compact, mkLabel, MONTHS, nf, pctFa, ratio, sumB } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { StaffPay } from '@/lib/types';

const PARTS: [keyof StaffPay, string][] = [
  ['base', 'حقوق پایه'],
  ['overtime', 'اضافه‌کار'],
  ['benefits', 'مزایا'],
  ['bonus', 'پاداش/کارانه'],
  ['insurance', 'بیمه کارفرما'],
  ['eidi', 'عیدی/سنوات'],
  ['commute', 'کارواش/ایاب'],
  ['card', 'کارت طلایی/آپشن'],
];
const partsSum = (s: StaffPay) => PARTS.reduce((t, [k]) => t + B(s[k] as string), 0n);
const mismatch = (s: StaffPay) => {
  const d = partsSum(s) - B(s.total);
  return d > 1n || d < -1n;
};

export default function StaffPage() {
  const { data, ledger: L } = useStore();
  const months = useMemo(() => [...new Set(data.staff.map((s) => s.month))].sort(), [data.staff]);
  const [view, setView] = useState<'people' | 'detail'>('people');
  const [month, setMonth] = useState<string>('');
  const [unit, setUnit] = useState('');
  const units = [...new Set(data.staff.map((s) => s.unit))];

  if (!data.staff.length)
    return (
      <>
        <PageHeader eyebrow="حساب‌ها و نیرو" title="پرسنل و حقوق" />
        <EmptyState title="دفتر حقوقی ثبت نشده" icon={<Icon.users size={20} />}>
          از تنظیمات › داده‌ها فایل اکسل اطلاعات اولیه (شیت «حقوق و مزایا») را وارد کنید.
        </EmptyState>
      </>
    );

  const rows = data.staff.filter((s) => (!unit || s.unit === unit) && (!month || s.month === month));
  const lastM = months.at(-1)!;
  const people = [...new Set(rows.map((s) => s.person))];
  const total = sumB(rows.map((s) => s.total));
  const acct = sumB(months.filter((m) => !month || m === month).map((m) => sumB(Object.values(data.actuals[m]?.payroll || {}))));
  const revenue = sumB(months.filter((m) => !month || m === month).map((m) => L.actualTotals(m).R));
  const bad = rows.filter(mismatch);

  return (
    <>
      <PageHeader
        eyebrow="حساب‌ها و نیرو"
        title="پرسنل و حقوق"
        description="دفتر حقوق نفر به نفر و ماه به ماه، همان‌طور که در فایل آمده؛ کنار عدد حقوق حسابداری (که اجرت کارگاه و بیمه‌ی همه‌ی واحدها را هم دارد)."
        actions={
          <>
            <Select compact aria-label="واحد" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-auto">
              <option value="">همه‌ی واحدها</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
            <Select compact aria-label="ماه" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto">
              <option value="">همه‌ی ماه‌ها</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {mkLabel(m)}
                </option>
              ))}
            </Select>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="نفرات" value={nf(people.length)} icon={<Icon.users size={18} />} hint={`آخرین ماه: ${nf(data.staff.filter((s) => s.month === lastM && (!unit || s.unit === unit)).length)} نفر`} />
        <Stat label="جمع دفتر حقوق" value={compact(total)} tone="brand" icon={<Icon.table size={18} />} hint={month ? mkLabel(month) : `${nf(months.length)} ماه`} />
        <Stat label="حقوق در حسابداری" value={compact(acct)} icon={<Icon.file size={18} />} hint="حقوق + بیمه + سنوات همه‌ی واحدها" />
        <Stat label="سهم حقوق از درآمد" value={pctFa(ratio(acct, revenue))} tone={(ratio(acct, revenue) ?? 0) > 60 ? 'bad' : 'warn'} icon={<Icon.pulse size={18} />} hint="عدد حسابداری ÷ درآمد" />
      </div>

      {bad.length > 0 && (
        <Alert tone="attention" className="mb-4" title={`${nf(bad.length)} ردیف حقوق ناهمخوان`}>
          در این ردیف‌ها «جمع پرداختی» با جمع اجزا یکی نیست (بیشتر ستون کارواش/ایاب‌وذهاب یا کارت طلایی در جمع نیامده). جمع همان‌طور که در فایل آمده نگه داشته شده؛ ردیف‌ها با <Icon.alert size={12} className="inline" /> علامت خورده‌اند.
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader icon={<Icon.chart size={16} />} title="دفتر حقوق در برابر حسابداری" subtitle="فاصله = اجرت کارگاه، بیمه‌ی پرسنل خارج از فهرست و سایر اقلام حقوقی" />
        <TableWrap>
          <table className="ledger">
            <thead>
              <tr>
                <th>ماه</th>
                <th className="n">نفرات</th>
                <th className="n">دفتر حقوق</th>
                <th className="n">حقوق حسابداری</th>
                <th className="n">فاصله</th>
                <th className="n">سهم از درآمد</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const r = data.staff.filter((s) => s.month === m);
                const reg = sumB(r.map((s) => s.total));
                const ac = sumB(Object.values(data.actuals[m]?.payroll || {}));
                return (
                  <tr key={m}>
                    <td>
                      <b className="text-navy-900">{mkLabel(m)}</b>
                    </td>
                    <td className="n">{nf(r.length)}</td>
                    <td className="n">{nf(reg)}</td>
                    <td className="n">{nf(ac)}</td>
                    <td className="n">{nf(ac - reg)}</td>
                    <td className="n">{pctFa(ratio(ac, L.actualTotals(m).R))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-navy-900">پرسنل</h2>
          <Segmented
            label="نما"
            value={view}
            onChange={setView}
            options={[
              { value: 'people', label: 'نفر × ماه' },
              { value: 'detail', label: 'ریز اجزا' },
            ]}
          />
        </div>
        {view === 'people' ? (
          <TableWrap>
            <table className="ledger">
              <thead>
                <tr>
                  <th>نام</th>
                  <th>واحد</th>
                  {months
                    .filter((m) => !month || m === month)
                    .map((m) => (
                      <th key={m} className="n">
                        {MONTHS[+m.slice(5) - 1]}
                      </th>
                    ))}
                  <th className="n">جمع</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => {
                  const r = rows.filter((s) => s.person === p);
                  return (
                    <tr key={p}>
                      <td>
                        <b className="text-navy-900">{p}</b>
                      </td>
                      <td className="text-xs text-slate-600">{r[0]?.unit}</td>
                      {months
                        .filter((m) => !month || m === month)
                        .map((m) => {
                          const x = r.find((s) => s.month === m);
                          return (
                            <td key={m} className={cx('n', x && mismatch(x) && 'text-attention')}>
                              {x ? (
                                <>
                                  {nf(x.total)}
                                  {mismatch(x) && <Icon.alert size={11} className="ms-1 inline" />}
                                </>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })}
                      <td className="n font-bold">{nf(sumB(r.map((s) => s.total)))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <TableWrap>
            <table className="ledger">
              <thead>
                <tr>
                  <th>ماه</th>
                  <th>نام</th>
                  {PARTS.map(([, l]) => (
                    <th key={l} className="n">
                      {l}
                    </th>
                  ))}
                  <th className="n">جمع پرداختی</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="text-xs">{mkLabel(s.month)}</td>
                    <td>
                      <b className="text-navy-900">{s.person}</b>
                      <div className="text-[11px] text-slate-500">{s.unit}</div>
                    </td>
                    {PARTS.map(([k]) => (
                      <td key={k} className="n text-xs">
                        {B(s[k] as string) ? nf(s[k] as string) : <span className="text-slate-300">—</span>}
                      </td>
                    ))}
                    <td className={cx('n font-bold', mismatch(s) && 'text-attention')}>
                      {nf(s.total)}
                      {mismatch(s) && (
                        <Badge tone="attention" className="ms-1">
                          جمع اجزا {nf(partsSum(s))}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
