'use client';

import { useStore } from '@/lib/store';

const DOT = { ok: 'bg-emerald-400', bad: 'bg-rose-400', info: 'bg-brand-400' } as const;

/** پیام کوتاه پایین صفحه — کارت سرمه‌ای با نقطه‌ی رنگ نتیجه. */
export function Toasts() {
  const { toasts } = useStore();
  return (
    <div
      className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex w-max max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col items-center gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'bad' ? 'alert' : 'status'}
          className="flex items-center gap-2.5 rounded-xl bg-navy-900 px-4 py-2.5 text-sm text-white shadow-lift ring-1 ring-white/10 [animation:toast-in_.2s_ease-out]"
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[t.kind]}`} />
          {t.msg}
        </div>
      ))}
    </div>
  );
}
