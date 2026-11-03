'use client';

/**
 * سمت مرورگر دستیار هوش مصنوعی: فراخوانی /api/ai، پیام خطای فارسی، و هوک وضعیت
 * هر درخواست (در حال اجرا، خطا، توقف).
 */

import { useCallback, useRef, useState } from 'react';
import { fa, MONTHS, pad, today } from './format';
import { INV_STATUS, Ledger, monthsOf, PAY_FIELDS, V_STATUS, vLabel } from './ledger';
import type { Period } from './types';

const ERR: Record<string, string> = {
  rate_limited: 'سقف استفاده از هوش مصنوعی پر شده؛ کمی بعد دوباره امتحان کنید.',
  sampling_disabled: 'دستیار هوش مصنوعی روی این سرور فعال نیست (کلید API تنظیم نشده).',
  invalid_json: 'پاسخ هوش مصنوعی قابل خواندن نبود. دوباره امتحان کنید یا درخواست را کوتاه‌تر کنید.',
  prompt_too_large: 'داده این درخواست زیاد است؛ بازه یا تعداد ردیف را کمتر کنید.',
  refused: 'هوش مصنوعی به این درخواست پاسخ نداد.',
  empty_completion: 'پاسخی برنگشت؛ دوباره امتحان کنید.',
  image_rejected: 'یکی از تصاویر خوانده نشد (JPEG، PNG یا WebP تا ۲۰ مگابایت).',
};
export const aiErrText = (code?: string) => (code && ERR[code]) || 'ارتباط با هوش مصنوعی برقرار نشد؛ دوباره امتحان کنید.';

export interface AiRequest {
  /** دستور کار و داده‌ها؛ گفت‌وگو در messages می‌آید */
  system?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  json?: boolean;
  complex?: boolean;
  effort?: 'low' | 'medium' | 'high';
  images?: { media_type: string; data: string }[];
}

async function call(req: AiRequest, signal: AbortSignal): Promise<{ text?: string; json?: unknown }> {
  const r = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  const j = (await r.json().catch(() => ({}))) as { text?: string; json?: unknown; error?: string };
  if (!r.ok) throw { code: j.error };
  return j;
}

/** یک کار هوش مصنوعی با وضعیت مستقل. `run` در صورت خطا یا توقف null برمی‌گرداند. */
export function useAiTask() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ctl = useRef<AbortController | null>(null);

  const run = useCallback(async (req: AiRequest) => {
    if (ctl.current) return null;
    const c = new AbortController();
    ctl.current = c;
    setBusy(true);
    setError('');
    try {
      return await call(req, c.signal);
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setError(aiErrText((e as { code?: string })?.code));
      return null;
    } finally {
      ctl.current = null;
      setBusy(false);
    }
  }, []);
  const stop = useCallback(() => ctl.current?.abort(), []);
  return { run, stop, busy, error, setError };
}

export const AI_RULE_FA =
  'پاسخ را به فارسی ساده و محترمانه بنویس. مبالغ به تومان است. از سرتیتر Markdown و جدول استفاده نکن؛ در صورت نیاز فهرست با «- » بنویس. عدد را با جداکننده هزارگان و در صورت امکان به‌صورت «۱٫۲ میلیارد» یا «۴۵۰ میلیون» بگو. اگر داده کافی نیست صریح بگو و حدس را حدس بنام.';

