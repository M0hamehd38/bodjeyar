'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { Loading } from '@/components/ui';
import { useStore } from '@/lib/store';

/** پوسته‌ی بخش واردشده: بدون نشست معتبر به صفحه‌ی ورود می‌رود. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { ready, me } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (ready && !me) router.replace('/login');
  }, [ready, me, router]);

  if (!ready || !me)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading label="در حال باز کردن بودجه‌یار…" />
      </div>
    );

  return <AppShell>{children}</AppShell>;
}
