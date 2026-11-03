'use client';

import { useState } from 'react';
import { AiButton, AiCard, AiSkeleton, AiState } from '@/components/ai-assist';
import { NoPeriod, PeriodSelect, StatusBadge } from '@/components/budget';
import { Icon } from '@/components/icons';
import { Button, Card, cx, EmptyState, Field, PageHeader, Select, TableWrap } from '@/components/ui';
import { AI_RULE_FA, useAiTask } from '@/lib/ai';
import { mName } from '@/lib/format';
import { monthsOf } from '@/lib/ledger';
import { buildReport, exportPdf, exportXlsx, REPORTS, type Report, type ReportFilter, type ReportType } from '@/lib/report';
import { usePeriod } from '@/lib/store';

export default function ReportsPage() {
  const { period: p, ledger: L, pid, data, me, toast, audit, ai } = usePeriod();
  const [r, setR] = useState<ReportFilter>({ type: 'summary', mi: 'all', mb: null, center: '', cost: '' });
  const [pdfBusy, setPdfBusy] = useState(false);
  const [narr, setNarr] = useState<Record<string, string>>({});
  const task = useAiTask();

  if (!p)
    return (
      <>
        <PageHeader eyebrow="گزارش‌ها" title="گزارش‌های مدیریتی" actions={<PeriodSelect />} />
        <NoPeriod />
      </>
    );

  const ms = monthsOf(p);
  const rep = buildReport(L, pid, r)!;
  const key = JSON.stringify([pid, r]);
  const summary = narr[key];
  const set = (patch: Partial<ReportFilter>) => setR({ ...r, ...patch });

  async function xlsx() {
    if (rep.empty) return toast('داده‌ای برای خروجی نیست.', 'bad');
    try {
      await exportXlsx(rep, data.org.name, r.type, summary);
      audit('create', 'report', r.type, `خروجی Excel ${rep.title}`);
    } catch {
      toast('ساخت فایل Excel انجام نشد.', 'bad');
    }
  }
  async function pdf() {
    if (rep.empty) return toast('داده‌ای برای خروجی نیست.', 'bad');
    setPdfBusy(true);
    try {
      await exportPdf(rep, data.org.name, me!.username, r.type, summary);
      audit('create', 'report', r.type, `خروجی PDF ${rep.title}`);
    } catch {
      toast('ساخت PDF انجام نشد.', 'bad');
    }
    setPdfBusy(false);
  }
  async function narrate() {
    const table = [rep.cols.join(' | '), ...rep.rows.map((x) => x.map((c) => c.t).join(' | ')), ...(rep.foot ? [rep.foot.map((c) => c.t).join(' | ')] : [])].join('\n');
    const prompt = `برای مدیر ${data.org.name} یک خلاصه نوشتاری از گزارش «${rep.title}» (${rep.scope}) بنویس.
ساختار: یک پاراگراف ۲ تا ۳ جمله‌ای درباره وضعیت کلی، بعد سه خط با «- »: «خوب:»، «نگران‌کننده:»، «اقدام پیشنهادی:». حداکثر ۱۲۰ کلمه. فقط از اعداد جدول استفاده کن.
${AI_RULE_FA}
${rep.note ? `یادداشت گزارش: ${rep.note}` : ''}

جدول:
${table.slice(0, 30000)}`;
    const res = await task.run({ messages: [{ role: 'user', content: prompt }], effort: 'low' });
    if (res?.text) {
      setNarr((n) => ({ ...n, [key]: res.text! }));
      audit('ai', 'report', '-', `خلاصه ${rep.title}`);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="گزارش‌ها"
        title={REPORTS[r.type]}
        description={rep.scope}
        actions={
          <>
            <PeriodSelect />
            <Button onClick={() => void xlsx()}>
              <Icon.table size={16} />
              خروجی Excel
            </Button>
            <Button variant="navy" disabled={pdfBusy} onClick={() => void pdf()}>
              <Icon.pdf size={16} />
              {pdfBusy ? 'در حال ساخت…' : 'دریافت PDF'}
            </Button>
          </>
        }
      />
      <Card className="no-print mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="نوع گزارش" htmlFor="rp-type">
          <Select id="rp-type" compact value={r.type} onChange={(e) => set({ type: e.target.value as ReportType })}>
            {Object.entries(REPORTS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={r.type === 'compare' ? 'ماه مبنا' : 'ماه'} htmlFor="rp-mi">
          <Select id="rp-mi" compact value={r.mi} onChange={(e) => set({ mi: e.target.value })}>
            <option value="all">{r.type === 'compare' ? 'اولین ماه' : 'کل دوره (تجمعی)'}</option>
            {ms.map((m) => (
              <option key={m.i} value={m.i}>
                {mName(m.jy, m.jm)}
              </option>
            ))}
          </Select>
        </Field>
        {r.type === 'compare' && (
          <Field label="ماه مقایسه" htmlFor="rp-mb">
            <Select id="rp-mb" compact value={r.mb ?? ''} onChange={(e) => set({ mb: +e.target.value })}>
              <option value="">ماه بعد</option>
              {ms.map((m) => (
                <option key={m.i} value={m.i}>
                  {mName(m.jy, m.jm)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="واحد (مرکز درآمد)" htmlFor="rp-center">
          <Select id="rp-center" compact value={r.center} onChange={(e) => set({ center: e.target.value })}>
            <option value="">همه</option>
            {L.revCenters(true).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="مرکز هزینه" htmlFor="rp-cost">
          <Select id="rp-cost" compact value={r.cost} onChange={(e) => set({ cost: e.target.value })}>
            <option value="">همه</option>
            {L.costCenters(true).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {rep.empty ? (
        <EmptyState title="داده‌ای برای این گزارش نیست" icon={<Icon.chart size={20} />}>
          {rep.empty}
        </EmptyState>
      ) : (
        <>
          {ai.on && (
            <AiCard
              title="خلاصه نوشتاری"
              subtitle="یک پاراگراف و سه نکته: خوب، نگران‌کننده، اقدام."
              action={
                summary && !task.busy ? (
                  <AiButton soft onClick={() => void narrate()}>
                    نسخه‌ی دیگر
                  </AiButton>
                ) : undefined
              }
            >
              {task.busy ? (
                <AiSkeleton />
              ) : summary ? (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-8 text-navy-900">{summary}</p>
                  <p className="mt-2 text-xs text-slate-500">این خلاصه در خروجی PDF و Excel هم می‌آید. پیش از ارسال بخوانید؛ ممکن است اشتباه کند.</p>
                </>
              ) : (
                <AiButton onClick={() => void narrate()}>نوشتن خلاصه مدیریتی این گزارش</AiButton>
              )}
              <AiState busy={task.busy} error={task.error} label="در حال نوشتن خلاصه…" onStop={task.stop} />
            </AiCard>
          )}
          <ReportTable rep={rep} />
        </>
      )}
    </>
  );
}

function ReportTable({ rep }: { rep: Report }) {
  const numCol = (i: number) => i > 0 && !!rep.rows[0]?.[i]?.num;
  return (
    <Card>
      <TableWrap>
        <table className="ledger">
          <thead>
            <tr>
              {rep.cols.map((h, i) => (
                <th key={h} className={numCol(i) ? 'n' : ''}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rep.rows.length === 0 && (
              <tr>
                <td colSpan={rep.cols.length}>
                  <EmptyState title="ردیفی نیست">ردیفی با این فیلترها نیست.</EmptyState>
                </td>
              </tr>
            )}
            {rep.rows.map((row, ri) => {
              const st = row.find((c) => c.st)?.st;
              return (
                <tr key={ri} data-st={st}>
                  {row.map((c, i) =>
                    c.st ? (
                      <td key={i}>
                        <StatusBadge st={c.st} />
                      </td>
                    ) : (
                      <td key={i} className={cx(c.num && 'n', i === 0 && 'font-medium text-navy-900')}>
                        {c.t}
                      </td>
                    ),
                  )}
                </tr>
              );
            })}
          </tbody>
          {rep.foot && (
            <tfoot>
              <tr>
                {rep.foot.map((c, i) =>
                  c.st ? (
                    <td key={i}>
                      <StatusBadge st={c.st} />
                    </td>
                  ) : (
                    <td key={i} className={c.num ? 'n' : ''}>
                      {c.t}
                    </td>
                  ),
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </TableWrap>
      {rep.note && <p className="mt-3 text-xs text-slate-500">{rep.note}</p>}
    </Card>
  );
}
