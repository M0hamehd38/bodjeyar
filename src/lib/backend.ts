/**
 * لایه‌ی ذخیره‌سازی — مجموعه‌ها و سندها مثل یک پایگاه داده‌ی سندی.
 *
 * فعلاً حافظه‌ی همین مرورگر (localStorage) است؛ همان کلید و ساختار نسخه‌ی
 * آرتیفکت، تا داده‌ی قبلی بدون تبدیل خوانده شود. برای سرور مشترک کافی است همین
 * رابط `Backend` با فراخوانی API پیاده شود — بقیه‌ی برنامه به آن دست نمی‌زند.
 */

import { clone } from './format';

const LKEY = 'budgetyar.v2';

type Store = Record<string, Record<string, Record<string, unknown>>>;

export interface Backend {
  get<T>(col: string, id: string): Promise<T | null>;
  list<T>(col: string): Promise<T[]>;
  put<T extends object>(col: string, id: string, data: T): Promise<void>;
  del(col: string, id: string): Promise<void>;
}

class LocalBackend implements Backend {
  private cache: Store | null = null;

  private read(): Store {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(localStorage.getItem(LKEY) || '{}') as Store;
    } catch {
      this.cache = {};
    }
    return this.cache;
  }
  private persist() {
    try {
      localStorage.setItem(LKEY, JSON.stringify(this.cache));
    } catch (e) {
      throw { code: 'quota_exceeded', cause: e };
    }
  }
  /** تغییر هم‌زمان در زبانه‌ی دیگر: حافظه‌ی موقت دور ریخته شود. */
  invalidate() {
    this.cache = null;
  }

  async get<T>(col: string, id: string) {
    const v = this.read()[col]?.[id];
    return v ? (clone(v) as T) : null;
  }
  async list<T>(col: string) {
    return Object.values(this.read()[col] || {}).map((x) => clone(x) as T);
  }
  async put<T extends object>(col: string, id: string, data: T) {
    const s = this.read();
    (s[col] ||= {})[id] = clone({ ...data, id }) as Record<string, unknown>;
    this.persist();
  }
  async del(col: string, id: string) {
    const s = this.read();
    if (s[col]) delete s[col][id];
    this.persist();
  }
}

/**
 * پیاده‌سازی سرور: همین رابط با فراخوانی /api/db (SQLite روی سرور).
 * با NEXT_PUBLIC_BACKEND=api هنگام build انتخاب می‌شود؛ بدون آن همان localStorage است.
 */
class ApiBackend implements Backend {
  private async call<R>(method: string, qs: string, body?: unknown): Promise<R> {
    const res = await fetch(`/api/db${qs}`, {
      method,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'budgetyar' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw { code: `db_${res.status}` };
    return (await res.json()) as R;
  }
  async get<T>(col: string, id: string) {
    const r = await this.call<{ doc: T | null }>('GET', `?col=${encodeURIComponent(col)}&id=${encodeURIComponent(id)}`);
    return r.doc;
  }
  async list<T>(col: string) {
    const r = await this.call<{ docs: T[] }>('GET', `?col=${encodeURIComponent(col)}`);
    return r.docs;
  }
  async put<T extends object>(col: string, id: string, data: T) {
    await this.call('PUT', '', { col, id, data: { ...data, id } });
  }
  async del(col: string, id: string) {
    await this.call('DELETE', `?col=${encodeURIComponent(col)}&id=${encodeURIComponent(id)}`);
  }
}

const local = new LocalBackend();
export const backend: Backend = process.env.NEXT_PUBLIC_BACKEND === 'api' ? new ApiBackend() : local;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === LKEY) local.invalidate();
  });
}

/** اجرای موازی محدود */
export async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<unknown>) {
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const k = i++;
      await fn(items[k]!, k);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
}

/** هم‌زمانی خوش‌بینانه: سند `rev` دارد؛ اگر کسی بعد از خواندن ما ذخیره کرده باشد نوشتن رد می‌شود. */
export async function guardedPut<T extends { id: string; rev?: number }>(col: string, obj: T): Promise<T> {
  const cur = await backend.get<T>(col, obj.id);
  if (cur && (cur.rev || 0) !== (obj.rev || 0)) throw { conflict: true, current: cur };
  const next = { ...obj, rev: (obj.rev || 0) + 1 };
  await backend.put(col, obj.id, next);
  return next;
}

export function errMsg(e: unknown): string {
  const x = e as { conflict?: boolean; code?: string; user?: string } | null;
  if (x?.conflict)
    return 'این مورد هم‌زمان در زبانه یا دستگاه دیگری ذخیره شده است. صفحه به‌روز شد؛ تغییرتان را دوباره اعمال کنید.';
  if (x?.code === 'quota_exceeded') return 'فضای ذخیره‌سازی پر است. داده‌های قدیمی یا نمونه را حذف کنید.';
  if (x?.code?.startsWith('db_')) return 'ارتباط با پایگاه داده برقرار نشد. اینترنت را بررسی و دوباره تلاش کنید.';
  return x?.user || 'ذخیره انجام نشد. دوباره تلاش کنید.';
}
