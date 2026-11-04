'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { BrandLockup } from '@/components/brand';
import { ExcelImport } from '@/components/excel-import';
import { SmallNumberInput, StatusBadge } from '@/components/budget';
import { Icon } from '@/components/icons';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, ErrorText, Field, Input, PageHeader, Select, TableWrap, Tabs } from '@/components/ui';
import { makeUser, pwPolicy, USERNAME_RE } from '@/lib/auth';
import { errMsg } from '@/lib/backend';
import { fa, jFa } from '@/lib/format';
import { auditText, BILL_TYPES, ROLE_LABEL } from '@/lib/ledger';
import { downloadText, fileName } from '@/lib/report';
import { useStore, validBackup, type BackupFile } from '@/lib/store';
import { AI_PURPOSE_KEYS, AI_PURPOSES, AI_TIERS, TIER_INFO, tierFor } from '@/lib/ai-purposes';
import type { AiTier, Center, Head, Role } from '@/lib/types';

const TABS = [
  ['org', 'هویت سازمان'],
  ['rules', 'وضعیت و سناریو'],
  ['structure', 'مراکز و سرفصل‌ها'],
  ['users', 'کاربران'],
  ['data', 'داده‌ها'],
  ['ai', 'هوش مصنوعی'],
  ['log', 'رویدادها'],
  ['me', 'حساب من'],
] as const;
type Tab = (typeof TABS)[number][0];

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}

function Settings() {
  const { can } = useStore();
  const sp = useSearchParams();
  const router = useRouter();
  const allowed = can('settings') ? TABS : TABS.filter(([k]) => k === 'me' || k === 'log');
  const want = sp.get('tab') as Tab | null;
  const tab: Tab = allowed.find(([k]) => k === want)?.[0] ?? allowed[0]![0];

  return (
    <>
      <PageHeader
        eyebrow="تنظیمات"
        title="پیکربندی سامانه"
        description={can('settings') ? 'این بخش با نقش مدیر مجموعه است.' : 'تنظیمات سازمان با مدیر مجموعه است؛ شما رمز خودتان را تغییر می‌دهید و رویدادها را می‌بینید.'}
      />
      <div className="mb-6">
        <Tabs label="بخش‌های تنظیمات" value={tab} onChange={(t) => router.replace(`/settings?tab=${t}`)} items={allowed.map(([value, label]) => ({ value, label }))} />
      </div>
      {tab === 'org' && <OrgTab />}
      {tab === 'rules' && <RulesTab />}
      {tab === 'structure' && <StructureTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'data' && <DataTab />}
      {tab === 'ai' && <AiTab />}
      {tab === 'log' && <LogTab />}
      {tab === 'me' && <MeTab />}
    </>
  );
}

function OrgTab() {
  const { data, repo, toast } = useStore();
  const [name, setName] = useState(data.org.name);
  const [err, setErr] = useState('');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="هویت سازمان" icon={<Icon.building size={18} />} />
        <Field label="نام سازمان" htmlFor="org-name" hint="در سربرگ صفحه‌ها، گزارش‌ها و خروجی PDF می‌آید.">
          <Input id="org-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="mt-3">
          <ErrorText>{err}</ErrorText>
        </div>
        <Button
          variant="primary"
          className="mt-3"
          onClick={async () => {
            if (name.trim().length < 2) return setErr('نام سازمان را بنویسید.');
            try {
              await repo.saveOrg({ name: name.trim() });
              setErr('');
              toast('نام سازمان ذخیره شد.', 'ok');
            } catch (e) {
              setErr(errMsg(e));
            }
          }}
        >
          ذخیره
        </Button>
      </Card>
      <Card>
        <CardHeader title="هویت بصری" subtitle="دیزاین سیستم سایپا نمایندگی استوار" icon={<Icon.sparkles size={18} />} />
        <div className="rounded-xl bg-slate-50 p-4">
          <BrandLockup subtitle={data.org.name} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary">دکمه اصلی</Button>
          <Button variant="navy">سرمه‌ای</Button>
          <StatusBadge st="ok" />
          <StatusBadge st="warn" />
          <StatusBadge st="bad" />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          رنگ‌ها، فونت و آرم ثابت‌اند تا همه‌ی برنامه‌های نمایندگی (میز کار سازمانی، ارزشیابی، بودجه‌یار) یکدست بمانند. رنگ‌های وضعیت هم ثابت‌اند تا معنای هشدار عوض نشود.
        </p>
      </Card>
    </div>
  );
}

