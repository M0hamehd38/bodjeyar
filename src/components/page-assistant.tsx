'use client';

/**
 * دستیار هر صفحه — دکمه‌ی شناور «دستیار» در همه‌ی بخش‌ها.
 *
 * همان ایجنت مالی است با زمینه و پیشنهادهای مخصوص همان صفحه؛ یعنی در «عملکرد
 * واقعی» درباره‌ی ثبت و کنترل ماه می‌پرسد، در «مطالبات» درباره‌ی وصول، در
 * «بودجه‌ریزی» درباره‌ی ارقام پیش‌نویس و … . گفت‌وگوی هر صفحه جدا می‌ماند.
 */

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AgentChat } from '@/components/agent-chat';
import { Icon } from '@/components/icons';
import { useStore } from '@/lib/store';

interface PageAi {
  title: string;
  context: string;
  suggestions: string[];
}

export const PAGE_AI: Record<string, PageAi> = {
  '/': {
    title: 'دستیار داشبورد',
    context: 'کاربر در داشبورد مدیریتی است و تصویر کلی وضعیت مالی را می‌خواهد.',
    suggestions: ['وضعیت مالی شش ماه اول را در پنج خط خلاصه کن', 'سودآورترین و زیان‌ده‌ترین واحد کدام است؟', 'چرا نتیجه‌ی خرداد و مرداد ضعیف‌تر بود؟', 'سه ریسک مهم الان چیست؟'],
  },
  '/budget': {
    title: 'دستیار بودجه‌ریزی',
    context: 'کاربر در بخش بودجه‌ریزی است؛ پیش‌نویس بودجه را می‌بیند و می‌خواهد ارقامش را منطقی کند یا برای تأیید آماده کند.',
    suggestions: ['پیش‌نویس بودجه‌ی شش‌ماهه دوم را با عملکرد شش ماه اول مقایسه کن', 'کدام ردیف‌های پیش‌نویس غیرواقعی‌اند؟ اصلاحشان را پیشنهاد بده', 'برای اسفند (فصل فروش) درآمد کمیسیون را چطور ببینیم؟', 'بودجه‌ی حقوق با ۲۵٪ افزایش سالانه چقدر می‌شود؟'],
  },
  '/revisions': {
    title: 'دستیار اصلاحیه',
    context: 'کاربر در بخش اصلاحیه‌ی بودجه است و می‌خواهد بداند کدام ارقام بودجه باید اصلاح شود.',
    suggestions: ['کدام ردیف‌ها بیشترین فاصله را با روند واقعی دارند؟', 'دلیل مستند برای اصلاحیه‌ی هزینه‌ها بنویس'],
  },
  '/investment': {
    title: 'دستیار سرمایه‌گذاری',
    context: 'کاربر در بخش سرمایه‌گذاری است: خریدهای سرمایه‌ای انجام‌شده و پروژه‌های بودجه.',
    suggestions: ['خریدهای سرمایه‌ای شش ماه اول را به تفکیک واحد تحلیل کن', 'بازده دستگاه شارژ کولر و دستگاه صافکاری را چطور بسنجیم؟', 'اولویت سرمایه‌گذاری شش ماه دوم چه باشد؟'],
  },
  '/actual': {
    title: 'دستیار ثبت عملکرد',
    context: 'کاربر در بخش عملکرد واقعی است؛ ثبت ماهانه، قبوض و بستن ماه.',
    suggestions: ['کیفیت داده‌ی ماه‌های ثبت‌شده را کنترل کن', 'کدام قبوض تخصیص دقیق به واحد ندارند؟', 'هزینه‌های غیرعادی شهریور نسبت به مرداد چیست؟', 'برای بستن ماه چه کارهایی مانده؟'],
  },
  '/entries': {
    title: 'دستیار ریز اسناد',
    context: 'کاربر در «ریز اسناد» است: هر ردیف فایل حسابداری با شرح اصلی.',
    suggestions: ['ده هزینه‌ی بزرگ غیرحقوقی چه بودند؟', 'هزینه‌های پذیرایی و ناهار در کدام واحد بیشتر است؟', 'ردیف‌های تکراری یا مشکوک پیدا کن', 'مالیات و عوارض چقدر و در چه ماه‌هایی بود؟'],
  },
  '/staff': {
    title: 'دستیار حقوق و پرسنل',
    context: 'کاربر در بخش «پرسنل و حقوق» است: دفتر حقوق نفر به نفر و جمع واحدها.',
    suggestions: ['سهم حقوق از درآمد در هر ماه چقدر است؟', 'کدام ردیف‌های حقوق جمعشان با اجزا نمی‌خواند؟', 'اضافه‌کار و پاداش در کدام واحد بیشتر است؟', 'تفاوت دفتر حقوق با عدد حسابداری از کجاست؟'],
  },
  '/accounts': {
    title: 'دستیار مطالبات و بدهی‌ها',
    context: 'کاربر در بخش مطالبات و حساب‌های پرداختنی است و برنامه‌ی وصول و پرداخت می‌خواهد.',
    suggestions: ['برنامه‌ی وصول مطالبات باز را با اولویت پیشنهاد بده', 'بدهی به تأمین‌کنندگان قطعه چقدر متمرکز است؟', 'برنامه‌ی پرداخت ۸ هفته‌ای بدهی‌ها را بچین', 'برای مطالبات کارکنان چه سیاستی بگذاریم؟'],
  },
  '/variance': {
    title: 'دستیار انحراف',
    context: 'کاربر در گزارش انحراف بودجه است.',
    suggestions: ['مهم‌ترین انحراف‌ها را با علت محتمل توضیح بده', 'برای ردیف‌های قرمز علت و اقدام پیشنهاد بده'],
  },
  '/reports': {
    title: 'دستیار گزارش',
    context: 'کاربر در بخش گزارش‌ها است و گزارش برای مدیر یا هیئت‌مدیره می‌خواهد.',
    suggestions: ['گزارش یک‌صفحه‌ای برای هیئت‌مدیره بنویس', 'ترکیب درآمد را با شش ماه قبل مقایسه کن', 'سه شاخص کلیدی که هر ماه باید پایش شود چیست؟'],
  },
  '/settings': {
    title: 'دستیار تنظیمات',
    context: 'کاربر در تنظیمات است: ساختار مراکز و سرفصل‌ها، ورود اکسل، مدل‌های هوش مصنوعی.',
    suggestions: ['هشدارهای ورود فایل اکسل را توضیح بده و بگو چه باید کرد', 'ساختار مراکز هزینه برای این نمایندگی مناسب است؟'],
  },
};

export function PageAssistant() {
  const pathname = usePathname();
  const { ai } = useStore();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  if (pathname === '/agent' || pathname.startsWith('/agent/')) return null;
  const key = Object.keys(PAGE_AI)
    .filter((k) => (k === '/' ? pathname === '/' : pathname.startsWith(k)))
    .sort((a, b) => b.length - a.length)[0];
  const cfg = PAGE_AI[key ?? '/']!;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ai-btn no-print fixed bottom-5 left-5 z-30 shadow-lift"
        aria-label={cfg.title}
        title={ai.on ? cfg.title : 'دستیار هوش مصنوعی (خاموش)'}
      >
        دستیار
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={cfg.title}>
          <div className="absolute inset-0 bg-navy-900/30" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-full max-w-xl flex-col bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="ai-badge h-8 w-8">
                  <Icon.sparkles size={16} />
                </span>
                <div>
                  <div className="text-sm font-bold text-navy-900">{cfg.title}</div>
                  <div className="text-[11px] text-slate-500">ایجنت مالی بودجه‌یار — با داده‌های همین سامانه</div>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <Icon.close size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <AgentChat bare purpose="assistant" context={cfg.context} suggestions={cfg.suggestions} storageKey={`page${key}`} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
