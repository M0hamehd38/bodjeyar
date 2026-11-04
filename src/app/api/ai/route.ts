/**
 * دستیار هوش مصنوعی — سمت سرور. کلیدها هرگز به مرورگر نمی‌روند.
 *
 * دو مدل مثل «هوش سازمانی»: «مدل دقیق» و «مدل روزمره»؛ مرورگر سطح هر کاربرد را
 * از تنظیمات سازمان می‌فرستد و این مسیر آن را به مدل و کلید همان سطح می‌برد.
 *
 * ابزارها (tools) برای ایجنت: این مسیر فقط یک دور مدل را اجرا می‌کند و اگر مدل
 * ابزاری خواست، همان را برمی‌گرداند؛ ابزارها در مرورگر روی داده‌ی همان کاربر
 * اجرا می‌شوند (داده‌ی بودجه‌یار در مرورگر است، نه روی سرور).
 *
 * هوش مصنوعی پیش‌نویس می‌دهد؛ تأیید، بستن ماه و ارسال نهایی همیشه با آدم است.
 */

import { NextResponse } from 'next/server';
import { isTier } from '@/lib/ai-purposes';
import { AiFail, chat, extractJson, loadAiConfig, type ChatMessage, type ToolDef } from '@/lib/ai-server';
import type { AiTier } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function GET() {
  const c = loadAiConfig();
  return NextResponse.json({
    on: c.configured,
    images: c.configured,
    tools: c.configured,
    provider: c.provider,
    tiers: {
      precise: { model: c.tiers.precise.model, on: c.tiers.precise.on },
      everyday: { model: c.tiers.everyday.model, on: c.tiers.everyday.on },
    },
    missing: c.enabled ? c.missing : ['AI_ENABLED=0'],
  });
}

interface Body {
  messages: ChatMessage[];
  system?: string;
  json?: boolean;
  tier?: AiTier;
  /** سازگاری با فراخوانی‌های قدیمی: complex ⇒ مدل دقیق */
  complex?: boolean;
  tools?: ToolDef[];
  images?: { media_type: string; data: string }[];
  max_tokens?: number;
  temperature?: number;
}

const fail = (code: string, status = 400) => NextResponse.json({ error: code }, { status });

export async function POST(req: Request) {
  const cfg = loadAiConfig();
  if (!cfg.configured) return fail('sampling_disabled', 503);
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return fail('invalid_request');
  }
  const turns = (body.messages || []).filter(
    (m) => m && ['user', 'assistant', 'tool', 'system'].includes(m.role) && typeof m.content === 'string' && (m.content.trim() || m.tool_calls?.length || m.role === 'tool'),
  );
  if (!turns.some((m) => m.role === 'user')) return fail('invalid_request');
  if (JSON.stringify(turns).length > 600_000) return fail('prompt_too_large', 413);

  const images = (body.images || []).slice(0, 5);
  for (const im of images) if (!IMAGE_TYPES.includes(im.media_type) || im.data.length > 27_000_000) return fail('image_rejected');

  const tools = (body.tools || []).slice(0, 40).filter((t) => t && /^[a-zA-Z0-9_-]{1,64}$/.test(t.name));
  const tier: AiTier = isTier(body.tier) ? body.tier : body.complex || images.length ? 'precise' : 'everyday';
  const messages: ChatMessage[] = [
    ...(body.system ? [{ role: 'system' as const, content: body.system }] : []),
    ...turns,
  ];

  try {
    const res = await chat(cfg, messages, {
      tier,
      tools: tools.length ? tools : undefined,
      json: body.json,
      images,
      maxTokens: Math.min(Math.max(body.max_tokens || 12000, 256), 32000),
      temperature: body.temperature,
      signal: req.signal,
    });
    if (res.finish === 'refusal') return fail('refused', 422);
    if (res.toolCalls.length) return NextResponse.json({ text: res.content, tool_calls: res.toolCalls, model: res.model, tier });
    const text = res.content.trim();
    if (!text) return fail('empty_completion', 502);
    if (!body.json) return NextResponse.json({ text, model: res.model, tier });
    try {
      return NextResponse.json({ json: extractJson(text), model: res.model, tier });
    } catch {
      return fail('invalid_json', 502);
    }
  } catch (e) {
    if (e instanceof AiFail) return fail(e.code, e.status);
    return fail('upstream', 502);
  }
}
