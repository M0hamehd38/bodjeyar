'use client';

/**
 * ورود فایل اکسل «چک‌لیست جمع‌آوری اطلاعات اولیه بودجه» — پیش‌نمایش، هشدارها و تأیید.
 * تبدیل قطعی است و در همین مرورگر انجام می‌شود؛ فایل به هیچ سروری فرستاده نمی‌شود.
 */

import { useState } from 'react';
import { Icon } from '@/components/icons';
import { Alert, Button, Card, CardHeader, Field } from '@/components/ui';
import { compact, fa, jFa, sumB } from '@/lib/format';
import { parseBudgetWorkbook, readXlsx, type ImportBundle } from '@/lib/import-xlsx';
import { useStore } from '@/lib/store';

const COUNT_LABEL: Record<string, string> = {
  months: 'ماه عملکرد',
  revenue_rows: 'ردیف درآمد',
  expense_rows: 'ردیف هزینه و حقوق',
  staff_rows: 'ردیف حقوق پرسنل',
  people: 'نفر پرسنل',
  bills: 'قبض',
  capex: 'خرید سرمایه‌ای',
  receivables: 'مطالبه',
  payables: 'حساب پرداختنی',
  centers: 'مرکز درآمد/هزینه',
  heads: 'سرفصل هزینه',
};

export function ExcelImport({ onDone, compact: small }: { onDone?: () => void; compact?: boolean }) {
  const { data, repo, toast, errMsg, me } = useStore();
  const [bundle, setBundle] = useState<ImportBundle | null>(null);
  const [file, setFile] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const hasData = data.periods.length > 0 || data.entries.length > 0;
  const info = data.settings.import_info;

  const read = async (f: File) => {
    setErr('');
    setBundle(null);
    setBusy(true);
    try {
      const wb = await readXlsx(await f.arrayBuffer());
      const b = parseBudgetWorkbook(wb, { user: me?.username || 'system', now: new Date().toISOString(), file: f.name });
      if (!b.entries.length && !b.staff.length && !b.accounts.length) throw new Error('empty');
      setBundle(b);
      setFile(f.name);
    } catch {
      setErr('این فایل قالب «چک‌لیست جمع‌آوری اطلاعات اولیه بودجه» را ندارد یا خوانده نشد (فقط xlsx).');
    }
    setBusy(false);
  };

  const sum = (b: ImportBundle) => ({
    R: sumB(b.actuals.flatMap((a) => Object.values(a.revenue))),
    E: sumB(b.actuals.flatMap((a) => [...Object.values(a.expense), ...Object.values(a.payroll)])) + sumB(b.bills.map((x) => x.amount)),
  });

  const body = (
    <>
      {!small && (
        <p className="mb-4 text-sm leading-relaxed text-slate-500">
          فایل اکسل «اطلاعات اولیه بودجه نمایندگی» (درآمدها، هزینه‌ها، حقوق و مزایا، قبوض، سرمایه‌گذاری، مطالبات و حساب‌های پرداختنی) را بدهید. همه‌ی بخش‌ها با همان ارقام ساخته می‌شوند: مراکز و سرفصل‌ها، عملکرد ماهانه، ریز اسناد، قبوض، دفتر حقوق، خریدهای سرمایه‌ای، حساب‌ها و پیش‌نویس بودجه‌ی دوره‌ی بعد. فایل از مرورگر بیرون نمی‌رود.
        </p>
      )}
      {info && !bundle && (
        <Alert tone="ok" className="mb-4" title="آخرین ورود">
          {info.file} — {jFa(info.at)} توسط {info.by}: {fa(info.counts.entries ?? 0)} ردیف سند، {fa(info.counts.staff_rows ?? 0)} ردیف حقوق، {fa(info.counts.bills ?? 0)} قبض، {fa((info.counts.receivables ?? 0) + (info.counts.payables ?? 0))} حساب.
        </Alert>
      )}
      <Field label="فایل اکسل (xlsx)" htmlFor="xlsx-file">
        <input
          id="xlsx-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="field-input text-sm"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void read(f);
            e.target.value = '';
          }}
        />
      </Field>
      {busy && !bundle && <p className="mt-2 text-sm text-slate-500">در حال خواندن فایل…</p>}
      {err && <p className="mt-2 text-sm text-danger">{err}</p>}
      {bundle && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(COUNT_LABEL).map(([k, l]) =>
              bundle.counts[k] ? (
                <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
                  <div className="text-lg font-black text-navy-900">{fa(bundle.counts[k]!)}</div>
                  <div className="text-xs text-slate-500">{l}</div>
                </div>
              ) : null,
            )}
          </div>
          <p className="text-sm text-slate-600">
            جمع درآمد <b className="text-navy-900">{compact(sum(bundle).R)}</b> · جمع هزینه با حقوق و قبوض <b className="text-navy-900">{compact(sum(bundle).E)}</b> · دوره‌ها: {bundle.periods.map((p) => p.title).join('، ')}
          </p>
          {bundle.warnings.length > 0 && (
            <Alert tone="attention" title={`${fa(bundle.warnings.length)} نکته از ورود`}>
              <ul className="list-disc space-y-1 ps-5 text-xs leading-6">
                {bundle.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Alert>
          )}
          {hasData && (
            <Alert tone="danger">
              داده‌ی فعلی کسب‌وکار (مراکز، سرفصل‌ها، دوره‌ها، بودجه‌ها، عملکرد، قبوض، حساب‌ها و …) با محتوای این فایل <b>جایگزین</b> می‌شود. کاربران و تنظیمات می‌مانند. اگر لازم است اول پشتیبان بگیرید.
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await repo.importBundle(bundle, file);
                  toast('همه‌ی داده‌های فایل وارد شد.', 'ok');
                  setBundle(null);
                  onDone?.();
                } catch (e) {
                  toast(errMsg(e), 'bad');
                }
                setBusy(false);
              }}
            >
              <Icon.upload size={16} />
              {busy ? 'در حال ورود…' : 'ورود همه‌ی داده‌ها'}
            </Button>
            <Button variant="ghost" onClick={() => setBundle(null)}>
              انصراف
            </Button>
          </div>
        </div>
      )}
    </>
  );
  if (small) return body;
  return (
    <Card>
      <CardHeader title="ورود از فایل اکسل اطلاعات اولیه" icon={<Icon.upload size={18} />} />
      {body}
    </Card>
  );
}
