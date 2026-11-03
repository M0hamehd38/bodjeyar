'use client';

import { useState } from 'react';
import { CompareTable } from '@/components/compare';
import { Icon } from '@/components/icons';
import { Button, ErrorText, Field, Input, Modal } from '@/components/ui';
import { MiniStat } from '@/components/budget';
import { errMsg } from '@/lib/backend';
import { compact, jFa, signed, tm } from '@/lib/format';
import { vLabel } from '@/lib/ledger';
import { useStore } from '@/lib/store';
import type { Version } from '@/lib/types';

/** نسخه‌ی منتظر تأیید: خلاصه، مقایسه با نسخه‌ی قبل، و تصمیم مدیر. */
export function ApprovalPanel({
  v,
  onReview,
  onDone,
  hideReview,
}: {
  v: Version;
  onReview?: () => void;
  onDone?: () => void;
  hideReview?: boolean;
}) {
  const { ledger: L, can, repo, toast } = useStore();
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [cmp, setCmp] = useState(false);
  const t = L.versionTotals(v);
  const base = v.base_version_id ? L.d.versions.find((x) => x.id === v.base_version_id) : null;
  const bt = base ? L.versionTotals(base) : null;
  const diff = (a: bigint, b?: bigint) => (bt && b !== undefined ? `نسبت به قبل: ${signed(a - b, compact)}` : undefined);

  async function decide(approve: boolean) {
    setBusy(true);
    setErr('');
    try {
      await repo.decide(v.id, approve, note);
      toast(approve ? 'بودجه تأیید شد و مبنای مقایسه قرار گرفت.' : 'نسخه برای اصلاح برگشت داده شد.', approve ? 'ok' : 'info');
      onDone?.();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  }

  return (
    <section className="card mb-6 border-brand-300 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
            <Icon.hourglass size={18} />
          </span>
          <div>
            <h2 className="font-bold text-navy-900">{vLabel(v)} منتظر تأیید مدیر</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              ارسال: <span dir="ltr">{v.submitted_by}</span> · {jFa(v.submitted_at)}
            </p>
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          {!hideReview && onReview && (
            <Button size="sm" onClick={onReview}>
              بررسی جزئیات
            </Button>
          )}
          {base && (
            <Button size="sm" variant="ghost" onClick={() => setCmp(true)}>
              مقایسه با نسخه قبل
            </Button>
          )}
        </div>
      </div>
      {v.reason && <p className="mb-3 text-sm text-slate-600">دلیل: {v.reason}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="درآمد" value={tm(t.R)} sub={diff(t.R, bt?.R)} />
        <MiniStat label="هزینه + حقوق" value={tm(t.E + t.P)} sub={diff(t.E + t.P, bt ? bt.E + bt.P : undefined)} />
        <MiniStat label="نتیجه" value={tm(t.net)} sub={diff(t.net, bt?.net)} />
        <MiniStat label="سرمایه‌گذاری" value={tm(t.inv)} sub={diff(t.inv, bt?.inv)} />
      </div>
      {can('approve') ? (
        <div className="no-print mt-4 space-y-3">
          <Field label="یادداشت مدیر (برای برگشت الزامی)" htmlFor="dec-note">
            <Input id="dec-note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <ErrorText>{err}</ErrorText>
          <div className="flex flex-wrap gap-2">
            <Button variant="success" disabled={busy} onClick={() => void decide(true)}>
              <Icon.checkCircle size={16} />
              تأیید نهایی
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void decide(false)}>
              <Icon.undo size={16} />
              برگشت برای اصلاح
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">تأیید با نقش مدیر مجموعه است.</p>
      )}
      {cmp && base && (
        <Modal title="مقایسه نسخه‌ها" size="2xl" onClose={() => setCmp(false)}>
          <CompareTable L={L} a={base} b={v} />
        </Modal>
      )}
    </section>
  );
}
