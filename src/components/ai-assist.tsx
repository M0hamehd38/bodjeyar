'use client';

/**
 * زبان بصری هوش مصنوعی (AiAssist در دیزاین سیستم): قاب گرادیانی نارنجی، کاشی
 * گرادیانی، دکمه‌ی قرصی و برچسب «پیشنهاد هوش مصنوعی». فقط روی قابلیت‌های هوشمند —
 * تا همیشه معلوم باشد متن را ماشین پیشنهاد داده و تصمیم با آدم است.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '@/components/icons';
import { cx } from '@/components/ui';

export function AiChip({ children = 'پیشنهاد هوش مصنوعی' }: { children?: ReactNode }) {
  return (
    <span className="ai-chip">
      <Icon.sparkles size={11} />
      {children}
    </span>
  );
}

export function AiCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('ai-surface no-print mb-6 p-5', className)}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="ai-badge h-9 w-9">
              <Icon.sparkles size={18} />
            </span>
            <div className="min-w-0">
              {title && <h2 className="font-bold text-navy-900">{title}</h2>}
              {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function AiButton({
  pending,
  className,
  children,
  soft,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean; soft?: boolean }) {
  return (
    <button
      type="button"
      data-pending={pending ? 'true' : undefined}
      className={cx(soft ? 'ai-btn-soft' : 'ai-btn', className)}
      {...rest}
    >
      {!soft && <Icon.sparkles size={16} />}
      {children}
    </button>
  );
}

/** وضعیت درخواست: سه نقطه + «توقف»، یا پیام خطا. */
export function AiState({
  busy,
  error,
  label,
  onStop,
}: {
  busy: boolean;
  error?: string;
  label: string;
  onStop?: () => void;
}) {
  if (busy)
    return (
      <div role="status" className="mt-3 flex items-center gap-3 text-sm text-brand-700">
        <span className="ai-typing" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        {label}
        {onStop && (
          <button type="button" onClick={onStop} className="text-xs text-slate-500 underline-offset-4 hover:underline">
            توقف
          </button>
        )}
      </div>
    );
  if (error)
    return (
      <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error}
      </p>
    );
  return null;
}

export function AiSkeleton() {
  return (
    <div className="space-y-2 py-1" aria-hidden>
      <div className="ai-skeleton w-11/12" />
      <div className="ai-skeleton w-9/12" />
      <div className="ai-skeleton w-10/12" />
    </div>
  );
}

/** گفت‌وگو: حباب کاربر سرمه‌ای، حباب دستیار سفید با حاشیه‌ی نارنجی. */
export function ChatLog({
  turns,
  live,
  empty,
}: {
  turns: { role: 'user' | 'assistant'; content: string }[];
  live?: boolean;
  empty?: ReactNode;
}) {
  return (
    <div className="max-h-96 space-y-2.5 overflow-y-auto rounded-xl bg-slate-50 p-3" aria-live="polite">
      {turns.length === 0 && empty && <Bubble role="assistant">{empty}</Bubble>}
      {turns.map((t, i) => (
        <Bubble key={i} role={t.role}>
          {t.content}
        </Bubble>
      ))}
      {live && (
        <Bubble role="assistant">
          <span className="ai-typing" aria-label="در حال نوشتن">
            <span />
            <span />
            <span />
          </span>
        </Bubble>
      )}
    </div>
  );
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: ReactNode }) {
  return (
    <div className={cx('flex', role === 'user' ? 'justify-start' : 'justify-end')}>
      <div
        className={cx(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-7',
          role === 'user'
            ? 'rounded-ss-md bg-navy-900 text-white'
            : 'rounded-se-md border border-brand-200 bg-white text-navy-900',
        )}
      >
        {children}
      </div>
    </div>
  );
}

export const AI_DISCLAIMER =
  'سامانه پیشنهاد و شواهد تصمیم را فراهم می‌کند؛ تصمیم نهایی با مدیر پاسخ‌گو است.';