function RulesTab() {
  const { data, repo, toast } = useStore();
  const s = data.settings;
  const [g, setG] = useState(s.green);
  const [y, setY] = useState(s.yellow);
  const [sc, setSc] = useState(s.scen);
  const [err, setErr] = useState('');
  const pair = (k: 'cons' | 'opt', t: 'rev' | 'exp') => (
    <Field label={t === 'rev' ? 'درآمد' : 'هزینه'}>
      <div className="flex gap-2">
        <Select
          compact
          className="w-28"
          value={sc[k][t] >= 0 ? 1 : -1}
          onChange={(e) => setSc({ ...sc, [k]: { ...sc[k], [t]: Math.abs(sc[k][t]) * +e.target.value } })}
        >
          <option value={1}>افزایش</option>
          <option value={-1}>کاهش</option>
        </Select>
        <SmallNumberInput
          className="w-20"
          value={Math.abs(sc[k][t])}
          onValue={(n) => setSc({ ...sc, [k]: { ...sc[k], [t]: (sc[k][t] < 0 ? -1 : 1) * n } })}
        />
      </div>
    </Field>
  );
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="منطق وضعیت" subtitle="بر اساس قدر مطلق درصد اختلاف عملکرد از بودجه." icon={<Icon.target size={18} />} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="سبز تا ±٪">
              <SmallNumberInput value={g} onValue={setG} />
            </Field>
            <Field label="زرد تا ±٪ (بیشتر از آن قرمز)">
              <SmallNumberInput value={y} onValue={setY} />
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="سناریوها" subtitle="درصد تغییر نسبت به عدد Base." icon={<Icon.graph size={18} />} />
          {(
            [
              ['cons', 'محافظه‌کارانه'],
              ['opt', 'خوش‌بینانه'],
            ] as const
          ).map(([k, l]) => (
            <div key={k} className="mb-3 flex flex-wrap items-end gap-4">
              <b className="min-w-24 pb-2 text-navy-900">{l}</b>
              {pair(k, 'rev')}
              {pair(k, 'exp')}
            </div>
          ))}
        </Card>
      </div>
      <div className="mt-4">
        <ErrorText>{err}</ErrorText>
      </div>
      <Button
        variant="primary"
        className="mt-3"
        onClick={async () => {
          if (!(g > 0 && y > g && y <= 100)) return setErr('آستانه سبز باید از صفر بزرگ‌تر و از زرد کوچک‌تر باشد.');
          if (Object.values(sc).some((x) => Math.abs(x.rev) > 90 || Math.abs(x.exp) > 90)) return setErr('درصد سناریو حداکثر ۹۰ باشد.');
          try {
            await repo.saveSettings({ green: g, yellow: y, scen: sc });
            setErr('');
            toast('تنظیمات ذخیره شد.', 'ok');
          } catch (e) {
            setErr(errMsg(e));
          }
        }}
      >
        ذخیره
      </Button>
    </>
  );
}

function CenterRow({ c }: { c: Center }) {
  const { ledger: L, repo, toast } = useStore();
  const [name, setName] = useState(c.name);
  const [link, setLink] = useState(L.revCenters(true).find((x) => x.link === c.id)?.id || '');
  return (
    <tr className={c.active ? '' : 'text-slate-400'}>
      <td>
        <Input compact aria-label="نام" maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      {c.kind === 'cost' && (
        <td>
          <Select compact aria-label="مرکز درآمد مرتبط" value={link} onChange={(e) => setLink(e.target.value)}>
            <option value="">—</option>
            {L.revCenters(true).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </td>
      )}
      <td>{c.active ? <Badge tone="ok">فعال</Badge> : <Badge tone="neutral">غیرفعال</Badge>}</td>
      <td className="whitespace-nowrap">
        <Button
          size="sm"
          onClick={async () => {
            if (name.trim().length < 2) return toast('نام مرکز را بنویسید.', 'bad');
            try {
              await repo.saveCenter({ ...c, name: name.trim() });
              if (c.kind === 'cost')
                for (const r of L.revCenters(true)) {
                  const want = r.id === link;
                  if (want && r.link !== c.id) await repo.saveCenter({ ...r, link: c.id });
                  if (!want && r.link === c.id) await repo.saveCenter({ ...r, link: '' });
                }
              toast('ذخیره شد.', 'ok');
            } catch (e) {
              toast(errMsg(e), 'bad');
            }
          }}
        >
          ذخیره
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void repo.saveCenter({ ...c, active: !c.active }).catch((e) => toast(errMsg(e), 'bad'))}>
          {c.active ? 'غیرفعال' : 'فعال'}
        </Button>
      </td>
    </tr>
  );
}

