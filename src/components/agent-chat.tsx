'use client';

/**
 * گفت‌وگو با ایجنت مالی — همان الگوی «از دستیار بپرسید» در ارزشیابی: هر پاسخ نشان
 * می‌دهد ایجنت کدام داده‌ها را خواند، و پیشنهادهایش کارت‌هایی‌اند که فقط با
 * «اعمال» کاربر چیزی را تغییر می‌دهند.
 */

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AiButton, AiChip } from '@/components/ai-assist';
import { Icon } from '@/components/icons';
import { Alert, Badge, Button, cx } from '@/components/ui';
import { aiErrText, useTier } from '@/lib/ai';
import type { AiPurpose } from '@/lib/ai-purposes';
import { runAgent, TOOL_LABELS, type AgentStep, type AgentTurn } from '@/lib/agent';
import { B, clone, compact, fa, mkLabel, nowIso } from '@/lib/format';
import { TYPE_LABEL, varId } from '@/lib/ledger';
import { useStore } from '@/lib/store';
import type { AgentProposal, LineType, Version } from '@/lib/types';

/* ------------------------------ متن پاسخ ------------------------------ */

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <b key={i} className="font-bold text-navy-900">
        {part.slice(2, -2)}
      </b>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/** Markdown سبک: سرتیتر کوتاه، فهرست با «- » یا عدد، و پررنگ. */
export function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={`u${out.length}`} className="my-1.5 list-disc space-y-1 pe-1 ps-5">{list}</ul>);
    list = [];
  };
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (!t) return flush();
    const h = t.match(/^#{1,4}\s+(.*)$/);
    const li = t.match(/^(?:[-•*]|\d+[.)]|[۰-۹]+[.)])\s+(.*)$/);
    if (h) {
      flush();
      out.push(<p key={i} className="mt-2 font-bold text-navy-900">{inline(h[1]!)}</p>);
    } else if (li) list.push(<li key={i}>{inline(li[1]!)}</li>);
    else {
      flush();
      out.push(<p key={i} className="my-1">{inline(t)}</p>);
    }
  });
  flush();
  return <div className="text-sm leading-7 text-slate-800">{out}</div>;
}

/* ------------------------------ اعمال پیشنهاد ------------------------------ */

export function useProposals() {
  const { data, repo, can, toast, errMsg, me, ledger } = useStore();

  const canApply = (p: AgentProposal) =>
    p.kind === 'budget_line' ? can('edit_budget') : p.kind === 'variance_note' ? can('variance') : p.kind === 'account_followup' ? can('actual') || can('approve') : true;

  const decide = useCallback(
    async (p: AgentProposal, apply: boolean) => {
      try {
        if (apply) {
          const pl = p.payload as Record<string, unknown>;
          if (p.kind === 'budget_line') {
            const v0 = data.versions.find((x) => x.id === pl.version_id);
            if (!v0 || !['draft', 'rejected'].includes(v0.status)) throw { user: 'نسخه‌ی پیش‌نویس این پیشنهاد دیگر قابل ویرایش نیست.' };
            const v: Version = clone(v0);
            for (const ch of pl.changes as { type: LineType; key: string; months: number[] }[]) {
              const months = ch.months.map((x) => String(Math.max(0, Math.round(x))));
              if (ch.type === 'revenue') {
                const r = v.revenue.find((x) => x.center === ch.key);
                if (r) r.months = months;
                else v.revenue.push({ center: ch.key, months });
              } else if (ch.type === 'expense') {
                const [head, center] = ch.key.split('|') as [string, string];
                const r = v.expense.find((x) => x.head === head && x.center === center);
                if (r) r.months = months;
                else v.expense.push({ head, center, months });
              } else {
                const monthly = months[0] || '0';
                const r = v.payroll.find((x) => x.center === ch.key);
                const others = r ? (['overtime', 'benefits', 'bonus', 'insurance', 'eidi', 'other'] as const).reduce((s, k) => s + B(r[k]), 0n) : 0n;
                const base = String(B(monthly) - others > 0n ? B(monthly) - others : B(monthly));
                if (r) {
                  r.base = base;
                  if (B(monthly) - others <= 0n) (['overtime', 'benefits', 'bonus', 'insurance', 'eidi', 'other'] as const).forEach((k) => (r[k] = '0'));
                } else v.payroll.push({ center: ch.key, headcount: '0', base: monthly, overtime: '0', benefits: '0', bonus: '0', insurance: '0', eidi: '0', other: '0' });
              }
            }
            v.ai_assumptions = [...(v.ai_assumptions || []), `پیشنهاد ایجنت اعمال شد: ${p.title}`];
            await repo.saveVersion(v);
          } else if (p.kind === 'variance_note') {
            const month = String(pl.month);
            const type = pl.type as LineType;
            const key = String(pl.key);
            const label = type === 'revenue' || type === 'payroll' ? ledger.cName(key) : ledger.hName(key.split('|')[0]);
            await repo.saveVariance({
              id: varId({ m: { jy: +month.slice(0, 4), jm: +month.slice(5), k: month, i: 0 }, type, key }),
              month, type, key, label, reason: String(pl.reason), action: String(pl.action), comment: String(pl.comment || ''), ai: true,
            });
          } else if (p.kind === 'account_followup') {
            const acc = data.accounts.find((x) => x.id === pl.account_id);
            if (!acc) throw { user: 'این حساب دیگر وجود ندارد.' };
            await repo.saveAccount({ ...acc, followup: String(pl.plan) });
          }
        }
        await repo.saveProposal({ ...p, status: apply ? 'applied' : 'dismissed', decided_by: me?.username, decided_at: nowIso() });
        toast(apply ? 'پیشنهاد اعمال شد.' : 'پیشنهاد کنار گذاشته شد.', apply ? 'ok' : 'info');
      } catch (e) {
        toast(errMsg(e), 'bad');
      }
    },
    [data, repo, toast, errMsg, me, ledger],
  );
  return { decide, canApply };
}