export const toInt = (x: unknown) => {
  const n = Number(String(x ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};
export const toAmt = (x: unknown) => String(Math.round(toInt(x) / 1000) * 1000);

/* ---------- زمینه‌ی مشترک درخواست‌ها ---------- */

export function aiStructure(L: Ledger, p: Period) {
  return {
    organization: L.d.org.name,
    currency: 'toman (تومان)',
    period: p.title,
    months: monthsOf(p).map((m) => ({ index: m.i, name: `${MONTHS[m.jm - 1]} ${m.jy}` })),
    revenue_centers: L.revCenters().map((c) => ({ id: c.id, name: c.name })),
    cost_centers: L.costCenters().map((c) => ({ id: c.id, name: c.name })),
    expense_heads: L.d.heads
      .filter((h) => h.active && !h.payroll)
      .map((h) => ({
        id: h.id,
        name: h.name,
        group: h.kind === 'variable' ? 'متغیر' : 'ثابت',
        default_center: h.default_center,
        paid_by_utility_bill: h.utility || null,
      })),
    payroll_fields: PAY_FIELDS.map(([k, l]) => ({ key: k, label: l })),
  };
}

export function aiPeriodData(L: Ledger, p: Period) {
  const v = L.activeV(p.id);
  const ms = monthsOf(p);
  const t = today();
  const out: Record<string, unknown> = {
    organization: L.d.org.name,
    currency: 'toman',
    period: p.title,
    today: `${t.jy}/${pad(t.jm)}/${pad(t.jd)}`,
    months: ms.map((m) => ({ index: m.i, name: `${MONTHS[m.jm - 1]} ${m.jy}`, has_actual: L.hasActual(m.k), closed: !!L.d.actuals[m.k]?.closed })),
    status_rule: `green when |variance%| <= ${L.d.settings.green}, yellow <= ${L.d.settings.yellow}, red above`,
    active_version: v ? vLabel(v) : null,
    versions: L.versionsOf(p.id).map((x) => ({ version: vLabel(x), status: V_STATUS[L.vStatus(x)], reason: x.reason || '', decision_note: x.decision_note || '' })),
  };
  if (!v) return out;
  const map = new Map<string, { type: string; key: string; label: string; center: string; budget: number[]; actual: (number | null)[] }>();
  ms.forEach((m) =>
    L.analyze(p.id, [m.i]).rows.forEach((r) => {
      const k = `${r.type}:${r.key}`;
      if (!map.has(k))
        map.set(k, {
          type: r.type,
          key: r.key,
          label: r.type === 'revenue' ? L.cName(r.center) : r.label,
          center: L.cName(r.center),
          budget: Array(ms.length).fill(0),
          actual: Array(ms.length).fill(null),
        });
      const o = map.get(k)!;
      o.budget[m.i] = Number(r.budget);
      o.actual[m.i] = L.hasActual(m.k) ? Number(r.actual) : null;
    }),
  );
  out.lines = [...map.values()];
  out.investments = (v.investments || []).map((x) => {
    const tr = L.d.inv[x.id];
    return {
      title: x.title,
      unit: L.cName(x.center),
      month: ms[x.month] ? MONTHS[ms[x.month]!.jm - 1] : '',
      approved: Number(x.amount),
      status: INV_STATUS[tr?.status || 'planned'],
      progress: tr?.progress || 0,
      actual: Number(tr?.actual || 0),
    };
  });
  out.variance_explanations = Object.values(L.d.variances)
    .filter((x) => ms.some((m) => m.k === x.month))
    .map((x) => ({ month: x.month, line: x.label, reason: x.reason, action: x.action || '', comment: x.comment || '' }));
  return out;
}

/** میانگین ماهانه‌ی دوره‌ی قبلِ دارای عملکرد — مرجع تخمین برای بودجه‌ی تازه. */
export function aiReference(L: Ledger, p: Period) {
  const prev = L.d.periods.filter((q) => q.id !== p.id && L.activeV(q.id) && L.monthsWithActual(q).length).at(-1);
  if (!prev) return null;
  const idx = L.monthsWithActual(prev).map((m) => m.i);
  const rows = L.analyze(prev.id, idx).rows;
  return {
    period: prev.title,
    months_with_actual: idx.length,
    note: 'monthly AVERAGES of the previous period (budget vs actual)',
    lines: rows.map((r) => ({
      type: r.type,
      key: r.key,
      label: r.type === 'revenue' ? L.cName(r.center) : r.label,
      center: L.cName(r.center),
      avg_budget: Math.round(Number(r.budget) / idx.length),
      avg_actual: Math.round(Number(r.actual) / idx.length),
    })),
  };
}

export const CONF: Record<string, string> = { high: 'اطمینان بالا', medium: 'اطمینان متوسط', low: 'اطمینان کم' };

/** تصویر → base64 برای ارسال به سرور */
export function fileToImage(f: File): Promise<{ media_type: string; data: string }> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      res({ media_type: f.type, data: s.slice(s.indexOf(',') + 1) });
    };
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

export const faCount = (n: number) => fa(n);
