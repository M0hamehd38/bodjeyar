'use client';

/**
 * ایجنت مالی — «Agent as a Service» بودجه‌یار.
 *
 * مأموریت‌های آماده کار چندمرحله‌ای مدیر مالی، حسابدار و مدیر کسب‌وکار را با یک
 * کلیک جلو می‌برند (بستن ماه، گزارش مدیریتی، تدوین بودجه، وصول و پرداخت، کاهش
 * هزینه، حقوق، پیش‌بینی، انحراف). ایجنت داده را خودش می‌خواند و پیشنهادهایش
 * در «صندوق پیشنهادها» منتظر تأیید آدم می‌ماند.
 */

import Link from 'next/link';
import { useState } from 'react';
import { AgentChat, ProposalCard } from '@/components/agent-chat';
import { AiChip } from '@/components/ai-assist';
import { DashboardHero, PeriodSelect } from '@/components/budget';
import { Icon } from '@/components/icons';
import { Alert, Badge, Card, CardHeader, EmptyState, Segmented } from '@/components/ui';
import { TIER_INFO } from '@/lib/ai-purposes';
import { useTier } from '@/lib/ai';
import { MISSIONS } from '@/lib/agent';
import { compact, fa } from '@/lib/format';
import { usePeriod } from '@/lib/store';

export default function AgentPage() {
  const { data, ai, ledger: L, period: p, can } = usePeriod();
  const tier = useTier('agent');
  const [ask, setAsk] = useState<{ id: number; text: string; label: string } | null>(null);
  const [box, setBox] = useState<'pending' | 'applied' | 'tasks'>('pending');

  const pending = data.proposals.filter((x) => x.status === 'pending');
  const applied = data.proposals.filter((x) => x.status !== 'pending');
  const tasks = data.proposals.filter((x) => x.kind === 'task' && x.status === 'applied');
  const months = p ? L.monthsWithActual(p).length : 0;
  const openRec = data.accounts.filter((a) => a.kind === 'receivable' && a.status !== 'settled').reduce((s, a) => s + BigInt(a.amount) - BigInt(a.settled || '0'), 0n);

  return (
    <>
      <DashboardHero
        badge="Agent as a Service"
        title="ایجنت مالی بودجه‌یار"
        subtitle="مدیر مالی، حسابدار و مشاور کسب‌وکار شما — داده را خودش می‌خواند، تحلیل می‌کند و پیشنهاد می‌دهد؛ تصمیم و تأیید با شماست."
        stats={[
          { label: 'ماه دارای عملکرد', value: fa(months) },
          { label: 'سند خوانا برای ایجنت', value: fa(data.entries.length) },
          { label: 'مطالبات باز', value: compact(openRec) },
          { label: 'پیشنهاد منتظر تأیید', value: fa(pending.length) },
        ]}
        actions={<PeriodSelect />}
      />

      {!ai.on && (
        <Alert tone="info" className="mb-6" title="درگاه هوش مصنوعی وصل نیست">
          ایجنت با همان دو مدل «هوش سازمانی» کار می‌کند: <b>مدل دقیق</b> (<span dir="ltr">GPT-5.6-Luna</span>) و <b>مدل روزمره</b> (<span dir="ltr">DeepSeek-V4-Flash</span>) از درگاه آروان. کلیدها را در <span dir="ltr">.env.local</span> سرور بگذارید (نمونه در <span dir="ltr">.env.example</span>). همه‌ی بخش‌های دیگر بدون آن کار می‌کنند.
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              icon={<Icon.kanban size={16} />}
              title="مأموریت‌های آماده"
              subtitle="هر مأموریت یک کار چندمرحله‌ای کامل است؛ ایجنت ابزارهای لازم را خودش صدا می‌زند."
              action={<AiChip>{TIER_INFO[tier].label}</AiChip>}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {MISSIONS.map((m) => {
                const I = Icon[m.icon];
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={!ai.on}
                    onClick={() => setAsk({ id: Date.now(), text: m.prompt, label: `مأموریت: ${m.title}` })}
                    className="group flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3.5 text-start transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-brand-400">
                      <I size={18} />
                    </span>
                    <span className="text-sm font-bold text-navy-900">{m.title}</span>
                    <span className="text-[11px] text-slate-500">ویژه‌ی {m.who}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <AgentChat
            purpose="agent"
            ask={ask}
            storageKey="agent"
            title="گفت‌وگو با ایجنت"
            context="کاربر در صفحه‌ی اصلی ایجنت است و می‌تواند هر کار مالی بخواهد؛ برای کارهای چندمرحله‌ای چند ابزار را پشت‌سرهم بخوان و در پایان پیشنهادهای مشخص بساز."
            suggestions={[
              'شش ماه اول را برای من خلاصه کن: سود، بزرگ‌ترین هزینه‌ها و روند درآمد',
              'پیش‌نویس بودجه‌ی شش‌ماهه دوم را بررسی و اصلاح پیشنهاد بده',
              'برنامه‌ی وصول مطالبات و پرداخت بدهی‌ها را بچین',
              'کیفیت داده را کنترل کن و کارهای مانده را فهرست کن',
            ]}
          />
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader icon={<Icon.inbox size={16} />} title="صندوق پیشنهادها" subtitle="هیچ پیشنهادی بدون تأیید شما اعمال نمی‌شود." />
            <div className="mb-3">
              <Segmented
                label="صندوق"
                value={box}
                onChange={setBox}
                options={[
                  { value: 'pending', label: `منتظر (${fa(pending.length)})` },
                  { value: 'tasks', label: `کارها (${fa(tasks.length)})` },
                  { value: 'applied', label: 'سابقه' },
                ]}
              />
            </div>
            <div className="max-h-[70vh] space-y-2 overflow-y-auto">
              {(box === 'pending' ? pending : box === 'tasks' ? tasks : applied).map((x) => (
                <ProposalCard key={x.id} p={x} />
              ))}
              {(box === 'pending' ? pending : box === 'tasks' ? tasks : applied).length === 0 && (
                <EmptyState title={box === 'pending' ? 'پیشنهاد بازی نیست' : box === 'tasks' ? 'کاری ثبت نشده' : 'سابقه‌ای نیست'}>
                  {box === 'pending' ? 'یکی از مأموریت‌ها را اجرا کنید تا پیشنهادها اینجا بیایند.' : ''}
                </EmptyState>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon={<Icon.settings size={16} />} title="مدل‌ها" subtitle="همان دو مدل «هوش سازمانی»" action={can('settings') ? <Link href="/settings?tab=ai" className="text-xs text-brand-700 hover:underline">تنظیم برای هر کار</Link> : undefined} />
            <ul className="space-y-2 text-sm">
              {(['precise', 'everyday'] as const).map((t) => (
                <li key={t} className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <div>
                    <div className="font-bold text-navy-900">{TIER_INFO[t].label}</div>
                    <div className="text-[11px] text-slate-500" dir="ltr">
                      {ai.tiers?.[t]?.model ?? '—'}
                    </div>
                  </div>
                  <Badge tone={ai.tiers?.[t]?.on ? 'ok' : 'neutral'}>{ai.tiers?.[t]?.on ? 'وصل' : 'خاموش'}</Badge>
                </li>
              ))}
            </ul>
            {ai.provider && <p className="mt-2 text-[11px] text-slate-400">سرویس‌دهنده: {ai.provider === 'arvan' ? 'درگاه هوش مصنوعی آروان' : ai.provider === 'anthropic' ? 'Anthropic Claude' : 'OpenAI'}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