function CentersCard({ kind, title }: { kind: 'revenue' | 'cost'; title: string }) {
  const { data, repo, toast } = useStore();
  const [name, setName] = useState('');
  return (
    <Card>
      <CardHeader title={title} icon={<Icon.building size={18} />} />
      <TableWrap>
        <table className="ledger">
          <thead>
            <tr>
              <th>نام</th>
              {kind === 'cost' && <th>مرکز درآمد مرتبط</th>}
              <th>وضعیت</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.centers
              .filter((c) => c.kind === kind)
              .map((c) => (
                <CenterRow key={c.id} c={c} />
              ))}
          </tbody>
        </table>
      </TableWrap>
      <div className="mt-3 flex items-end gap-2">
        <Field label="مرکز جدید" htmlFor={`new-${kind}`} className="flex-1">
          <Input id={`new-${kind}`} compact maxLength={50} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button
          onClick={async () => {
            const n = name.trim();
            if (n.length < 2) return toast('نام مرکز را بنویسید.', 'bad');
            if (data.centers.some((c) => c.kind === kind && c.name === n)) return toast('مرکزی با این نام هست.', 'bad');
            try {
              await repo.saveCenter({ kind, name: n, active: true, has_staff: true, created_at: new Date().toISOString() });
              setName('');
            } catch (e) {
              toast(errMsg(e), 'bad');
            }
          }}
        >
          <Icon.plus size={16} />
          افزودن
        </Button>
      </div>
    </Card>
  );
}

function HeadRow({ h }: { h: Head }) {
  const { ledger: L, repo, toast } = useStore();
  const [f, setF] = useState({ name: h.name, kind: h.kind, default_center: h.default_center });
  return (
    <tr className={h.active ? '' : 'text-slate-400'}>
      <td>
        <Input compact aria-label="نام" maxLength={50} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </td>
      <td>
        <Select compact aria-label="گروه" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Head['kind'] })}>
          <option value="fixed">ثابت</option>
          <option value="variable">متغیر</option>
        </Select>
      </td>
      <td>
        <Select compact aria-label="مرکز پیش‌فرض" value={f.default_center} onChange={(e) => setF({ ...f, default_center: e.target.value })}>
          {L.costCenters(true).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </td>
      <td className="text-xs">{h.payroll ? 'از ماژول حقوق' : h.utility ? `از قبوض ${BILL_TYPES[h.utility]}` : 'دستی'}</td>
      <td className="whitespace-nowrap">
        <Button
          size="sm"
          onClick={async () => {
            if (f.name.trim().length < 2) return toast('نام سرفصل را بنویسید.', 'bad');
            try {
              await repo.saveHead({ ...h, ...f, name: f.name.trim() });
              toast('ذخیره شد.', 'ok');
            } catch (e) {
              toast(errMsg(e), 'bad');
            }
          }}
        >
          ذخیره
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void repo.saveHead({ ...h, active: !h.active }).catch((e) => toast(errMsg(e), 'bad'))}>
          {h.active ? 'غیرفعال' : 'فعال'}
        </Button>
      </td>
    </tr>
  );
}

