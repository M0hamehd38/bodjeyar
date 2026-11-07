/**
 * API پایگاه داده — خواندن، نوشتن و حذف سند. فقط برای رابط `Backend` در مرورگر.
 *
 * احراز هویت برنامه سمت مرورگر است، پس خودِ این مسیر باید پشت دروازه‌ی بیرونی
 * (ورود پروکسی) باشد؛ این‌جا فقط ورودی اعتبارسنجی می‌شود و هدر X-Requested-With
 * برای نوشتن و حذف لازم است تا فرم‌های سایت دیگر نتوانند چیزی بنویسند.
 */

import { NextResponse } from 'next/server';
import { dbDelete, dbGet, dbList, dbPut } from '@/lib/db-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COL = /^[a-z][a-z0-9_]{0,31}$/;
const ID = /^[^\s/\\]{1,128}$/;
const MAX_BODY = 5_000_000;

const bad = (code: string, status = 400) => NextResponse.json({ error: code }, { status });
const noStore = { 'Cache-Control': 'no-store' };

function params(req: Request) {
  const u = new URL(req.url);
  return { col: u.searchParams.get('col') || '', id: u.searchParams.get('id') };
}

export function GET(req: Request) {
  const { col, id } = params(req);
  if (!COL.test(col)) return bad('invalid_collection');
  if (id !== null) {
    if (!ID.test(id)) return bad('invalid_id');
    return NextResponse.json({ doc: dbGet(col, id) }, { headers: noStore });
  }
  return NextResponse.json({ docs: dbList(col) }, { headers: noStore });
}

export async function PUT(req: Request) {
  if (req.headers.get('x-requested-with') !== 'budgetyar') return bad('forbidden', 403);
  const text = await req.text();
  if (text.length > MAX_BODY) return bad('too_large', 413);
  let body: { col?: string; id?: string; data?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return bad('invalid_json');
  }
  if (!body.col || !COL.test(body.col)) return bad('invalid_collection');
  if (!body.id || !ID.test(body.id)) return bad('invalid_id');
  if (typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) return bad('invalid_data');
  dbPut(body.col, body.id, body.data);
  return NextResponse.json({ ok: true }, { headers: noStore });
}

export function DELETE(req: Request) {
  if (req.headers.get('x-requested-with') !== 'budgetyar') return bad('forbidden', 403);
  const { col, id } = params(req);
  if (!COL.test(col)) return bad('invalid_collection');
  if (!id || !ID.test(id)) return bad('invalid_id');
  dbDelete(col, id);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