const KIND: Record<AgentProposal['kind'], { label: string; href: string }> = {
  budget_line: { label: 'تغییر بودجه', href: '/budget' },
  variance_note: { label: 'علت انحراف', href: '/variance' },
  account_followup: { label: 'پیگیری حساب', href: '/accounts' },
  task: { label: 'کار تیم', href: '/agent' },
};

export function ProposalCard({ p }: { p: AgentProposal }) {
  const { decide, canApply } = useProposals();
  const { ledger } = useStore();
  const [busy, setBusy] = useState(false);
  const pl = p.payload as Record<string, unknown>;
  const changes = p.kind === 'budget_line' ? (pl.changes as { type: LineType; key: string; months: number[]; reason?: string }[]) : [];
  const go = async (apply: boolean) => {
    setBusy(true);
    await decide(p, apply);
    setBusy(false);
  };
  return (
    <div className={cx('rounded-xl border bg-white p-3', p.status === 'pending' ? 'border-brand-200' : 'border-slate-200 opacity-80')}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={p.status === 'pending' ? 'severe' : p.status === 'applied' ? 'ok' : 'neutral'}>
          {p.status === 'pending' ? 'منتظر تأیید' : p.status === 'applied' ? 'اعمال‌شده' : 'کنار گذاشته'}
        </Badge>
        <span className="text-xs text-slate-500">{KIND[p.kind].label}</span>
        <b className="text-sm text-navy-900">{p.title}</b>
      </div>
      {p.detail && <p className="mt-1.5 whitespace-pre-line text-xs leading-6 text-slate-600">{p.detail}</p>}
      {changes.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {changes.slice(0, 12).map((c, i) => (
            <li key={i} className="flex flex-wrap gap-x-2">
              <span className="text-slate-400">{TYPE_LABEL[c.type]}</span>
              <b className="text-navy-900">
                {c.type === 'expense' ? `${ledger.hName(c.key.split('|')[0])} / ${ledger.cName(c.key.split('|')[1])}` : ledger.cName(c.key)}
              </b>
              <span>ماهانه {[...new Set(c.months)].map((x) => compact(BigInt(Math.round(x)))).join(' / ')}</span>
              {c.reason && <span className="text-slate-400">— {c.reason}</span>}
            </li>
          ))}
          {changes.length > 12 && <li className="text-slate-400">و {fa(changes.length - 12)} ردیف دیگر…</li>}
        </ul>
      )}
      {p.kind === 'task' && (
        <p className="mt-1 text-[11px] text-slate-400">
          مسئول: {pl.owner === 'manager' ? 'مدیر مجموعه' : 'حسابدار'}
          {pl.due ? ` · مهلت ${fa(String(pl.due))}` : ''}
        </p>
      )}
      {p.status === 'pending' && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {canApply(p) ? (
            <Button size="sm" variant="primary" disabled={busy} onClick={() => void go(true)}>
              <Icon.check size={14} />
              {p.kind === 'task' ? 'قبول در فهرست کار' : 'اعمال'}
            </Button>
          ) : (
            <span className="text-xs text-slate-500">اعمال با نقش {p.kind === 'budget_line' || p.kind === 'variance_note' ? 'حسابدار' : 'مسئول'} است.</span>
          )}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void go(false)}>
            رد
          </Button>
          <Link href={KIND[p.kind].href} className="text-xs text-brand-700 hover:underline">
            رفتن به بخش
          </Link>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ گفت‌وگو ------------------------------ */

function stepLabel(s: AgentStep) {
  const extra = [s.args.query, s.args.month && mkLabel(String(s.args.month)), s.args.kind === 'receivable' ? 'دریافتنی' : s.args.kind === 'payable' ? 'پرداختنی' : null, s.args.unit, s.args.by === 'center' ? 'به تفکیک مرکز' : null]
    .filter(Boolean)
    .map(String);
  return `${TOOL_LABELS[s.tool] ?? s.tool}${extra.length ? ` — ${extra.join('، ')}` : ''}`;
}

export function AgentChat({
  purpose = 'assistant',
  context,
  suggestions,
  placeholder,
  ask,
  allowWrite = true,
  title,
  subtitle,
  bare,
  storageKey,
}: {
  purpose?: AiPurpose;
  context?: string;
  suggestions: string[];
  placeholder?: string;
  /** درخواست بیرونی (مأموریت): هر بار id عوض شود ارسال می‌شود */
  ask?: { id: number; text: string; label?: string } | null;
  allowWrite?: boolean;
  title?: string;
  subtitle?: string;
  bare?: boolean;
  storageKey?: string;
}) {
  const { data, pid, me, ai, repo } = useStore();
  const tier = useTier(purpose);
  const [turns, setTurns] = useState<(AgentTurn & { label?: string })[]>(() => {
    if (!storageKey) return [];
    try {
      return JSON.parse(sessionStorage.getItem(`budgetyar.chat.${storageKey}`) || '[]') as AgentTurn[];
    } catch {
      return [];
    }
  });
  const [q, setQ] = useState('');
  const [live, setLive] = useState<AgentStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ctl = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastAsk = useRef<number | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(`budgetyar.chat.${storageKey}`, JSON.stringify(turns.slice(-12)));
    } catch {
      /* */
    }
  }, [turns, storageKey]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [turns.length, live.length, busy]);

  const send = useCallback(
    async (text: string, label?: string) => {
      const question = text.trim();
      if (!question || ctl.current) return;
      const c = new AbortController();
      ctl.current = c;
      setBusy(true);
      setError('');
      setLive([]);
      try {
        const { turn, proposals } = await runAgent({
          data, pid, user: me?.username || 'system', tier, question, history: turns, context, allowWrite, signal: c.signal,
          onStep: (s) => setLive((x) => [...x, s]),
        });
        for (const p of proposals) await repo.saveProposal(p);
        setTurns((x) => [...x, { ...turn, label }]);
        setQ('');
      } catch (e) {
        if ((e as Error)?.name !== 'AbortError') setError(aiErrText((e as { code?: string })?.code));
      } finally {
        ctl.current = null;
        setBusy(false);
        setLive([]);
      }
    },
    [data, pid, me, tier, turns, context, allowWrite, repo],
  );

  useEffect(() => {
    if (ask && ask.id !== lastAsk.current) {
      lastAsk.current = ask.id;
      void send(ask.text, ask.label);
    }
  }, [ask, send]);

  if (!ai.on)
    return (
      <Alert tone="info" title="دستیار هوش مصنوعی خاموش است">
        برای روشن شدن، کلید درگاه هوش مصنوعی (همان کلیدهای «هوش سازمانی»: <span dir="ltr">ARVAN_AI_API_KEY</span> و در صورت تمایل کلید جدای مدل دقیق و روزمره) را در فایل <span dir="ltr">.env.local</span> سرور بگذارید. بقیه‌ی برنامه بدون آن کامل کار می‌کند.
      </Alert>
    );

  const body = (
    <div className="space-y-4">
      {turns.length === 0 && !busy && (
        <div>
          <p className="mb-2 text-xs text-slate-500">برای شروع یکی را امتحان کنید:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-start text-xs text-slate-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-navy-900"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {turns.map((t, i) => (
        <div key={i} className="space-y-2.5">
          <div className="flex justify-start">
            <p className="max-w-[88%] whitespace-pre-line rounded-2xl rounded-ss-md bg-navy-900 px-4 py-2 text-sm leading-7 text-white">{t.label || t.question}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="ai-badge mt-1 h-7 w-7 shrink-0">
              <Icon.sparkles size={14} />
            </span>
            <div className="min-w-0 max-w-[94%] flex-1 rounded-2xl rounded-se-md border border-brand-200 bg-white px-4 py-2.5">
              <RichText text={t.answer} />
              {t.steps.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2">
                  <span className="text-[11px] text-slate-400">خواند:</span>
                  {t.steps.map((s, j) => (
                    <span key={j} title={s.error} className={cx('ai-chip', !s.ok && 'opacity-50 line-through')}>
                      {stepLabel(s)}
                    </span>
                  ))}
                </div>
              )}
              {t.proposals.length > 0 && (
                <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5">
                  {t.proposals
                    .map((id) => data.proposals.find((p) => p.id === id))
                    .filter((p): p is AgentProposal => !!p)
                    .map((p) => (
                      <ProposalCard key={p.id} p={p} />
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {busy && (
        <div className="flex items-start gap-2">
          <span className="ai-badge mt-1 h-7 w-7 shrink-0">
            <Icon.sparkles size={14} />
          </span>
          <div className="rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-xs text-brand-800">
            <span className="flex items-center gap-2">
              <span className="ai-typing" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              {live.length ? 'در حال خواندن داده‌ها و تحلیل…' : 'در حال برنامه‌ریزی…'}
              <button type="button" onClick={() => ctl.current?.abort()} className="text-slate-500 underline-offset-4 hover:underline">
                توقف
              </button>
            </span>
            {live.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {live.map((s, j) => (
                  <span key={j} className={cx('ai-chip', !s.ok && 'opacity-50 line-through')}>
                    {stepLabel(s)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <div ref={endRef} />

      {error && <Alert tone="danger">{error}</Alert>}

      <form
        className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-500/10"
        onSubmit={(e) => {
          e.preventDefault();
          void send(q);
        }}
      >
        <textarea
          aria-label="پرسش از ایجنت"
          rows={1}
          maxLength={3000}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(q);
            }
          }}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-900 placeholder:text-slate-400 focus:outline-none"
          placeholder={placeholder || (turns.length ? 'پرسش بعدی…' : 'هر چه درباره‌ی وضعیت مالی می‌خواهید بپرسید…')}
        />
        <AiButton type="submit" pending={busy} disabled={!q.trim() || busy} aria-label="بپرس">
          بپرس
        </AiButton>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>نام پرسنل پیش از ارسال حذف می‌شود؛ ایجنت چیزی را بدون تأیید شما تغییر نمی‌دهد.</span>
        {turns.length > 0 && (
          <button type="button" className="hover:text-slate-600" onClick={() => setTurns([])}>
            پاک کردن گفت‌وگو
          </button>
        )}
      </div>
    </div>
  );

  if (bare) return body;
  return (
    <section className="ai-surface no-print p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="ai-badge h-9 w-9">
          <Icon.sparkles size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-bold text-navy-900">
            {title || 'از ایجنت مالی بپرسید'}
            <AiChip>{tier === 'precise' ? 'مدل دقیق' : 'مدل روزمره'}</AiChip>
          </h2>
          <p className="mt-0.5 text-xs leading-6 text-slate-600">
            {subtitle || 'ایجنت خودش سراغ داده‌ی لازم می‌رود — سود و زیان، ریز اسناد، حقوق، قبوض، مطالبات و بودجه — و با عدد جواب می‌دهد.'}
          </p>
        </div>
      </div>
      {body}
    </section>
  );
}