function StructureTab() {
  const { data, ledger: L, repo, toast } = useStore();
  const [nh, setNh] = useState({ name: '', kind: 'fixed' as Head['kind'] });
  return (
    <>
      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <CentersCard kind="revenue" title="مراکز درآمد" />
        <CentersCard kind="cost" title="مراکز هزینه (واحدها)" />
      </div>
      <Card>
        <CardHeader title="سرفصل‌های هزینه" icon={<Icon.list size={18} />} />
        <TableWrap>
          <table className="ledger">
            <thead>
              <tr>
                <th>نام</th>
                <th>گروه</th>
                <th>مرکز پیش‌فرض</th>
                <th>نوع</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.heads.map((h) => (
                <HeadRow key={h.id} h={h} />
              ))}
            </tbody>
          </table>
        </TableWrap>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="سرفصل جدید" htmlFor="new-head" className="min-w-48 flex-1">
            <Input id="new-head" compact maxLength={50} value={nh.name} onChange={(e) => setNh({ ...nh, name: e.target.value })} />
          </Field>
          <Select compact aria-label="گروه" className="w-28" value={nh.kind} onChange={(e) => setNh({ ...nh, kind: e.target.value as Head['kind'] })}>
            <option value="fixed">ثابت</option>
            <option value="variable">متغیر</option>
          </Select>
          <Button
            onClick={async () => {
              const n = nh.name.trim();
              if (n.length < 2) return toast('نام سرفصل را بنویسید.', 'bad');
              if (data.heads.some((h) => h.name === n)) return toast('سرفصلی با این نام هست.', 'bad');
              try {
                await repo.saveHead({ name: n, kind: nh.kind, default_center: L.costCenters()[0]?.id || '', active: true });
                setNh({ ...nh, name: '' });
              } catch (e) {
                toast(errMsg(e), 'bad');
              }
            }}
          >
            <Icon.plus size={16} />
            افزودن
          </Button>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-500">مرکز و سرفصل حذف نمی‌شود تا سابقه بودجه و عملکرد بی‌صاحب نماند؛ به‌جای آن غیرفعال کنید.</p>
    </>
  );
}

