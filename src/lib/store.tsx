'use client';

/**
 * وضعیت برنامه و همه‌ی نوشتن‌ها (Repo).
 *
 * داده یک‌جا خوانده می‌شود و هر تغییر هم در حافظه‌ی صفحه و هم در لایه‌ی ذخیره
 * می‌نشیند. هر نوشتن یک رویداد در Audit Log می‌گذارد تا معلوم بماند چه کسی چه کرد.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { backend, errMsg, guardedPut, pool } from './backend';
import { clearSession, hashPw, makeUser, sessionUser, setSession } from './auth';
import { B, clone, fa, jParse, localIso, mkLabel, nf, nowIso, pad, today, uid } from './format';
import { BILL_TYPES, INV_STATUS, Ledger, roleCan, vLabel, type Perm } from './ledger';
import { defaultStructure, sampleData } from './sample';
import { importInfo } from './import-apply';
import type { ImportBundle } from './import-xlsx';
import type {
  Account,
  Actual,
  AgentProposal,
  Capex,
  Entry,
  StaffPay,
  AuditEntry,
  Bill,
  Center,
  Data,
  Head,
  InvTrack,
  Org,
  Period,
  Role,
  Settings,
  User,
  VarianceNote,
  Version,
} from './types';

export const DEFAULT_ORG: Org = { name: 'نمایندگی سایپا استوار' };
export const DEFAULT_SETTINGS: Settings = {
  green: 5,
  yellow: 10,
  scen: { cons: { rev: -10, exp: 5 }, opt: { rev: 10, exp: -3 } },
  has_sample: false,
};

const emptyData = (): Data => ({
  org: { ...DEFAULT_ORG },
  settings: clone(DEFAULT_SETTINGS),
  users: [],
  centers: [],
  heads: [],
  periods: [],
  versions: [],
  actuals: {},
  bills: [],
  variances: {},
  inv: {},
  audit: {},
  entries: [],
  staff: [],
  accounts: [],
  capex: [],
  proposals: [],
});

const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0);
const userErr = (msg: string) => ({ user: msg });

export type ToastKind = 'ok' | 'bad' | 'info';
interface Toast {
  id: number;
  msg: string;
  kind: ToastKind;
}

export interface AiInfo {
  on: boolean;
  images: boolean;
  provider?: string;
  tools?: boolean;
  tiers?: Record<'precise' | 'everyday', { model: string; on: boolean }>;
  missing?: string[];
}

/* ------------------------------------------------------------------ */

function validateBill(L: Ledger, b: Bill) {
  if (!BILL_TYPES[b.type]) return 'نوع قبض را انتخاب کنید.';
  if (B(b.amount) <= 0n) return 'مبلغ قبض را وارد کنید.';
  if (!b.month) return 'دوره مصرف را انتخاب کنید.';
  if (b.pay_date && !jParse(b.pay_date)) return 'تاریخ پرداخت را به شکل ۱۴۰۵/۰۷/۱۰ بنویسید.';
  if (b.mode === 'direct') {
    if (!L.centerById(b.center)) return 'مرکز هزینه را انتخاب کنید.';
  } else {
    if (!b.alloc?.length) return 'سهم مراکز را وارد کنید.';
    const s = b.alloc.reduce((t, a) => t + Number(a.pct || 0), 0);
    if (s !== 100) return `جمع درصدهای تخصیص باید ۱۰۰ باشد (اکنون ${fa(s)}).`;
    if (b.alloc.some((a) => !L.centerById(a.center) || !(a.pct > 0))) return 'مرکز و درصد هر ردیف تخصیص را کامل کنید.';
    if (new Set(b.alloc.map((a) => a.center)).size !== b.alloc.length) return 'هر مرکز فقط یک بار در تخصیص بیاید.';
  }
  return '';
}

/* ------------------------------------------------------------------ */

