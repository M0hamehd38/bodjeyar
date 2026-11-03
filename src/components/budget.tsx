'use client';

/** اجزای مشترک صفحه‌های بودجه. */

import Link from 'next/link';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { BrandMark } from '@/components/brand';
import { Icon } from '@/components/icons';
import { Alert, Badge, Button, EmptyState, Select, type BadgeTone } from '@/components/ui';
import { amtFmt, digits, fa } from '@/lib/format';
import { STATUS_LABEL, V_STATUS, V_TONE, vLabel } from '@/lib/ledger';
import { usePeriod, useStore } from '@/lib/store';
import type { Period, Status, Version } from '@/lib/types';

export const STATUS_TONE: Record<Status, BadgeTone> = { ok: 'ok', warn: 'attention', bad: 'danger', none: 'neutral' };
export const METER_TONE: Record<Status, 'ok' | 'warn' | 'bad' | 'none'> = { ok: 'ok', warn: 'warn', bad: 'bad', none: 'none' };

export function StatusBadge({ st }: { st: Status }) {
  return <Badge tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Badge>;
}

export function VersionBadge({ v }: { v: Version }) {
  const { ledger } = useStore();
  const s = ledger.vStatus(v);
  return <Badge tone={V_TONE[s]}>{V_STATUS[s]}</Badge>;
}

/** انتخاب دوره‌ی بودجه — در سرصفحه‌ی همه‌ی بخش‌ها. */
export function PeriodSelect() {
  const { data, pid, setPid } = useStore();
  if (!data.periods.length) return null;
  return (
    <Select compact aria-label="دوره بودجه" value={pid ?? ''} onChange={(e) => setPid(e.target.value)} className="w-auto min-w-44">
      {[...data.periods].reverse().map((p) => (
        <option key={p.id} value={p.id}>
          {p.title}
        </option>
      ))}
    </Select>
  );
}

export function NoPeriod() {
  const { can } = useStore();
  return (
    <EmptyState
      title="هنوز دوره بودجه‌ای تعریف نشده است"
      icon={<Icon.calendar size={20} />}
      action={
        can('edit_budget') ? (
          <Link href="/budget">
            <Button variant="primary">رفتن به بودجه‌ریزی</Button>
          </Link>
        ) : undefined
      }
    >
      اول در بخش «بودجه‌ریزی» یک دوره (مثلاً شش‌ماهه دوم) بسازید.
    </EmptyState>
  );
}

export function NoBudget({ p }: { p: Period }) {
  const { ledger } = useStore();
  const o = ledger.openV(p.id);
  return (
    <EmptyState
      title={`بودجه تأییدشده‌ای برای ${p.title} نیست`}
      icon={<Icon.table size={20} />}
      action={
        <Link href="/budget">
          <Button>بودجه‌ریزی</Button>
        </Link>
      }
    >
      {o
        ? `«${vLabel(o)}» در وضعیت ${V_STATUS[ledger.vStatus(o)]} است. پس از تأیید مدیر، مقایسه با عملکرد اینجا نمایش داده می‌شود.`
        : 'ابتدا بودجه این دوره را در بخش «بودجه‌ریزی» تدوین و برای تأیید ارسال کنید.'}
    </EmptyState>
  );
}

export function SampleBanner() {
  const { data, can } = useStore();
  if (!data.settings.has_sample) return null;
  return (
    <Alert
      tone="info"
      className="mb-4"
      action={
        can('settings') ? (
          <Link href="/settings?tab=data">
            <Button size="sm">حذف داده نمونه</Button>
          </Link>
        ) : undefined
      }
    >
      ارقام این سامانه <b>نمونه</b> هستند تا روند کار را ببینید. پیش از ورود داده واقعی، از تنظیمات › داده‌ها حذفشان کنید.
    </Alert>
  );
}


/**
 * ورودی مبلغ: ارقام فارسی با جداکننده‌ی «٬»؛ مقدار ذخیره‌شده رشته‌ی رقمی لاتین است.
 * عدد هرگز چپ‌چین نمی‌شود و چرخ ماوس آن را عوض نمی‌کند (type=text).
 */
export function AmountInput({
  value,
  onValue,
  className = '',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string | undefined;
  onValue?: (digits: string) => void;
}) {
  return (
    <input
      inputMode="numeric"
      className={`amount-input ${className}`}
      value={amtFmt(value)}
      readOnly={!onValue || rest.readOnly}
      onChange={(e) => onValue?.(digits(e.target.value))}
      {...rest}
    />
  );
}

/** ورودی عدد کوچک (درصد، تعداد) با ارقام فارسی. */
export function SmallNumberInput({
  value,
  onValue,
  max = 3,
  className = '',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | string;
  onValue: (n: number) => void;
  max?: number;
}) {
  return (
    <input
      inputMode="numeric"
      className={`amount-input min-w-16 ${className}`}
      value={value === '' ? '' : fa(String(value))}
      onChange={(e) => onValue(Number(digits(e.target.value).slice(0, max) || '0'))}
      {...rest}
    />
  );
}

/** سرصفحه‌ی سرمه‌ای داشبورد به سبک پوستر رسمی — همان کارت خوشامد «میز کار سازمانی». */
export function DashboardHero({
  title,
  subtitle,
  badge,
  stats = [],
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  badge?: string;
  stats?: Array<{ label: string; value: ReactNode }>;
  actions?: ReactNode;
}) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-navy-900 p-5 text-white shadow-lift sm:p-6">
      <svg aria-hidden="true" className="pointer-events-none absolute -left-6 -top-6 h-56 w-72" viewBox="0 0 280 220">
        <path d="M30 -20 L260 210" stroke="#FF7900" strokeWidth="14" />
        <path d="M80 -20 L290 190" stroke="#FF7900" strokeWidth="4" opacity="0.55" />
      </svg>
      <div className="pointer-events-none absolute -bottom-10 left-24 opacity-[0.07]">
        <BrandMark size={220} color="#FFFFFF" />
      </div>
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          {badge && <span className="inline-block rounded-lg bg-brand-500 px-3 py-1 text-xs font-extrabold">{badge}</span>}
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-navy-200">{subtitle}</p>}
          {actions && <div className="no-print mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {stats.length > 0 && (
          <dl className="flex flex-wrap gap-3">
            {stats.map((s) => (
              <div key={s.label} className="relative min-w-28 rounded-xl bg-navy-800 px-4 py-3 shadow-lg ring-1 ring-white/10">
                <dt className="text-xs text-navy-300">{s.label}</dt>
                <dd className="mt-1 text-2xl font-black text-brand-400">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

/** ردیف دو ستونی «برچسب: مقدار» کوچک برای کاشی‌ها */
export function MiniStat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 font-black text-navy-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