function UsersTab() {
  const { data, me, repo, toast, audit, addUser } = useStore();
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [nu, setNu] = useState({ username: '', name: '', role: 'accountant' as Role, pw: '' });
  const [err, setErr] = useState('');

  return (
    <Card>
      <CardHeader title="کاربران" icon={<Icon.users size={18} />} />
      <TableWrap>
        <table className="ledger">
          <thead>
            <tr>
              <th>نام کاربری</th>
              <th>نام</th>
              <th>نقش</th>
              <th>وضعیت</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id}>
                <td dir="ltr" className="text-start">
                  {u.username}
                </td>
                <td>{u.full_name || '—'}</td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td>{u.active ? <Badge tone="ok">فعال</Badge> : <Badge tone="neutral">غیرفعال</Badge>}</td>
                <td className="whitespace-nowrap">
                  {u.id === me?.id ? (
                    <span className="text-xs text-slate-400">شما</span>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (u.active && u.role === 'manager' && data.users.filter((x) => x.role === 'manager' && x.active).length < 2)
                            return toast('حداقل یک مدیر فعال لازم است.', 'bad');
                          try {
                            await repo.saveUser({ ...u, active: !u.active });
                            audit('access', 'user', u.id, `${u.username} ${u.active ? 'غیرفعال' : 'فعال'} شد`);
                          } catch (e) {
                            toast(errMsg(e), 'bad');
                          }
                        }}
                      >
                        {u.active ? 'غیرفعال' : 'فعال'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setPwFor(pwFor === u.id ? null : u.id)}>
                        تعیین رمز
                      </Button>
                      {pwFor === u.id && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Input compact type="password" autoComplete="new-password" placeholder="رمز جدید" className="w-44" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} />
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={async () => {
                              const pe = pwPolicy(pw);
                              if (pe) return setPwErr(pe);
                              try {
                                const x = await makeUser(u.username, pw, u.role, u.full_name);
                                await repo.saveUser({ ...x, created_at: u.created_at, active: u.active });
                                audit('password', 'user', u.id, u.username);
                                setPwFor(null);
                                setPw('');
                                setPwErr('');
                                toast('رمز تعیین شد.', 'ok');
                              } catch (e) {
                                toast(errMsg(e), 'bad');
                              }
                            }}
                          >
                            ثبت
                          </Button>
                          {pwErr && <span className="text-xs text-danger">{pwErr}</span>}
                        </div>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <h3 className="mb-3 mt-6 font-bold text-navy-900">کاربر جدید</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="نام کاربری (لاتین)" htmlFor="nu-user">
          <Input id="nu-user" dir="ltr" maxLength={32} autoComplete="off" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} />
        </Field>
        <Field label="نام و نام خانوادگی" htmlFor="nu-name">
          <Input id="nu-name" maxLength={60} value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />
        </Field>
        <Field label="نقش" htmlFor="nu-role">
          <Select id="nu-role" value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}>
            <option value="accountant">مدیر مالی / حسابدار</option>
            <option value="manager">مدیر مجموعه</option>
          </Select>
        </Field>
        <Field label="رمز اولیه" htmlFor="nu-pw">
          <Input id="nu-pw" type="password" dir="ltr" autoComplete="new-password" value={nu.pw} onChange={(e) => setNu({ ...nu, pw: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <ErrorText>{err}</ErrorText>
      </div>
      <Button
        variant="primary"
        className="mt-3"
        onClick={async () => {
          const u = nu.username.trim();
          if (!USERNAME_RE.test(u)) return setErr('نام کاربری ۳ تا ۳۲ نویسه لاتین، رقم یا _ . - باشد.');
          if (data.users.some((x) => x.username.toLowerCase() === u.toLowerCase())) return setErr('این نام کاربری وجود دارد.');
          const pe = pwPolicy(nu.pw);
          if (pe) return setErr(pe);
          try {
            await addUser(u, nu.pw, nu.role, nu.name.trim());
            setNu({ username: '', name: '', role: 'accountant', pw: '' });
            setErr('');
            toast('کاربر اضافه شد.', 'ok');
          } catch (e) {
            setErr(errMsg(e));
          }
        }}
      >
        <Icon.plus size={16} />
        افزودن کاربر
      </Button>
    </Card>
  );
}

function DataTab() {
  const { data, repo, toast, ai } = useStore();
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [askSample, setAskSample] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <ExcelImport />
      </div>
      <Card>
        <CardHeader title="پشتیبان‌گیری" icon={<Icon.download size={18} />} />
        <p className="mb-4 text-sm leading-relaxed text-slate-500">
          فایل JSON از ساختار، دوره‌ها، نسخه‌های بودجه، عملکرد، قبوض، انحراف‌ها، سرمایه‌گذاری و تنظیمات. رمزها در فایل نمی‌آیند.
        </p>
        <Button variant="primary" onClick={() => downloadText(fileName('backup', 'json'), repo.backupJson())}>
          <Icon.download size={16} />
          دریافت فایل پشتیبان
        </Button>
        <Field label="بازیابی از فایل" htmlFor="restore-file" className="mt-5">
          <input
            id="restore-file"
            type="file"
            accept="application/json,.json"
            className="field-input text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const d: unknown = JSON.parse(await f.text());
                if (!validBackup(d)) throw 0;
                setPending(d);
                toast(`فایل معتبر است: ${fa(d.versions.length)} نسخه بودجه، ${fa(d.actuals.length)} ماه عملکرد.`);
              } catch {
                toast('این فایل پشتیبان معتبر بودجه‌یار (نسخه ۲) نیست.', 'bad');
                e.target.value = '';
              }
            }}
          />
        </Field>
        {pending && (
          <Alert
            tone="danger"
            className="mt-3"
            action={
              <>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await repo.restore(pending);
                      setPending(null);
                      toast('بازیابی کامل شد.', 'ok');
                    } catch (e) {
                      toast(errMsg(e), 'bad');
                    }
                    setBusy(false);
                  }}
                >
                  بازیابی کن
                </Button>
                <Button size="sm" onClick={() => setPending(null)}>
                  انصراف
                </Button>
              </>
            }
          >
            همه داده‌های فعلی (به‌جز کاربران) با محتوای فایل جایگزین می‌شود.
          </Alert>
        )}
      </Card>
      <Card>
        <CardHeader title="داده‌های نمونه" icon={<Icon.archive size={18} />} />
        {data.settings.has_sample ? (
          <>
            <p className="mb-4 text-sm leading-relaxed text-slate-600">
              داده نمونه نمایندگی در سامانه است: دوره‌ها، نسخه‌های بودجه، عملکرد، قبوض و پروژه‌هایی که برچسب نمونه دارند. ساختار مراکز و سرفصل‌ها و کاربران می‌ماند.
            </p>
            {askSample ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                حذف شود؟
                <Button
                  size="sm"
                  variant="danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await repo.removeSample();
                      setAskSample(false);
                      toast('داده‌های نمونه حذف شد.', 'ok');
                    } catch (e) {
                      toast(errMsg(e), 'bad');
                    }
                    setBusy(false);
                  }}
                >
                  حذف داده نمونه
                </Button>
                <Button size="sm" onClick={() => setAskSample(false)}>
                  انصراف
                </Button>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setAskSample(true)}>
                <Icon.trash size={16} />
                حذف داده‌های نمونه
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">داده نمونه‌ای در سامانه نیست.</p>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await repo.loadSample();
                  toast('داده نمونه بارگذاری شد.', 'ok');
                } catch (e) {
                  toast(errMsg(e), 'bad');
                }
                setBusy(false);
              }}
            >
              {busy ? 'در حال بارگذاری…' : 'بارگذاری داده نمونه'}
            </Button>
          </>
        )}
        <div className="mt-5 space-y-1.5 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <p>دستیار هوش مصنوعی: {ai.on ? 'فعال — از سرور با کلید درگاه سازمان.' : 'غیرفعال (کلید درگاه هوش مصنوعی روی سرور تنظیم نشده).'}</p>
          <p>محل ذخیره: حافظه همین مرورگر؛ مرتب پشتیبان بگیرید.</p>
        </div>
      </Card>
    </div>
  );
}

