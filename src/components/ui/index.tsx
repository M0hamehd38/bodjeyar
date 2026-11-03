'use client';

/*
  اجزای مشترک رابط — همان کامپوننت‌های «میز کار سازمانی» با ارتفاع لمسی و سطوح
  وضعیت «ارزشیابی» (دیزاین سیستم سایپا استوار).
*/

import Link from 'next/link';
import {
  forwardRef,
  useEffect,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((p): p is string => typeof p === 'string' && p !== '').join(' ');
}

/* ------------------------------- دکمه ------------------------------- */

export type ButtonVariant = 'primary' | 'navy' | 'secondary' | 'danger' | 'success' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 font-bold text-white shadow-primary hover:bg-brand-700 active:bg-brand-800',
  navy: 'bg-navy-900 font-bold text-white shadow-sm hover:bg-navy-800',
  secondary:
    'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  success: 'bg-emerald-600 font-bold text-white hover:bg-emerald-700',
  ghost: 'text-slate-600 hover:bg-slate-100',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'min-h-10 px-4 py-2 text-sm',
  lg: 'min-h-11 px-6 py-2.5 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className = '', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    />
  );
});

/* ------------------------------- کارت ------------------------------- */

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('card p-5', className)} {...rest} />;
}

/** سرتیتر کارت با کاشی آیکون سرمه‌ای و اکشن در انتهای خط. */
export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon !== undefined && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-brand-400">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-bold text-navy-900">{title}</h2>
          {subtitle !== undefined && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action !== undefined && (
        <div className="no-print flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      )}
    </div>
  );
}

/* ------------------------------ برچسب ------------------------------ */

export type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'severe'
  | 'danger'
  | 'ok'
  | 'attention'
  | 'warn';

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-navy-100 text-navy-800',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  severe: 'bg-brand-100 text-brand-800',
  danger: 'bg-danger-soft text-danger',
  ok: 'bg-ok-soft text-ok',
  attention: 'bg-attention-soft text-attention',
  warn: 'bg-warn-soft text-warn',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        BADGE_TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------ پیام‌ها ------------------------------ */

export type AlertTone = 'info' | 'ok' | 'attention' | 'warn' | 'danger';

const ALERT_TONE: Record<AlertTone, string> = {
  info: 'border-brand-200 bg-brand-50 text-navy-900',
  ok: 'border-ok bg-ok-soft text-ok',
  attention: 'border-attention bg-attention-soft text-attention',
  warn: 'border-warn bg-warn-soft text-warn',
  danger: 'border-danger bg-danger-soft text-danger',
};

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed',
        ALERT_TONE[tone],
        className,
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? 'mt-1' : undefined}>{children}</div>}
      </div>
      {action && <div className="no-print flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {children}
    </p>
  );
}

/* ------------------------------ فیلد فرم ------------------------------ */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  required,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
        {required && (
          <span className="me-1 text-danger" aria-hidden>
            *
          </span>
        )}
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  compact?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, compact, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cx('field-input', compact && 'field-input-sm', invalid && 'field-input-invalid', className)}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className = '', ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx('field-input leading-relaxed', invalid && 'field-input-invalid', className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }
>(function Select({ compact, className = '', ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cx('field-input', compact && 'field-input-sm', className)}
      {...rest}
    />
  );
});

/* ------------------------------ سرصفحه ------------------------------ */

/** سرتیتر یکسان همه‌ی صفحه‌ها: نوار نارنجی، عنوان، توضیح کوتاه و اکشن‌ها. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow !== undefined && (
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-brand-600">
            <span className="h-1 w-5 rounded-full bg-brand-500" />
            {eyebrow}
          </div>
        )}
        <h1 className="page-title">{title}</h1>
        {description !== undefined && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
        )}
      </div>
      {actions !== undefined && (
        <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/* --------------------------- کاشی آمار --------------------------- */

export type StatTone = 'neutral' | 'good' | 'warn' | 'bad' | 'brand';

