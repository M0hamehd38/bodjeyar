/** مدل داده‌ی بودجه‌یار. مبلغ‌ها رشته‌ی رقمی تومان‌اند تا BigInt بدون خطا بخواند. */

export type Role = 'manager' | 'accountant';
export type Status = 'ok' | 'warn' | 'bad' | 'none';
export type LineType = 'revenue' | 'expense' | 'payroll';
export type VersionStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type InvStatus = 'planned' | 'running' | 'done' | 'stopped';
export type Priority = 'high' | 'mid' | 'low';
export type BillType = 'water' | 'power' | 'phone' | 'internet';
export type PeriodType = 'annual' | 'half1' | 'half2' | 'custom';

export interface Org {
  id?: string;
  name: string;
}

/** دو مدل هوش مصنوعی — همان «مدل دقیق» و «مدل روزمره»ی هوش سازمانی. */
export type AiTier = 'precise' | 'everyday';

export interface Settings {
  id?: string;
  green: number;
  yellow: number;
  scen: { cons: { rev: number; exp: number }; opt: { rev: number; exp: number } };
  has_sample: boolean;
  /** مدل هر کاربرد هوش مصنوعی؛ نبودن یعنی پیش‌فرض همان کاربرد */
  ai_tiers?: Partial<Record<string, AiTier>>;
  /** آخرین ورود از فایل اکسل اطلاعات اولیه */
  import_info?: ImportInfo;
}

export interface ImportInfo {
  file: string;
  at: string;
  by: string;
  counts: Record<string, number>;
  warnings: string[];
}

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  salt: string;
  iterations: number;
  password_hash: string;
  active: boolean;
  created_at: string;
}

export interface Center {
  id: string;
  kind: 'revenue' | 'cost';
  name: string;
  active: boolean;
  order: number;
  /** مرکز درآمد → واحد (مرکز هزینه) مرتبط */
  link?: string;
  /** گروه مرکز درآمد (مثلاً «فروش خودرو» برای کمیسیون هر خودروساز) */
  group?: string;
  has_staff?: boolean;
  created_at?: string;
}

export interface Head {
  id: string;
  name: string;
  kind: 'fixed' | 'variable';
  default_center: string;
  active: boolean;
  order: number;
  payroll?: boolean;
  utility?: BillType;
}

export interface Period {
  id: string;
  title: string;
  type: PeriodType;
  start_jy: number;
  start_jm: number;
  months: number;
  created_by: string;
  created_at: string;
  sample?: boolean;
  /** دوره‌ی مرجع: عملکرد واقعی ثبت شده ولی بودجه‌ای برایش تدوین نشده */
  history?: boolean;
  imported?: boolean;
}

export interface RevenueRow {
  center: string;
  months: string[];
}
export interface ExpenseRow {
  head: string;
  center: string;
  months: string[];
}
export interface PayrollRow {
  center: string;
  headcount: string;
  base: string;
  overtime: string;
  benefits: string;
  bonus: string;
  insurance: string;
  eidi: string;
  other: string;
}
export type PayField = 'base' | 'overtime' | 'benefits' | 'bonus' | 'insurance' | 'eidi' | 'other';