/** تنظیمات هوش مصنوعی — برای هر کاربرد، «مدل دقیق» یا «مدل روزمره» (همان الگوی هوش سازمانی). */
function AiTab() {
  const { data, ai, repo, toast } = useStore();
  const [draft, setDraft] = useState<Record<string, AiTier>>(() =>
    Object.fromEntries(AI_PURPOSE_KEYS.map((k) => [k, tierFor(data.settings.ai_tiers, k)])),
  );
  const [busy, setBusy] = useState(false);
  const setAll = (t: AiTier) => setDraft(Object.fromEntries(AI_PURPOSE_KEYS.map((k) => [k, t])));
  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
        <span className="text-slate-600">وضعیت:</span>
        {ai.on ? <Badge tone="ok">متصل به درگاه هوش مصنوعی</Badge> : <Badge tone="danger">کلید درگاه تنظیم نشده</Badge>}
        {ai.provider && <span className="text-xs text-slate-500">سرویس‌دهنده: {ai.provider === 'arvan' ? 'آروان' : ai.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}</span>}
        {!ai.on && ai.missing?.length ? (
          <span className="text-xs text-slate-500" dir="ltr">
            missing: {ai.missing.join(', ')}
          </span>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {AI_TIERS.map((t) => (
          <div key={t} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                {t === 'precise' ? <Icon.target size={18} className="ml-1.5 inline text-brand-500" /> : <Icon.pulse size={18} className="ml-1.5 inline text-brand-500" />}
                {TIER_INFO[t].label}
              </span>
              <button type="button" onClick={() => setAll(t)} className="text-xs text-brand-700 hover:underline">
                برای همه
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">{TIER_INFO[t].note}</p>
            <p className="mt-2 flex items-center gap-2 text-[11px] text-slate-400" dir="ltr">
              {ai.tiers?.[t]?.model ?? '—'}
              {ai.tiers && <Badge tone={ai.tiers[t].on ? 'ok' : 'neutral'}>{ai.tiers[t].on ? 'on' : 'off'}</Badge>}
            </p>
          </div>
        ))}
      </div>
      <Card className="p-0">
        <TableWrap className="sm:border-0">
          <table className="ledger">
            <thead>
              <tr>
                <th>کاربرد</th>
                <th>مدل</th>
              </tr>
            </thead>
            <tbody>
              {AI_PURPOSE_KEYS.map((k) => (
                <tr key={k}>
                  <td>
                    <b className="text-navy-900">{AI_PURPOSES[k].label}</b>
                    <div className="text-xs text-slate-500">{AI_PURPOSES[k].description}</div>
                  </td>
                  <td className="min-w-44">
                    <Select compact aria-label={`مدل ${AI_PURPOSES[k].label}`} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value as AiTier }))}>
                      {AI_TIERS.map((t) => (
                        <option key={t} value={t}>
                          {TIER_INFO[t].label}
                          {t === AI_PURPOSES[k].tier ? ' (پیش‌فرض)' : ''}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await repo.saveSettings({ ai_tiers: draft });
            toast('مدل‌های هوش مصنوعی ذخیره شد؛ از درخواست بعدی اثر می‌کند.', 'ok');
            setBusy(false);
          }}
        >
          ذخیره
        </Button>
        <p className="text-xs text-slate-500">کلیدها فقط روی سرور (‎.env.local) هستند؛ همان متغیرهای «هوش سازمانی»: ARVAN_AI_API_KEY، ARVAN_PRECISE_MODEL، ARVAN_EVERYDAY_MODEL و کلیدهای جدای هر مدل.</p>
      </div>
    </div>
  );
}

function LogTab() {
  const { ledger: L } = useStore();
  const items = L.recentAudit(60);
  return (
    <Card>
      <CardHeader title="Audit Log" subtitle="۶۰ رویداد اخیر" icon={<Icon.clock size={18} />} />
      {items.length ? (
        <TableWrap>
          <table className="ledger">
            <thead>
              <tr>
                <th>زمان</th>
                <th>کاربر</th>
                <th>نقش</th>
                <th>رویداد</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap text-xs">
                    {jFa(a.at)} <span className="text-slate-400">{fa(new Date(a.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}</span>
                  </td>
                  <td className="text-xs" dir="ltr">
                    {a.user}
                  </td>
                  <td className="text-xs">{a.role ? ROLE_LABEL[a.role] : '—'}</td>
                  <td className="text-sm">{auditText(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <EmptyState title="رویدادی نیست">رویدادی ثبت نشده.</EmptyState>
      )}
    </Card>
  );
}

function MeTab() {
  const { me, changePassword, toast } = useStore();
  const [f, setF] = useState({ cur: '', n1: '', n2: '' });
  const [err, setErr] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const pe = pwPolicy(f.n1);
    if (pe) return setErr(pe);
    if (f.n1 !== f.n2) return setErr('تکرار رمز جدید یکی نیست.');
    try {
      await changePassword(f.cur, f.n1);
      setF({ cur: '', n1: '', n2: '' });
      toast('رمز عبور تغییر کرد.', 'ok');
    } catch (ex) {
      setErr(errMsg(ex));
    }
  }
  return (
    <Card className="max-w-lg">
      <CardHeader title="تغییر رمز عبور" subtitle={`${me?.full_name || me?.username} · ${me ? ROLE_LABEL[me.role] : ''}`} icon={<Icon.lock size={18} />} />
      <form onSubmit={submit} noValidate className="space-y-4">
        <input type="text" autoComplete="username" value={me?.username || ''} hidden readOnly />
        <Field label="رمز فعلی" htmlFor="pw-cur">
          <Input id="pw-cur" type="password" dir="ltr" autoComplete="current-password" value={f.cur} onChange={(e) => setF({ ...f, cur: e.target.value })} />
        </Field>
        <Field label="رمز جدید" htmlFor="pw-new" hint="حداقل ۸ نویسه، شامل حرف و رقم.">
          <Input id="pw-new" type="password" dir="ltr" autoComplete="new-password" value={f.n1} onChange={(e) => setF({ ...f, n1: e.target.value })} />
        </Field>
        <Field label="تکرار رمز جدید" htmlFor="pw-new2">
          <Input id="pw-new2" type="password" dir="ltr" autoComplete="new-password" value={f.n2} onChange={(e) => setF({ ...f, n2: e.target.value })} />
        </Field>
        <ErrorText>{err}</ErrorText>
        <Button type="submit" variant="primary">
          تغییر رمز
        </Button>
      </form>
    </Card>
  );
}
