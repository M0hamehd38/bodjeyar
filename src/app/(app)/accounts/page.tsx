'use client';

/**
 * مطالبات و حساب‌های پرداختنی مهم — شیت‌های «مطالبات» و «حساب‌های پرداختنی»
 * فایل اطلاعات اولیه. تمرکز، وضعیت تسویه و برنامه‌ی پیگیری هر حساب.
 */

import { useState } from 'react';
import { AmountInput } from '@/components/budget';
import { Icon } from '@/components/icons';
import { Badge, Button, Card, CardHeader, cx, EmptyState, ErrorText, Field, Input, Meter, Modal, PageHeader, Segmented, Select, Stat, TableWrap, Textarea } from '@/components/ui';
import { B, compact, nf, pctFa, ratio, sumB } from '@/lib/format';
import { useStore } from '@/lib/store';
import type { Account, AccountKind, AccountStatus } from '@/lib/types';

const ST: Record<AccountStatus, { label: string; tone: 'danger' | 'attention' | 'ok' }> = {
  open: { label: 'باز', tone: 'danger' },
  partial: { label: 'بخشی تسویه', tone: 'attention' },
  settled: { label: 'تسویه‌شده', tone: 'ok' },
};

const remain = (a: Account) => (a.status === 'settled' ? 0n : B(a.amount) - B(a.settled));