export interface Investment {
  id: string;
  title: string;
  center: string;
  type: string;
  amount: string;
  month: number;
  priority: Priority;
  description: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface Version {
  id: string;
  period_id: string;
  number: number;
  title: string;
  status: VersionStatus;
  reason: string;
  wizard_step: number;
  base_version_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_by?: string | null;
  submitted_at?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  decision_note?: string;
  rev: number;
  revenue: RevenueRow[];
  expense: ExpenseRow[];
  payroll: PayrollRow[];
  investments: Investment[];
  sample?: boolean;
  ai_chat?: ChatTurn[];
  ai_notes?: Record<string, string>;
  ai_assumptions?: string[];
  ai_questions?: string[];
  ai_built_at?: string;
}

export interface Actual {
  id: string; // کلید ماه: 1405-07
  revenue: Record<string, string>;
  expense: Record<string, string>;
  payroll: Record<string, string>;
  closed?: boolean;
  saved_at?: string;
  updated_by?: string;
  closed_by?: string;
  rev: number;
  sample?: boolean;
}

export interface Bill {
  id: string;
  type: BillType;
  subscription?: string;
  meter?: string;
  location?: string;
  amount: string;
  month: string;
  pay_date?: string;
  mode: 'direct' | 'shared';
  center?: string;
  alloc: { center: string; pct: number }[];
  updated_by?: string;
  updated_at?: string;
  sample?: boolean;
}

export interface VarianceNote {
  id: string;
  month: string;
  type: LineType;
  key?: string;
  label: string;
  reason: string;
  action: string;
  comment: string;
  ai?: boolean;
  budget?: string;
  actual?: string;
  by: string;
  at: string;
  sample?: boolean;
}

export interface InvTrack {
  id: string;
  status: InvStatus;
  progress: number;
  actual: string;
  updated_by?: string;
  updated_at?: string;
  sample?: boolean;
}

/** ریز هر قلم سند (ردیف فایل حسابداری) — مبنای عدد ماه، تا هیچ جزئیاتی گم نشود. */
export interface Entry {
  id: string;
  month: string; // 1405-01
  type: LineType;
  /** کلید همان ردیف در عملکرد: مرکز درآمد، head|center یا مرکز حقوق */
  key: string;
  center: string;
  head?: string;
  /** شرح اصلی همان‌طور که در فایل آمده */
  desc: string;
  sub?: string;
  amount: string;
  kind?: 'fixed' | 'variable';
  shared?: boolean;
  status?: string;
  note?: string;
  ref?: string;
  source: string;
  imported?: boolean;
}

/** حقوق یک نفر در یک ماه — ستون‌های شیت «حقوق و مزایا». */
export interface StaffPay {
  id: string;
  month: string;
  person: string;
  unit: string;
  center?: string;
  base: string;
  overtime: string;
  benefits: string;
  bonus: string;
  insurance: string;
  eidi: string;
  commute: string;
  card: string;
  total: string;
  note?: string;
  source: string;
  imported?: boolean;
}

export type AccountKind = 'receivable' | 'payable';
export type AccountStatus = 'open' | 'partial' | 'settled';

/** مطالبات و حساب‌های پرداختنی مهم */
export interface Account {
  id: string;
  kind: AccountKind;
  party: string;
  category?: string;
  amount: string;
  /** مبلغ وصول یا پرداخت‌شده (اگر بخشی تسویه شده) */
  settled?: string;
  status: AccountStatus;
  created?: string;
  due_days?: number;
  note?: string;
  followup?: string;
  source?: string;
  updated_by?: string;
  updated_at?: string;
  imported?: boolean;
}

/** خرید سرمایه‌ای انجام‌شده (تجهیزات، ابزار، بازسازی) */
export interface Capex {
  id: string;
  month: string;
  title: string;
  center: string;
  unit?: string;
  amount: string;
  date?: string;
  necessity?: string;
  status?: string;
  vendor?: string;
  note?: string;
  source?: string;
  imported?: boolean;
}

/** پیشنهاد ایجنت که فقط با تأیید آدم اعمال می‌شود */
export interface AgentProposal {
  id: string;
  kind: 'variance_note' | 'budget_line' | 'account_followup' | 'task';
  title: string;
  detail: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'applied' | 'dismissed';
  by: string;
  at: string;
  decided_by?: string;
  decided_at?: string;
}

export interface AuditEntry {
  at: string;
  user: string;
  role: Role | '';
  action: string;
  entity: string;
  entity_id: string;
  detail: string;
}

export interface Data {
  org: Org;
  settings: Settings;
  users: User[];
  centers: Center[];
  heads: Head[];
  periods: Period[];
  versions: Version[];
  actuals: Record<string, Actual>;
  bills: Bill[];
  variances: Record<string, VarianceNote>;
  inv: Record<string, InvTrack>;
  audit: Record<string, { entries: AuditEntry[] }>;
  entries: Entry[];
  staff: StaffPay[];
  accounts: Account[];
  capex: Capex[];
  proposals: AgentProposal[];
}

export interface Month {
  jy: number;
  jm: number;
  k: string;
  i: number;
}

/** یک ردیف بودجه پس از یکسان‌سازی درآمد/هزینه/حقوق. */
export interface Line {
  type: LineType;
  key: string;
  center: string;
  head?: string;
  label: string;
  months: bigint[];
  unbudgeted?: boolean;
}

export interface Row extends Line {
  budget: bigint;
  actual: bigint;
  diff: bigint;
  pct: number | null;
  ach: number | null;
  status: Status;
  fav: boolean;
}

export interface Totals {
  budget: bigint;
  actual: bigint;
  diff: bigint;
  pct: number | null;
  ach: number | null;
  status: Status;
}
