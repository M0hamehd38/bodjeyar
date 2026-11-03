'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { BrandLockup, BrandMark } from '@/components/brand';
import { Icon } from '@/components/icons';
import { Button, ErrorText, Field, Input, Loading } from '@/components/ui';
import { brand } from '@/lib/brand';
import { pwPolicy, USERNAME_RE } from '@/lib/auth';
import { errMsg } from '@/lib/backend';
import { useStore } from '@/lib/store';

const PILLARS = [
  { icon: Icon.table, title: 'بودجه‌ریزی مرحله‌به‌مرحله', text: 'درآمد، هزینه، حقوق و سرمایه‌گذاری؛ با تأیید مدیر.' },
  { icon: Icon.pulse, title: 'عملکرد واقعی ماهانه', text: 'ثبت ارقام و قبوض، با مقایسه‌ی فوری با بودجه.' },
  { icon: Icon.alert, title: 'انحراف و علت آن', text: 'هر انحراف مهم با علت و اقدام ثبت می‌شود.' },
];

/** ورود — و راه‌اندازی اولیه وقتی هنوز کاربری ساخته نشده است. */
export default function LoginPage() {
  const { ready, me, data, login, setup } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    username: '',
    password: '',
    password2: '',
    org: 'نمایندگی سایپا استوار',
    fullName: '',
    accUser: '',
    accPw: '',
    sample: true,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (ready && me) router.replace('/');
  }, [ready, me, router]);

  if (!ready || me)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading label="در حال باز کردن بودجه‌یار…" />
      </div>
    );

  const isSetup = data.users.length === 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (isSetup) {
      if (f.org.trim().length < 2) return setError('نام سازمان را بنویسید.');
      if (!USERNAME_RE.test(f.username)) return setError('نام کاربری مدیر ۳ تا ۳۲ نویسه لاتین، رقم یا _ . - باشد.');
      const pe = pwPolicy(f.password);
      if (pe) return setError(pe);
      if (f.password !== f.password2) return setError('تکرار رمز مدیر یکی نیست.');
      if (f.accUser || f.accPw) {
        if (!USERNAME_RE.test(f.accUser) || f.accUser.toLowerCase() === f.username.toLowerCase())
          return setError('نام کاربری حسابدار معتبر و متفاوت از مدیر باشد.');
        const pa = pwPolicy(f.accPw);
        if (pa) return setError(`رمز حسابدار: ${pa}`);
      }
      setBusy(true);
      try {
        await setup({ ...f, org: f.org.trim(), fullName: f.fullName.trim() });
        router.replace('/');
      } catch (ex) {
        setError(errMsg(ex));
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    const err = await login(f.username, f.password);
    if (err) {
      setError(err);
      setBusy(false);
    } else router.replace('/');
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* معرفی — به سبک پوستر رسمی سایپا استوار */}
      <section className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col">
        <svg aria-hidden="true" className="pointer-events-none absolute -left-4 top-0 h-72 w-72" viewBox="0 0 300 300">
          <path d="M20 -20 L320 280" stroke="#FF7900" strokeWidth="20" />
          <path d="M90 -20 L320 210" stroke="#FF7900" strokeWidth="5" opacity="0.6" />
        </svg>
        <div className="pointer-events-none absolute -bottom-24 -left-16 opacity-[0.06]">
          <BrandMark size={460} color="#FFFFFF" />
        </div>
        <div className="relative inline-flex w-fit rounded-2xl bg-white px-5 py-4 shadow-lift">
          <BrandLockup />
        </div>
        <div className="relative my-auto max-w-md">
          <div className="inline-block rounded-xl bg-brand-500 px-4 py-1.5 text-sm font-extrabold">{brand.product}</div>
          <h1 className="mt-5 text-4xl font-black leading-[1.35] text-white">
            ابزار تصمیم مالی
            <br />
            <span className="text-brand-400">برای مدیر مجموعه</span>
          </h1>
          <p className="mt-4 leading-8 text-slate-300">{brand.tagline}.</p>
          <ul className="mt-10 space-y-5">
            {PILLARS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow">
                  <p.icon size={20} />
                </span>
                <div>
                  <div className="font-bold">{p.title}</div>
                  <div className="mt-0.5 text-sm text-slate-400">{p.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">داده‌ها در حافظه‌ی همین مرورگر می‌ماند؛ مرتب پشتیبان بگیرید.</p>
      </section>

      <section className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <BrandLockup subtitle={brand.product} />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-brand-600">
            <span className="h-1 w-5 rounded-full bg-brand-500" />
            {isSetup ? 'راه‌اندازی اولیه' : data.org.name}
          </div>
          <h2 className="mt-2 text-2xl font-black text-navy-900">
            {isSetup ? `راه‌اندازی ${brand.product}` : `ورود به ${brand.product}`}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {isSetup
              ? 'حساب مدیر مجموعه را بسازید؛ حساب حسابدار را هم می‌توانید همین حالا یا بعداً از تنظیمات بسازید.'
              : 'با نام کاربری و رمز خود وارد شوید.'}
          </p>

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
            {isSetup && (
              <Field label="نام سازمان" htmlFor="su-org">
                <Input id="su-org" maxLength={80} value={f.org} onChange={set('org')} />
              </Field>
            )}
            <div className={isSetup ? 'grid grid-cols-2 gap-3' : ''}>
              <Field label={isSetup ? 'نام کاربری مدیر' : 'نام کاربری'} htmlFor="au-user">
                <Input id="au-user" dir="ltr" autoFocus autoComplete="username" value={f.username} onChange={set('username')} className="text-left" />
              </Field>
              {isSetup && (
                <Field label="نام مدیر" htmlFor="su-mname">
                  <Input id="su-mname" maxLength={60} value={f.fullName} onChange={set('fullName')} />
                </Field>
              )}
            </div>
            <div className={isSetup ? 'grid grid-cols-2 gap-3' : ''}>
              <Field label={isSetup ? 'رمز مدیر' : 'رمز عبور'} htmlFor="au-pass">
                <Input id="au-pass" type="password" dir="ltr" autoComplete={isSetup ? 'new-password' : 'current-password'} value={f.password} onChange={set('password')} className="text-left" />
              </Field>
              {isSetup && (
                <Field label="تکرار رمز" htmlFor="au-pass2">
                  <Input id="au-pass2" type="password" dir="ltr" autoComplete="new-password" value={f.password2} onChange={set('password2')} className="text-left" />
                </Field>
              )}
            </div>
            {isSetup && (
              <>
                <details className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <summary className="cursor-pointer font-medium text-slate-700">حساب حسابدار (اختیاری)</summary>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field label="نام کاربری" htmlFor="su-acc">
                      <Input id="su-acc" dir="ltr" autoComplete="off" value={f.accUser} onChange={set('accUser')} className="text-left" />
                    </Field>
                    <Field label="رمز" htmlFor="su-accpw">
                      <Input id="su-accpw" type="password" dir="ltr" autoComplete="new-password" value={f.accPw} onChange={set('accPw')} className="text-left" />
                    </Field>
                  </div>
                </details>
                <label className="flex items-start gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-brand-600"
                    checked={f.sample}
                    onChange={(e) => setF((x) => ({ ...x, sample: e.target.checked }))}
                  />
                  با داده نمونه نمایندگی شروع کن (شش‌ماهه اول ۱۴۰۵ با عملکرد کامل و شش‌ماهه دوم منتظر تأیید؛ از تنظیمات حذف می‌شود)
                </label>
              </>
            )}
            <ErrorText>{error}</ErrorText>
            <Button type="submit" variant="primary" disabled={busy} size="lg" className="w-full py-3">
              {busy ? (isSetup ? 'در حال آماده‌سازی…' : 'در حال ورود…') : isSetup ? 'راه‌اندازی و ورود' : 'ورود'}
            </Button>
          </form>
          <p className="mt-8 text-center text-xs text-slate-400">
            {isSetup ? 'رمز: حداقل ۸ نویسه، شامل حرف و رقم.' : 'حساب کاربری را مدیر مجموعه می‌سازد. رمز را فراموش کرده‌اید؟ به او اطلاع دهید.'}
          </p>
        </div>
      </section>
    </main>
  );
}