export default function AccountsPage() {
  const { data, can, repo, toast, errMsg } = useStore();
  const [kind, setKind] = useState<AccountKind>('receivable');
  const [flt, setFlt] = useState<'all' | AccountStatus>('all');
  const [edit, setEdit] = useState<Account | null>(null);
  const ro = !can('actual') && !can('approve');

  const all = data.accounts.filter((a) => a.kind === kind);
  const list = all.filter((a) => flt === 'all' || a.status === flt);
  const total = sumB(all.map((a) => a.amount));
  const open = sumB(all.map(remain));
  const recOpen = sumB(data.accounts.filter((a) => a.kind === 'receivable').map(remain));
  const payOpen = sumB(data.accounts.filter((a) => a.kind === 'payable').map(remain));
  const top3 = [...all].sort((x, y) => (remain(y) > remain(x) ? 1 : -1)).slice(0, 3);
  const top3Share = ratio(sumB(top3.map(remain)), open);
  const kLabel = kind === 'receivable' ? 'مطالبات' : 'بدهی‌ها';

  return (
    <>
      <PageHeader
        eyebrow="حساب‌ها"
        title="مطالبات و حساب‌های پرداختنی"
        description="مطالبات مهم (دریافتنی) و بدهی‌های مهم به تأمین‌کنندگان و اشخاص؛ وضعیت تسویه، تمرکز و برنامه‌ی پیگیری. برای برنامه‌ی وصول و پرداخت از «دستیار» یا ایجنت مالی کمک بگیرید."
        actions={
          !ro && (
            <Button variant="navy" onClick={() => setEdit({ id: '', kind, party: '', amount: '', status: 'open' })}>
              <Icon.plus size={16} />
              حساب تازه
            </Button>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="مطالبات باز" value={compact(recOpen)} tone="warn" icon={<Icon.arrowDown size={18} />} hint="دریافتنی وصول‌نشده" />
        <Stat label="بدهی‌های باز" value={compact(payOpen)} tone="bad" icon={<Icon.arrowUp size={18} />} hint="پرداختنی تسویه‌نشده" />
        <Stat label="خالص (مطالبات − بدهی)" value={compact(recOpen - payOpen)} tone={recOpen >= payOpen ? 'good' : 'bad'} icon={<Icon.pulse size={18} />} />
        <Stat label={`تمرکز سه ${kind === 'receivable' ? 'بدهکار' : 'بستانکار'} اول`} value={pctFa(top3Share)} tone="brand" icon={<Icon.target size={18} />} hint={`از مانده‌ی باز ${kLabel}`} />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="نوع"
            value={kind}
            onChange={(k) => {
              setKind(k);
              setFlt('all');
            }}
            options={[
              { value: 'receivable', label: 'مطالبات (دریافتنی)' },
              { value: 'payable', label: 'حساب‌های پرداختنی' },
            ]}
          />
          <Segmented
            label="وضعیت"
            value={flt}
            onChange={setFlt}
            options={[
              { value: 'all', label: 'همه' },
              { value: 'open', label: 'باز' },
              { value: 'partial', label: 'بخشی' },
              { value: 'settled', label: 'تسویه‌شده' },
            ]}
          />
        </div>
        <div className="mb-3 flex flex-wrap gap-4 text-sm text-slate-600">
          <span>
            جمع {kLabel}: <b className="text-navy-900">{nf(total)}</b> تومان
          </span>
          <span>
            مانده‌ی باز: <b className="text-danger">{nf(open)}</b> تومان
          </span>
        </div>
        <TableWrap>
          <table className="ledger">
            <thead>
              <tr>
                <th>طرف حساب</th>
                <th className="n">مبلغ</th>
                <th className="n">مانده</th>
                <th>سهم</th>
                <th>وضعیت</th>
                <th>توضیح / پیگیری</th>
                {!ro && <th />}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="حسابی نیست">برای این فیلتر حسابی ثبت نشده است.</EmptyState>
                  </td>
                </tr>
              )}
              {list.map((a) => {
                const share = ratio(a.amount, total) ?? 0;
                return (
                  <tr key={a.id}>
                    <td>
                      <b className="text-navy-900">{a.party}</b>
                      {a.category && <div className="text-xs text-slate-500">{a.category}</div>}
                    </td>
                    <td className="n">{nf(a.amount)}</td>
                    <td className={cx('n', remain(a) > 0n && 'text-danger')}>{nf(remain(a))}</td>
                    <td className="min-w-28">
                      <div className="flex items-center gap-2">
                        <Meter value={share} tone={share > 25 ? 'bad' : 'brand'} label={`سهم ${pctFa(share)}`} />
                        <span className="text-xs text-slate-500">{pctFa(share)}</span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={ST[a.status].tone}>{ST[a.status].label}</Badge>
                    </td>
                    <td className="max-w-80 text-xs leading-6 text-slate-600">
                      {a.note && <div>{a.note}</div>}
                      {a.followup && (
                        <div className="mt-1 rounded-lg bg-brand-50 px-2 py-1 text-navy-900">
                          <Icon.clock size={12} className="me-1 inline" />
                          {a.followup}
                        </div>
                      )}
                      {!a.note && !a.followup && <span className="text-slate-300">—</span>}
                    </td>
                    {!ro && (
                      <td>
                        <Button size="sm" variant="ghost" onClick={() => setEdit(a)} aria-label={`ویرایش ${a.party}`}>
                          <Icon.edit size={14} />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {edit && (
        <AccountForm
          a={edit}
          onClose={() => setEdit(null)}
          onSave={async (x) => {
            try {
              await repo.saveAccount(x);
              toast('ذخیره شد.', 'ok');
              setEdit(null);
            } catch (e) {
              toast(errMsg(e), 'bad');
            }
          }}
          onDelete={
            edit.id
              ? async () => {
                  await repo.deleteAccount(edit.id);
                  toast('حذف شد.');
                  setEdit(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function AccountForm({ a, onClose, onSave, onDelete }: { a: Account; onClose: () => void; onSave: (a: Account) => Promise<void>; onDelete?: () => Promise<void> }) {
  const [f, setF] = useState<Account>(a);
  const [err, setErr] = useState('');
  const set = <K extends keyof Account>(k: K, v: Account[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal title={a.id ? `ویرایش ${a.party}` : a.kind === 'receivable' ? 'مطالبه‌ی تازه' : 'بدهی تازه'} onClose={onClose} size="xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="طرف حساب" htmlFor="ac-party" required>
          <Input id="ac-party" value={f.party} onChange={(e) => set('party', e.target.value)} />
        </Field>
        <Field label="نوع / دسته" htmlFor="ac-cat">
          <Input id="ac-cat" value={f.category || ''} onChange={(e) => set('category', e.target.value)} placeholder="مثلاً خرید قطعه، مشتری خدمات، کارکنان" />
        </Field>
        <Field label="مبلغ (تومان)" htmlFor="ac-amt" required>
          <AmountInput id="ac-amt" className="min-h-11 rounded-xl" value={f.amount} onValue={(v) => set('amount', v)} />
        </Field>
        <Field label="وضعیت" htmlFor="ac-st">
          <Select id="ac-st" value={f.status} onChange={(e) => set('status', e.target.value as AccountStatus)}>
            {Object.entries(ST).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        {f.status === 'partial' && (
          <Field label="مبلغ تسویه‌شده" htmlFor="ac-set">
            <AmountInput id="ac-set" className="min-h-11 rounded-xl" value={f.settled} onValue={(v) => set('settled', v)} />
          </Field>
        )}
        <Field label="زمان تقریبی وصول / پرداخت (روز)" htmlFor="ac-days">
          <Input id="ac-days" inputMode="numeric" value={f.due_days ?? ''} onChange={(e) => set('due_days', e.target.value ? Number(e.target.value.replace(/[^\d]/g, '')) : undefined)} />
        </Field>
        <Field label="توضیحات" htmlFor="ac-note" className="sm:col-span-2">
          <Textarea id="ac-note" rows={2} value={f.note || ''} onChange={(e) => set('note', e.target.value)} />
        </Field>
        <Field label="برنامه‌ی پیگیری" htmlFor="ac-fu" className="sm:col-span-2" hint="ایجنت مالی هم می‌تواند برنامه‌ی پیگیری پیشنهاد دهد.">
          <Textarea id="ac-fu" rows={2} value={f.followup || ''} onChange={(e) => set('followup', e.target.value)} />
        </Field>
      </div>
      {err && <ErrorText>{err}</ErrorText>}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          onClick={async () => {
            setErr('');
            await onSave(f).catch((e: { user?: string }) => setErr(e?.user || 'ذخیره نشد.'));
          }}
        >
          ذخیره
        </Button>
        <Button variant="ghost" onClick={onClose}>
          انصراف
        </Button>
        {onDelete && (
          <Button variant="danger" className="mr-auto" onClick={() => void onDelete()}>
            <Icon.trash size={14} />
            حذف
          </Button>
        )}
      </div>
    </Modal>
  );
}