function useStoreState() {
  const dataRef = useRef<Data>(emptyData());
  const [rev, setRev] = useState(0);
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<User | null>(null);
  const [pid, setPidState] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ai, setAi] = useState<AiInfo>({ on: false, images: false });
  const meRef = useRef<User | null>(null);
  meRef.current = me;

  const bump = useCallback(() => setRev((r) => r + 1), []);
  const ledger = useMemo(() => new Ledger(dataRef.current), [rev]);
  const L = () => new Ledger(dataRef.current);

  const toast = useCallback((msg: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'bad' ? 6500 : 3200);
  }, []);

  /* ---------- audit (تجمیع ماهانه) ---------- */
  const auditTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const auditDirty = useRef(new Set<string>());
  const audit = useCallback((action: string, entity: string, entity_id: string, detail?: string) => {
    const t = today();
    const k = `${t.jy}-${pad(t.jm)}`;
    const D = dataRef.current;
    const doc = (D.audit[k] ||= { entries: [] });
    const u = meRef.current;
    const entry: AuditEntry = {
      at: nowIso(),
      user: u?.username || 'system',
      role: u?.role || '',
      action,
      entity,
      entity_id,
      detail: detail || '',
    };
    doc.entries.unshift(entry);
    if (doc.entries.length > 300) doc.entries.length = 300;
    auditDirty.current.add(k);
    if (auditTimer.current) clearTimeout(auditTimer.current);
    auditTimer.current = setTimeout(() => {
      for (const id of auditDirty.current) void backend.put('audit_logs', id, D.audit[id]!).catch(() => undefined);
      auditDirty.current.clear();
    }, 700);
  }, []);

  /* ---------- load ---------- */
  const loadAll = useCallback(async () => {
    const [org, settings, users, centers, heads, periods, versions, actuals, bills, variances, inv, audits, entries, staff, accounts, capex, proposals] =
      await Promise.all([
        backend.get<Org>('org', 'main'),
        backend.get<Settings>('settings', 'main'),
        backend.list<User>('users'),
        backend.list<Center>('centers'),
        backend.list<Head>('heads'),
        backend.list<Period>('periods'),
        backend.list<Version>('versions'),
        backend.list<Actual>('actuals'),
        backend.list<Bill>('bills'),
        backend.list<VarianceNote>('variances'),
        backend.list<InvTrack>('inv_track'),
        backend.list<{ id: string; entries: AuditEntry[] }>('audit_logs'),
        backend.list<Entry>('entries'),
        backend.list<StaffPay>('staff'),
        backend.list<Account>('accounts'),
        backend.list<Capex>('capex'),
        backend.list<AgentProposal>('proposals'),
      ]);
    dataRef.current = {
      org: { ...DEFAULT_ORG, ...(org || {}) },
      settings: { ...clone(DEFAULT_SETTINGS), ...(settings || {}) },
      users,
      centers: centers.sort(byOrder),
      heads: heads.sort(byOrder),
      periods: periods.sort((a, b) => a.start_jy * 12 + a.start_jm - (b.start_jy * 12 + b.start_jm)),
      versions,
      actuals: Object.fromEntries(actuals.map((a) => [a.id, a])),
      bills,
      variances: Object.fromEntries(variances.map((v) => [v.id, v])),
      inv: Object.fromEntries(inv.map((v) => [v.id, v])),
      audit: Object.fromEntries(audits.map((d) => [d.id, { entries: d.entries || [] }])),
      entries: entries.sort((a, b) => a.month.localeCompare(b.month) || a.id.localeCompare(b.id, 'en', { numeric: true })),
      staff: staff.sort((a, b) => a.month.localeCompare(b.month) || a.id.localeCompare(b.id, 'en', { numeric: true })),
      accounts: accounts.sort((a, b) => a.kind.localeCompare(b.kind) || Number(BigInt(b.amount) - BigInt(a.amount) > 0n) - Number(BigInt(b.amount) - BigInt(a.amount) < 0n)),
      capex: capex.sort((a, b) => a.month.localeCompare(b.month) || (a.date || '').localeCompare(b.date || '')),
      proposals: proposals.sort((a, b) => b.at.localeCompare(a.at)),
    };
    bump();
    return dataRef.current;
  }, [bump]);

  const pickPeriod = useCallback((D: Data, prefer?: string | null) => {
    const Lx = new Ledger(D);
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem('budgetyar.pid');
    } catch {
      /* */
    }
    const id =
      [prefer, saved].find((x) => x && Lx.periodById(x)) ||
      (D.periods.filter((p) => Lx.monthsWithActual(p).length).at(-1) || D.periods.at(-1))?.id ||
      null;
    setPidState(id ?? null);
  }, []);

  const setPid = useCallback((id: string) => {
    setPidState(id);
    try {
      sessionStorage.setItem('budgetyar.pid', id);
    } catch {
      /* */
    }
  }, []);

  /* boot */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const D = await loadAll().catch(() => null);
      if (!alive) return;
      if (D) {
        const u = sessionUser(D.users);
        if (u) {
          setMe(u);
          pickPeriod(D);
        }
      }
      setReady(true);
    })();
    fetch('/api/ai')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: AiInfo | null) => alive && j && setAi(j))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [loadAll, pickPeriod]);

  const can = useCallback((p: Perm) => roleCan(me?.role, p), [me]);

  /* ---------- helpers ---------- */
  const upsertVersion = (v: Version) => {
    const D = dataRef.current;
    const i = D.versions.findIndex((x) => x.id === v.id);
    if (i >= 0) D.versions[i] = v;
    else D.versions.push(v);
  };
  const username = () => meRef.current?.username || 'system';

  /* ---------- Repo ---------- */
  const repo = useMemo(() => {
    const D = () => dataRef.current;

    const saveVersion = async (d: Version, keepStatus?: boolean) => {
      const v: Version = { ...d, updated_at: nowIso() };
      if (!keepStatus && v.status === 'rejected') v.status = 'draft';
      try {
        const saved = await guardedPut('versions', v);
        upsertVersion(saved);
        bump();
        return saved;
      } catch (e) {
        const x = e as { conflict?: boolean; current?: Version };
        if (x.conflict && x.current) {
          upsertVersion(x.current);
          bump();
        }
        throw e;
      }
    };

    const saveSettings = async (patch: Partial<Settings>, silent?: boolean) => {
      const next = { ...D().settings, ...patch, id: 'main' };
      await backend.put('settings', 'main', next);
      D().settings = next;
      if (!silent) audit('update', 'settings', 'main', 'تغییر تنظیمات');
      bump();
    };

    const createStructure = async () => {
      if (D().centers.length) return;
      const { centers, heads } = defaultStructure();
      await pool(centers, 6, (c) => backend.put('centers', c.id, c));
      await pool(heads, 6, (h) => backend.put('heads', h.id, h));
      D().centers = centers;
      D().heads = heads;
    };

    const loadSample = async () => {
      await createStructure();
      const users = D().users;
      const acc = users.find((u) => u.role === 'accountant')?.username || username();
      const mgr = users.find((u) => u.role === 'manager')?.username || username();
      const s = sampleData(acc, mgr, D().heads);
      await pool(s.periods, 2, (p) => backend.put('periods', p.id, p));
      await pool(s.versions, 3, (v) => backend.put('versions', v.id, v));
      await pool(s.actuals, 6, (a) => backend.put('actuals', a.id, a));
      await pool(s.bills, 6, (b) => backend.put('bills', b.id, b));
      await pool(s.variances, 4, (v) => backend.put('variances', v.id.replace(/\|/g, '_'), { ...v, id: v.id.replace(/\|/g, '_') }));
      await pool(s.inv, 4, (x) => backend.put('inv_track', x.id, x));
      await saveSettings({ has_sample: true }, true);
      const fresh = await loadAll();
      setPid(s.periods[0]!.id);
      audit('create', 'sample', '-', 'داده نمونه نمایندگی');
      return fresh;
    };

    return {
      saveVersion,
      saveSettings,
      loadSample,

      async createPeriod(f: Pick<Period, 'title' | 'type' | 'start_jy' | 'start_jm' | 'months'>) {
        const p: Period = { id: uid('p_'), ...f, created_by: username(), created_at: nowIso() };
        await backend.put('periods', p.id, p);
        D().periods.push(p);
        D().periods.sort((a, b) => a.start_jy * 12 + a.start_jm - (b.start_jy * 12 + b.start_jm));
        audit('create', 'period', p.id, p.title);
        bump();
        return p;
      },

      async createInitial(pid: string) {
        const Lx = L();
        const p = Lx.periodById(pid)!;
        const n = p.months;
        const z = () => Array<string>(n).fill('0');
        const v: Version = {
          id: uid('v_'), period_id: pid, number: 0, title: `بودجه ${p.title}`, status: 'draft', reason: '', wizard_step: 0,
          created_by: username(), created_at: nowIso(), updated_at: nowIso(), rev: 0,
          revenue: Lx.revCenters().map((c) => ({ center: c.id, months: z() })),
          expense: D().heads.filter((h) => h.active && !h.payroll).map((h) => ({ head: h.id, center: h.default_center || Lx.costCenters()[0]?.id || '', months: z() })),
          payroll: Lx.costCenters().filter((c) => c.has_staff !== false).map((c) => ({ center: c.id, headcount: '0', base: '0', overtime: '0', benefits: '0', bonus: '0', insurance: '0', eidi: '0', other: '0' })),
          investments: [],
        };
        const saved = await guardedPut('versions', v);
        upsertVersion(saved);
        audit('create', 'budget', v.id, `ایجاد بودجه ${p.title}`);
        bump();
        return saved;
      },

      async createRevision(pid: string, reason: string) {
        const Lx = L();
        const base = Lx.activeV(pid);
        if (!base) throw userErr('برای این دوره بودجه تأییدشده‌ای نیست.');
        if (Lx.openV(pid)) throw userErr('یک نسخه باز (پیش‌نویس یا منتظر تأیید) برای این دوره وجود دارد.');
        if (String(reason).trim().length < 5) throw userErr('دلیل اصلاحیه را بنویسید (حداقل ۵ نویسه).');
        const v: Version = {
          ...clone(base),
          id: uid('v_'),
          number: Math.max(...Lx.versionsOf(pid).map((x) => x.number)) + 1,
          status: 'draft', base_version_id: base.id, reason: String(reason).trim(), wizard_step: 1,
          created_by: username(), created_at: nowIso(), updated_at: nowIso(),
          submitted_by: null, submitted_at: null, decided_by: null, decided_at: null, decision_note: '', rev: 0,
        };
        delete v.sample;
        delete v.ai_chat;
        delete v.ai_notes;
        delete v.ai_assumptions;
        delete v.ai_questions;
        delete v.ai_built_at;
        const saved = await guardedPut('versions', v);
        upsertVersion(saved);
        audit('create', 'revision', v.id, `${vLabel(v)} — ${v.reason}`);
        bump();
        return saved;
      },

      async submit(d: Version) {
        const errs = L().validateVersion(d);
        if (errs.length) throw { user: errs[0], all: errs };
        const saved = await saveVersion({ ...d, status: 'submitted', submitted_by: username(), submitted_at: nowIso() });
        audit('submit', 'budget', d.id, `${vLabel(d)} برای تأیید ارسال شد`);
        return saved;
      },

      async decide(id: string, approve: boolean, note: string) {
        const v = D().versions.find((x) => x.id === id);
        if (!v || v.status !== 'submitted') throw userErr('این نسخه منتظر تأیید نیست.');
        if (!approve && String(note).trim().length < 3) throw userErr('برای برگشت دادن، توضیح بنویسید.');
        const saved = await saveVersion(
          { ...v, status: approve ? 'approved' : 'rejected', decided_by: username(), decided_at: nowIso(), decision_note: String(note || '').trim() },
          true,
        );
        audit(approve ? 'approve' : 'reject', 'budget', id, `${vLabel(v)}${note ? ` — ${note}` : ''}`);
        return saved;
      },

      async saveActual(mk: string, data: Partial<Actual>) {
        const cur = D().actuals[mk] || { id: mk, revenue: {}, expense: {}, payroll: {}, closed: false, rev: 0 };
        if (cur.closed) throw userErr('این ماه بسته شده است. برای تغییر، مدیر باید ماه را باز کند.');
        const next: Actual = { ...cur, ...data, id: mk, saved_at: nowIso(), updated_by: username() };
        try {
          const s = await guardedPut('actuals', next);
          D().actuals[mk] = s;
          audit('update', 'actual', mk, `ثبت عملکرد ${mkLabel(mk)}`);
          bump();
          return s;
        } catch (e) {
          const x = e as { conflict?: boolean; current?: Actual };
          if (x.conflict && x.current) {
            D().actuals[mk] = x.current;
            bump();
          }
          throw e;
        }
      },

      async setClosed(mk: string, closed: boolean) {
        const cur = D().actuals[mk] || { id: mk, revenue: {}, expense: {}, payroll: {}, rev: 0 };
        const s = await guardedPut('actuals', { ...cur, closed, saved_at: cur.saved_at || nowIso(), closed_by: username() });
        D().actuals[mk] = s;
        audit(closed ? 'close' : 'reopen', 'actual', mk, mkLabel(mk));
        bump();
      },

      async saveBill(b: Bill) {
        const e = validateBill(L(), b);
        if (e) throw userErr(e);
        const rec: Bill = { ...b, id: b.id || uid('b_'), updated_by: username(), updated_at: nowIso() };
        await backend.put('bills', rec.id, rec);
        const list = D().bills;
        const i = list.findIndex((x) => x.id === rec.id);
        if (i >= 0) list[i] = rec;
        else list.push(rec);
        audit(b.id ? 'update' : 'create', 'bill', rec.id, `${BILL_TYPES[rec.type]} ${mkLabel(rec.month)} — ${nf(rec.amount)}`);
        bump();
      },

      async deleteBill(id: string) {
        const b = D().bills.find((x) => x.id === id);
        await backend.del('bills', id);
        D().bills = D().bills.filter((x) => x.id !== id);
        audit('delete', 'bill', id, b ? `${BILL_TYPES[b.type]} ${mkLabel(b.month)}` : '');
        bump();
      },

      async saveVariance(rec: Omit<VarianceNote, 'by' | 'at'>) {
        const r: VarianceNote = { ...rec, by: username(), at: nowIso() };
        await backend.put('variances', r.id, r);
        D().variances[r.id] = r;
        audit('explain', 'variance', r.id, `${r.label}: ${r.reason}`);
        bump();
      },

      async saveInv(id: string, patch: Partial<InvTrack>) {
        const cur = D().inv[id] || { id, status: 'planned', progress: 0, actual: '0' };
        const next: InvTrack = { ...cur, ...patch, updated_by: username(), updated_at: nowIso() };
        await backend.put('inv_track', id, next);
        D().inv[id] = next;
        audit('update', 'investment', id, `${INV_STATUS[next.status]} · ${fa(next.progress)}٪`);
        bump();
      },

      /** ورود کامل فایل اکسل اطلاعات اولیه: داده‌ی کسب‌وکار جایگزین می‌شود؛ کاربران و تنظیمات می‌مانند. */
      async importBundle(b: ImportBundle, file: string) {
        const d = D();
        const wipe: Record<string, { id: string }[]> = {
          centers: d.centers, heads: d.heads, periods: d.periods, versions: d.versions, actuals: Object.values(d.actuals),
          bills: d.bills, variances: Object.values(d.variances), inv_track: Object.values(d.inv),
          entries: d.entries, staff: d.staff, accounts: d.accounts, capex: d.capex, proposals: d.proposals,
        };
        for (const [col, items] of Object.entries(wipe)) await pool(items, 8, (x) => backend.del(col, x.id));
        const put = async (col: string, items: { id: string }[]) => pool(items, 8, (x) => backend.put(col, x.id, x));
        await put('centers', b.centers);
        await put('heads', b.heads);
        await put('periods', b.periods);
        await put('versions', b.versions);
        await put('actuals', b.actuals);
        await put('bills', b.bills);
        await put('entries', b.entries);
        await put('staff', b.staff);
        await put('accounts', b.accounts);
        await put('capex', b.capex);
        await saveSettings({ has_sample: false, import_info: importInfo(b, file, username(), nowIso()) }, true);
        const fresh = await loadAll();
        const hist = fresh.periods.filter((p) => p.history).at(-1);
        if (hist) setPid(hist.id);
        audit('create', 'import', '-', `${file} — ${fa(b.counts.entries ?? 0)} ردیف سند، ${fa(b.counts.staff_rows ?? 0)} ردیف حقوق`);
        return fresh;
      },

      async saveAccount(a: Account) {
        if (String(a.party || '').trim().length < 2) throw userErr('نام طرف حساب را بنویسید.');
        if (B(a.amount) <= 0n) throw userErr('مبلغ را وارد کنید.');
        if (a.settled && B(a.settled) > B(a.amount)) throw userErr('مبلغ تسویه‌شده بیشتر از کل مبلغ است.');
        const rec: Account = { ...a, id: a.id || uid('a_'), updated_by: username(), updated_at: nowIso() };
        await backend.put('accounts', rec.id, rec);
        const i = D().accounts.findIndex((x) => x.id === rec.id);
        if (i >= 0) D().accounts[i] = rec;
        else D().accounts.push(rec);
        audit(a.id ? 'update' : 'create', 'account', rec.id, `${rec.party} — ${nf(rec.amount)}`);
        bump();
        return rec;
      },

      async deleteAccount(id: string) {
        const a = D().accounts.find((x) => x.id === id);
        await backend.del('accounts', id);
        D().accounts = D().accounts.filter((x) => x.id !== id);
        audit('delete', 'account', id, a?.party || '');
        bump();
      },

      async saveProposal(p: AgentProposal) {
        await backend.put('proposals', p.id, p);
        const i = D().proposals.findIndex((x) => x.id === p.id);
        if (i >= 0) D().proposals[i] = p;
        else D().proposals.unshift(p);
        bump();
        return p;
      },

      async saveOrg(patch: Partial<Org>) {
        const next = { ...D().org, ...patch, id: 'main' };
        await backend.put('org', 'main', next);
        D().org = next;
        audit('update', 'theme', 'main', 'تغییر نام سازمان');
        bump();
      },

      async saveCenter(c: Partial<Center> & Pick<Center, 'kind' | 'name'>) {
        const rec = { ...c, id: c.id || uid('c_'), order: c.order ?? D().centers.length, active: c.active ?? true } as Center;
        await backend.put('centers', rec.id, rec);
        const i = D().centers.findIndex((x) => x.id === rec.id);
        if (i >= 0) D().centers[i] = rec;
        else D().centers.push(rec);
        audit(c.id ? 'update' : 'create', 'center', rec.id, rec.name);
        bump();
      },

      async saveHead(h: Partial<Head> & Pick<Head, 'name' | 'kind' | 'default_center'>) {
        const rec = { ...h, id: h.id || uid('h_'), order: h.order ?? D().heads.length, active: h.active ?? true } as Head;
        await backend.put('heads', rec.id, rec);
        const i = D().heads.findIndex((x) => x.id === rec.id);
        if (i >= 0) D().heads[i] = rec;
        else D().heads.push(rec);
        audit(h.id ? 'update' : 'create', 'head', rec.id, rec.name);
        bump();
      },

      async saveUser(u: User) {
        await backend.put('users', u.id, u);
        const i = D().users.findIndex((x) => x.id === u.id);
        if (i >= 0) D().users[i] = u;
        else D().users.push(u);
        if (meRef.current?.id === u.id) setMe(u);
        bump();
      },

      async removeSample() {
        const del = async (col: string, items: { id: string }[]) => pool(items, 6, (x) => backend.del(col, x.id));
        const d = D();
        await del('versions', d.versions.filter((v) => v.sample));
        await del('periods', d.periods.filter((p) => p.sample));
        await del('actuals', Object.values(d.actuals).filter((a) => a.sample));
        await del('bills', d.bills.filter((b) => b.sample));
        await del('variances', Object.values(d.variances).filter((v) => v.sample));
        await del('inv_track', Object.values(d.inv).filter((v) => v.sample));
        await saveSettings({ has_sample: false }, true);
        const fresh = await loadAll();
        const last = fresh.periods.at(-1)?.id;
        if (last) setPid(last);
        else setPidState(null);
        audit('delete', 'sample', '-', 'حذف داده نمونه');
      },

      backupJson() {
        const d = D();
        audit('create', 'backup', '-', 'دریافت پشتیبان');
        return JSON.stringify({
          app: 'budgetyar', version: 2, exported_at: nowIso(), org: d.org, settings: d.settings,
          centers: d.centers, heads: d.heads, periods: d.periods, versions: d.versions,
          actuals: Object.values(d.actuals), bills: d.bills, variances: Object.values(d.variances), inv_track: Object.values(d.inv),
          entries: d.entries, staff: d.staff, accounts: d.accounts, capex: d.capex, proposals: d.proposals,
        });
      },

      async restore(b: BackupFile) {
        const d = D();
        const cur: Record<string, { id: string }[]> = {
          centers: d.centers, heads: d.heads, periods: d.periods, versions: d.versions,
          actuals: Object.values(d.actuals), bills: d.bills, variances: Object.values(d.variances), inv_track: Object.values(d.inv),
          entries: d.entries, staff: d.staff, accounts: d.accounts, capex: d.capex, proposals: d.proposals,
        };
        for (const col of Object.keys(cur)) {
          const incoming = (b as unknown as Record<string, { id: string }[] | undefined>)[col] ?? [];
          const keep = new Set(incoming.map((x) => x.id));
          await pool(cur[col]!.filter((x) => !keep.has(x.id)), 6, (x) => backend.del(col, x.id));
          await pool(incoming, 6, (x) => backend.put(col, x.id, x));
        }
        await backend.put('org', 'main', { ...b.org, id: 'main' });
        await backend.put('settings', 'main', { ...b.settings, id: 'main' });
        const fresh = await loadAll();
        const last = fresh.periods.at(-1)?.id;
        if (last) setPid(last);
        audit('restore', 'backup', '-', '');
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit, bump, loadAll, setPid]);

  /* ---------- auth ---------- */
  const failed = useRef({ n: 0, lockUntil: 0 });

  const enter = useCallback(
    (u: User, D: Data) => {
      setSession(u);
      setMe(u);
      pickPeriod(D);
    },
    [pickPeriod],
  );

  const login = useCallback(
    async (un: string, pw: string): Promise<string | null> => {
      const f = failed.current;
      if (Date.now() < f.lockUntil)
        return `چند تلاش ناموفق. ${fa(Math.ceil((f.lockUntil - Date.now()) / 1000))} ثانیه دیگر دوباره امتحان کنید.`;
      if (!un.trim() || !pw) return 'نام کاربری و رمز عبور را وارد کنید.';
      const D = await loadAll();
      const u = D.users.find((x) => x.username.toLowerCase() === un.trim().toLowerCase() && x.active);
      // برای کاربر ناموجود هم همان هزینه‌ی هش پرداخت می‌شود تا زمان پاسخ چیزی لو ندهد
      const ok = u
        ? (await hashPw(pw, u.salt, u.iterations)) === u.password_hash
        : (await hashPw(pw, 'AAAAAAAAAAAAAAAAAAAAAA==', 210000), false);
      if (!ok || !u) {
        f.n++;
        if (f.n >= 5) {
          f.lockUntil = Date.now() + 60000;
          f.n = 0;
        }
        return 'نام کاربری یا رمز عبور درست نیست.';
      }
      f.n = 0;
      meRef.current = u;
      audit('login', 'user', u.id, '');
      enter(u, D);
      return null;
    },
    [audit, enter, loadAll],
  );

  const setup = useCallback(
    async (f: {
      org: string;
      username: string;
      password: string;
      fullName: string;
      accUser: string;
      accPw: string;
      sample: boolean;
    }) => {
      const m = await makeUser(f.username, f.password, 'manager', f.fullName);
      await repo.saveUser(m);
      meRef.current = m;
      if (f.accUser) await repo.saveUser(await makeUser(f.accUser, f.accPw, 'accountant', ''));
      await repo.saveOrg({ name: f.org });
      await repo.saveSettings({}, true);
      const { centers, heads } = defaultStructure();
      if (!dataRef.current.centers.length) {
        await pool(centers, 6, (c) => backend.put('centers', c.id, c));
        await pool(heads, 6, (h) => backend.put('heads', h.id, h));
      }
      const D = f.sample ? await repo.loadSample() : await loadAll();
      audit('create', 'user', m.id, 'راه‌اندازی سامانه');
      enter(m, D);
    },
    [audit, enter, loadAll, repo],
  );

  const logout = useCallback(() => {
    if (meRef.current) audit('logout', 'user', meRef.current.id, '');
    clearSession();
    setMe(null);
  }, [audit]);

  const changePassword = useCallback(
    async (cur: string, next: string) => {
      const u = meRef.current!;
      if ((await hashPw(cur, u.salt, u.iterations)) !== u.password_hash) throw userErr('رمز فعلی درست نیست.');
      const nu = await makeUser(u.username, next, u.role, u.full_name);
      const rec = { ...nu, created_at: u.created_at, active: true };
      await repo.saveUser(rec);
      setSession(rec);
      audit('password', 'user', rec.id, '');
    },
    [audit, repo],
  );

  const addUser = useCallback(
    async (u: string, pw: string, role: Role, full: string) => {
      const nu = await makeUser(u, pw, role, full);
      await repo.saveUser(nu);
      audit('access', 'user', nu.id, `${u}`);
    },
    [audit, repo],
  );

  return {
    ready,
    data: dataRef.current,
    ledger,
    rev,
    me,
    pid,
    setPid,
    can,
    repo,
    audit,
    toast,
    toasts,
    ai,
    login,
    setup,
    logout,
    changePassword,
    addUser,
    errMsg,
  };
}

export interface BackupFile {
  app: 'budgetyar';
  version: 2;
  org: Org;
  settings: Settings;
  centers: Center[];
  heads: Head[];
  periods: Period[];
  versions: Version[];
  actuals: Actual[];
  bills: Bill[];
  variances: VarianceNote[];
  inv_track: InvTrack[];
  entries?: Entry[];
  staff?: StaffPay[];
  accounts?: Account[];
  capex?: Capex[];
  proposals?: AgentProposal[];
}

export function validBackup(d: unknown): d is BackupFile {
  const x = d as Record<string, unknown> | null;
  return (
    !!x &&
    x.app === 'budgetyar' &&
    x.version === 2 &&
    ['centers', 'heads', 'periods', 'versions', 'actuals', 'bills', 'variances', 'inv_track'].every((k) =>
      Array.isArray(x[k]),
    ) &&
    (x.versions as Version[]).every((v) => typeof v.id === 'string' && Array.isArray(v.revenue))
  );
}

export const backupFileName = (kind: string, ext: string) => `budgetyar-${kind}-${localIso(new Date())}.${ext}`;

type StoreValue = ReturnType<typeof useStoreState>;
const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const v = useStoreState();
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider missing');
  return v;
}

/** دوره‌ی جاری با Ledger — بیشتر صفحه‌ها همین را لازم دارند. */
export function usePeriod() {
  const s = useStore();
  const period = s.ledger.periodById(s.pid);
  return { ...s, period };
}
