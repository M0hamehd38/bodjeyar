/**
 * رمز عبور: PBKDF2-SHA256 با نمک تصادفی و ۲۱۰٬۰۰۰ دور (Web Crypto).
 * نشست هشت‌ساعته در sessionStorage؛ با بستن مرورگر تمام می‌شود.
 */

import { nowIso } from './format';
import type { Role, User } from './types';

const b64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8));
const b64d = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function hashPw(pw: string, salt: string, iter: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: b64d(salt), iterations: iter, hash: 'SHA-256' },
    key,
    256,
  );
  return b64(new Uint8Array(bits));
}

export async function makeUser(username: string, pw: string, role: Role, full: string): Promise<User> {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  const iter = 210000;
  return {
    id: `u_${username.toLowerCase()}`,
    username,
    full_name: full || '',
    role,
    salt,
    iterations: iter,
    password_hash: await hashPw(pw, salt, iter),
    active: true,
    created_at: nowIso(),
  };
}

export function pwPolicy(pw: string) {
  if (pw.length < 8) return 'رمز حداقل ۸ نویسه باشد.';
  if (!/[A-Za-z؀-ۿ]/.test(pw) || !/\d|[۰-۹]/.test(pw)) return 'رمز باید هم حرف و هم رقم داشته باشد.';
  return '';
}

export const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;

const SKEY = 'budgetyar.session.v2';

export function setSession(u: User) {
  try {
    sessionStorage.setItem(
      SKEY,
      JSON.stringify({ id: u.id, h: u.password_hash.slice(0, 12), exp: Date.now() + 8 * 3600e3 }),
    );
  } catch {
    /* حالت خصوصی مرورگر */
  }
}
export function sessionUser(users: User[]): User | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(SKEY) || 'null') as { id: string; h: string; exp: number } | null;
    if (!s || s.exp < Date.now()) return null;
    const u = users.find((x) => x.id === s.id && x.active);
    return u && u.password_hash.slice(0, 12) === s.h ? u : null;
  } catch {
    return null;
  }
}
export function clearSession() {
  try {
    sessionStorage.removeItem(SKEY);
  } catch {
    /* */
  }
}