const STAT_TONE: Record<StatTone, { icon: string; value: string }> = {
  neutral: { icon: 'bg-brand-50 text-brand-600', value: 'text-navy-900' },
  good: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700' },
  warn: { icon: 'bg-amber-50 text-amber-600', value: 'text-amber-700' },
  bad: { icon: 'bg-rose-50 text-rose-600', value: 'text-rose-700' },
  brand: { icon: 'bg-navy-900 text-brand-400', value: 'text-navy-900' },
};

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  href,
  footer,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  href?: string;
  footer?: ReactNode;
}) {
  const t = STAT_TONE[tone];
  const body = (
    <>
      <div className="flex items-start gap-3">
        {icon !== undefined && (
          <span className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', t.icon)}>
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className={cx('mt-0.5 text-2xl font-black', t.value)}>{value}</div>
          {hint !== undefined && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
        </div>
      </div>
      {footer}
    </>
  );
  const cls =
    'relative block min-w-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card';
  return href !== undefined ? (
    <Link
      href={href}
      className={cx(cls, 'transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift')}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ---------------------------- انتخاب‌گر ---------------------------- */

/** انتخاب‌گر چندگزینه‌ای فشرده — برای بازه‌ی زمانی و فیلترهای کوتاه. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-0.5"
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-xs font-medium transition',
            o.value === value
              ? 'bg-navy-900 text-white'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** زبانه‌های صفحه — زیرخط نارنجی روی زبانه‌ی فعال. */
export function Tabs<T extends string | number>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 overflow-x-auto border-b border-slate-200"
    >
      {items.map((it) => (
        <button
          key={String(it.value)}
          type="button"
          role="tab"
          aria-selected={it.value === value}
          onClick={() => onChange(it.value)}
          className={cx(
            '-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition',
            it.value === value
              ? 'border-brand-500 font-bold text-navy-900'
              : 'border-transparent text-slate-500 hover:text-navy-900',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ خالی ------------------------------ */

export function EmptyState({
  children,
  title,
  icon,
  action,
}: {
  children?: ReactNode;
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      {icon !== undefined && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          {icon}
        </div>
      )}
      {title !== undefined && <h3 className="font-semibold text-slate-800">{title}</h3>}
      {children && (
        <div className={cx('text-sm leading-relaxed text-slate-500', title !== undefined && 'mt-1')}>
          {children}
        </div>
      )}
      {action !== undefined && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/* ----------------------------- بارگذاری ----------------------------- */

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="در حال بارگذاری"
      className={cx(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500',
        className,
      )}
    />
  );
}

export function Loading({ label = 'در حال بارگذاری…' }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-slate-500">
      <Spinner />
      {label}
    </p>
  );
}

/* ------------------------------ پنجره ------------------------------ */

const MODAL_SIZE = { md: 'max-w-lg', xl: 'max-w-3xl', '2xl': 'max-w-5xl' } as const;

export function Modal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  size?: keyof typeof MODAL_SIZE;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-900/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-lift',
          MODAL_SIZE[size],
        )}
      >
        {title !== undefined && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن"
              className="-m-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ------------------------------ نوار پیشرفت ------------------------------ */

const METER_TONE = {
  ok: 'bg-ok',
  warn: 'bg-attention',
  bad: 'bg-danger',
  none: 'bg-slate-300',
  brand: 'bg-brand-500',
  navy: 'bg-navy-700',
} as const;

export function Meter({
  value,
  tone = 'brand',
  label,
}: {
  value: number | null;
  tone?: keyof typeof METER_TONE;
  label?: string;
}) {
  const w = value === null ? 100 : Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={label}>
      <span className={cx('block h-full rounded-full transition-all', METER_TONE[tone])} style={{ width: `${w}%` }} />
    </div>
  );
}

/** جدول با اسکرول افقی درون کارت — صفحه‌ی موبایل پهن نمی‌شود. */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('-mx-5 overflow-x-auto px-0 sm:mx-0 sm:rounded-xl sm:border sm:border-slate-200', className)}>
      {children}
    </div>
  );
}
