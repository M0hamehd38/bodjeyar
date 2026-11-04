'use client';

/**
 * پوسته‌ی رابط — همان نوار کناری سرمه‌ای «میز کار سازمانی» و «ارزشیابی»:
 * گروه‌ها زنجیره‌ی کار بودجه‌اند (برنامه → عملکرد → تحلیل → مدیریت) تا کاربر
 * بداند هر بخش کجای کار است.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrandMark } from '@/components/brand';
import { Icon, type IconName } from '@/components/icons';
import { PageAssistant } from '@/components/page-assistant';
import { brand } from '@/lib/brand';
import { fa, MONTHS, todayFa } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/ledger';
import { useStore } from '@/lib/store';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
        <BrandMark size={30} />
      </span>
      <div className="leading-tight">
        <div className="text-[15px] font-extrabold text-white">
          <span className="text-brand-400">سایپا</span> استوار
        </div>
        <div className="mt-0.5 text-[11px] font-medium text-slate-400">{brand.product}</div>
      </div>
    </Link>
  );
}

/** نوارهای مورب نارنجی پوستر رسمی — تزئین گوشه‌ی نوار کناری */
function SidebarAccent() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute -left-10 top-0 h-40 w-40 opacity-90" viewBox="0 0 160 160">
      <path d="M40 -10 L170 120" stroke="#FF7900" strokeWidth="10" />
      <path d="M70 -10 L170 90" stroke="#FF7900" strokeWidth="3" opacity="0.6" />
    </svg>
  );
}

function Sidebar({ groups, pathname, onNavigate }: { groups: NavGroup[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="relative flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="منوی اصلی">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="mb-1.5 px-3 text-[11px] font-bold tracking-wide text-slate-400/80">{g.title}</div>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = isActive(pathname, item.href);
              const I = Icon[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                      active ? 'bg-white/[0.08] font-bold text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {active && <span className="absolute -right-3 top-1.5 bottom-1.5 w-1 rounded-l-full bg-brand-500" />}
                    <span className={active ? 'text-brand-400' : 'text-slate-400 group-hover:text-slate-200'}>
                      <I size={18} />
                    </span>
                    {item.label}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="ms-auto rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                        {fa(item.badge)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** زنگ اعلان: نسخه‌های منتظر تأیید (برای مدیر) و ماه‌های بی‌عملکرد (برای حسابدار). */
function NotificationBell() {
  const { ledger, can, pid } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const items: { title: string; body: string; href: string }[] = [];
  if (can('approve'))
    for (const v of ledger.d.versions.filter((x) => x.status === 'submitted'))
      items.push({
        title: 'نسخه‌ی منتظر تأیید',
        body: `${ledger.periodById(v.period_id)?.title ?? ''} — ارسال ${v.submitted_by ?? ''}`,
        href: '/budget',
      });
  const p = ledger.periodById(pid);
  if (p && can('actual') && ledger.activeV(p.id)) {
    const miss = ledger.missingMonths(p);
    if (miss.length)
      items.push({
        title: 'عملکرد ثبت‌نشده',
        body: `${miss.map((m) => MONTHS[m.jm - 1]).join('، ')} — ${p.title}`,
        href: '/actual',
      });
  }

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`اعلان‌ها${items.length ? ` — ${fa(items.length)} مورد` : ''}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <Icon.bell size={19} />
        {items.length > 0 && (
          <span className="absolute -top-0.5 left-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {fa(items.length)}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-40 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">اعلان‌ها</div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">اعلانی ندارید.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((n, i) => (
                <li key={i}>
                  <Link href={n.href} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-slate-50">
                    <div className="text-sm font-medium text-slate-800">{n.title}</div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{n.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { me, data, ledger, can, logout } = useStore();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [pathname]);
  if (!me) return null;

  const pending = can('approve') ? ledger.pendingCount() : 0;
  const proposals = data.proposals.filter((p) => p.status === 'pending').length;
  const groups: NavGroup[] = [
    {
      title: 'هوش مصنوعی',
      items: [{ href: '/agent', label: 'ایجنت مالی', icon: 'sparkles', badge: proposals }],
    },
    {
      title: 'برنامه',
      items: [
        { href: '/', label: 'داشبورد', icon: 'home' },
        { href: '/budget', label: 'بودجه‌ریزی و تأیید', icon: 'table', badge: pending },
        { href: '/revisions', label: 'اصلاحیه بودجه', icon: 'archive' },
        { href: '/investment', label: 'سرمایه‌گذاری', icon: 'target' },
      ],
    },
    {
      title: 'عملکرد و تحلیل',
      items: [
        { href: '/actual', label: 'عملکرد واقعی', icon: 'pulse' },
        { href: '/entries', label: 'ریز اسناد', icon: 'list' },
        { href: '/variance', label: 'گزارش انحراف', icon: 'alert' },
        { href: '/reports', label: 'گزارش‌ها', icon: 'chart' },
      ],
    },
    {
      title: 'حساب‌ها و نیرو',
      items: [
        { href: '/accounts', label: 'مطالبات و بدهی‌ها', icon: 'inbox' },
        { href: '/staff', label: 'پرسنل و حقوق', icon: 'users' },
      ],
    },
    {
      title: 'مدیریت',
      items: [{ href: '/settings', label: 'تنظیمات', icon: 'settings' }],
    },
  ];
  const current = groups.flatMap((g) => g.items).find((i) => isActive(pathname, i.href));

  const userCard = (
    <div className="relative border-t border-white/10 p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <Link href="/settings?tab=me" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg transition hover:opacity-80">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
            {(me.full_name || me.username).trim().charAt(0)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-white">{me.full_name || me.username}</span>
            <span className="block truncate text-xs text-slate-400">{ROLE_LABEL[me.role]}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={logout}
          aria-label="خروج"
          title="خروج"
          className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          <Icon.logout size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pr-64 print:pr-0">
      <a
        href="#main-content"
        className="fixed start-4 top-2 z-50 -translate-y-16 rounded-lg bg-brand-700 px-4 py-2 text-sm text-white focus:translate-y-0"
      >
        رفتن به محتوای اصلی
      </a>
      {/* نوار کناری دسکتاپ — سمت راست چون صفحه راست‌به‌چپ است */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 flex-col overflow-hidden bg-navy-900 lg:flex print:hidden">
        <SidebarAccent />
        <div className="relative px-5 pb-4 pt-6">
          <Logo />
        </div>
        <Sidebar groups={groups} pathname={pathname} />
        {userCard}
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-navy-900/50 backdrop-blur-[2px]" onClick={() => setDrawer(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 right-0 flex w-72 max-w-[85%] flex-col overflow-hidden bg-navy-900 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-5">
              <Logo />
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="بستن منو"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <Icon.close size={20} />
              </button>
            </div>
            <Sidebar groups={groups} pathname={pathname} onNavigate={() => setDrawer(false)} />
            {userCard}
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="باز کردن منو"
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Icon.menu size={22} />
          </button>
          <div className="min-w-0 truncate text-sm text-slate-500">
            <span className="hidden sm:inline">{data.org.name}</span>
            {current !== undefined && (
              <>
                <span className="mx-2 hidden text-slate-300 sm:inline">/</span>
                <span className="font-bold text-navy-900">{current.label}</span>
              </>
            )}
          </div>
          <div className="mr-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
              <Icon.calendar size={15} />
              امروز {todayFa()}
            </span>
            <NotificationBell />
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
      <PageAssistant />
    </div>
  );
}
